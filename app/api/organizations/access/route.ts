import { createHash, randomBytes } from 'node:crypto';
import { currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOrganization } from '@/lib/organization-access';
import { hasCompanyCapability } from '@/lib/company-access';
import { rateLimit } from '@/lib/rateLimit';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(request: Request) {
 const session = await requireAuth(); if (session instanceof NextResponse) return session;
 const params = new URL(request.url).searchParams;
 const orgId = params.get('organizationId') || '', companyId = params.get('companyId') || '';
 if (companyId) {
  if (!uuid(companyId) || !await hasCompanyCapability(companyId,session.userId,'manage_team')) return json({error:'forbidden'},403);
  const result = await db.from('organization_company_links').select('id,organization_id,status,created_at,organization:organizations(name)')
   .eq('company_id',companyId).in('status',['pending','accepted']).order('created_at',{ascending:false}).limit(50);
  return result.error ? json({error:'load'},503) : json({links:result.data});
 }
 if (!uuid(orgId) || !await canManageOrganization(orgId,session.userId)) return json({error:'forbidden'},403);
 const [org,members,invites,links] = await Promise.all([
  db.from('organizations').select('owner_user_id').eq('id',orgId).single(),
  db.from('organization_members').select('user_id,role,status,public_profile').eq('organization_id',orgId).eq('status','active').limit(100),
  db.from('organization_invitations').select('id,status,created_at,expires_at,recipient_email').eq('organization_id',orgId).eq('status','pending').gt('expires_at',new Date().toISOString()).limit(100),
  db.from('organization_company_links').select('id,company_id,status,company:companies(name)').eq('organization_id',orgId).in('status',['pending','accepted']).limit(1),
 ]);
 if (org.error || members.error || invites.error || links.error) return json({error:'load'},503);
 const memberIds = (members.data || []).map(member => member.user_id);
 const profiles = memberIds.length ? await db.from('profiles').select('user_id,display_name').in('user_id',memberIds) : {data:[],error:null};
 if(profiles.error) return json({error:'load'},503);
 const names = new Map((profiles.data || []).map(profile=>[profile.user_id,profile.display_name]));
 // Recipient addresses are visible only to the owner who created these invitations.
 const visibleInvites = org.data.owner_user_id===session.userId ? invites.data : [];
 const namedMembers = members.data.map(member=>({...member,name:names.get(member.user_id)||null}));
 return json({owner:org.data.owner_user_id===session.userId,userId:session.userId,members:namedMembers,invites:visibleInvites,links:links.data});
}

export async function POST(request: Request) {
 const session = await requireAuth(); if (session instanceof NextResponse) return session;
 if (!(await rateLimit(`organization-access:${session.userId}`,30,3600)).allowed) return json({error:'rate'},429);
 const body = await request.json().catch(()=>null);
 if (!body || typeof body.action!=='string') return json({error:'invalid'},400);
 let orgId = typeof body.organizationId==='string' ? body.organizationId : '';
 if(body.action==='public_profile') {
  if(!uuid(orgId)||typeof body.visible!=='boolean')return json({error:'invalid'},400);
  const result=await db.rpc('set_organization_profile_visibility',{p_org:orgId,p_actor:session.userId,p_visible:body.visible});
  return result.error?json({error:result.error.code==='42501'?'forbidden':'load'},result.error.code==='42501'?403:503):json({ok:true});
 }
 let target = typeof body.target==='string' ? body.target : '';
 let tokenHash='', hashes:string[]=[], token='', recipient='';
 if (['accept_invite','decline_invite'].includes(body.action)) {
  if (typeof body.token!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(body.token)) return json({error:'invalid'},400);
  tokenHash=hash(body.token);
  const [invitation,user] = await Promise.all([
   db.from('organization_invitations').select('id,organization_id').eq('token_hash',tokenHash).maybeSingle(),currentUser(),
  ]);
  if (invitation.error) return json({error:'load'},503);
  if (!invitation.data || !user || user.id!==session.userId) return json({error:'unavailable'},404);
  target=invitation.data.id; orgId=invitation.data.organization_id;
  hashes=user.emailAddresses.filter(email=>email.verification?.status==='verified').map(email=>hash(email.emailAddress.trim().toLowerCase()));
 } else if (body.action==='invite') {
  const email=typeof body.email==='string' ? body.email.trim().toLowerCase() : '';
  if (email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({error:'invalid'},400);
  recipient=email; token=randomBytes(32).toString('base64url'); tokenHash=hash(token); target=hash(email);
 }
 if(body.action==='request_link') {
  const value=typeof body.companySlug==='string'?body.companySlug.trim():'';
  const slug=value.startsWith('https://')?value.match(/^https:\/\/(?:www\.)?cinegenius\.co\/companies\/([a-zA-Z0-9_-]+)\/?$/)?.[1]:value;
  if(!slug||!/^[a-zA-Z0-9_-]{1,180}$/.test(slug))return json({error:'invalid'},400);
  const company=await db.from('companies').select('id').eq('slug',slug).eq('published',true).maybeSingle();
  if(company.error)return json({error:'load'},503);
  if(!company.data)return json({error:'unavailable'},409);
  target=company.data.id;
 }
 if (!uuid(orgId) || target.length>256) return json({error:'invalid'},400);
 const result = await db.rpc('change_organization_access',{p_org:orgId,p_actor:session.userId,p_action:body.action,p_target:target,p_token:tokenHash,p_hashes:hashes,p_recipient:recipient});
 if (result.error) {
  const code=result.error.code;
  return json({error:code==='42501'?'forbidden':code==='PT409'||code==='23505'?'unavailable':code==='22023'||code==='22P02'?'invalid':'save'},code==='42501'?403:code==='PT409'||code==='23505'?409:code==='22023'||code==='22P02'?400:503);
 }
 return json({ok:true,...(token?{invitationPath:`/organization-invitations/${token}`}:{})});
}
