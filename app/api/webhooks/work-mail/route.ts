import {Webhook} from 'svix';
import {NextRequest,NextResponse} from 'next/server';
import {rateLimit} from '@/lib/rateLimit';
import {WORK_MAIL_HEADERS,WORK_MAIL_LIMITS,WorkMailError,workMailDomain,workMailHash,workMailReadBounded,workMailUuid} from '@/lib/work-mail';
import {workMailCapabilities,workMailPersistSource} from '@/lib/work-mail-service';
import {workMailResolveAlias,workMailRPC,type WorkMailRecord} from '@/lib/work-mail-store';
import {getWorkMailResendRaw} from '@/lib/work-mail-resend';
export const runtime='nodejs';
export const maxDuration=60;
export const dynamic='force-dynamic';
export async function POST(request:NextRequest) {
 try {
  if(!workMailCapabilities(true).forwarding)return NextResponse.json({code:'unavailable'},{status:503,headers:WORK_MAIL_HEADERS});
  const bytes=await workMailReadBounded(new Response(request.body,{headers:request.headers}),WORK_MAIL_LIMITS.webhookBytes);
  const headers={'svix-id':request.headers.get('svix-id')??'','svix-timestamp':request.headers.get('svix-timestamp')??'','svix-signature':request.headers.get('svix-signature')??''};
  let event:unknown;try{event=new Webhook(process.env.WORK_MAIL_RESEND_WEBHOOK_SECRET!).verify(bytes.toString('utf8'),headers);}catch{return NextResponse.json({code:'invalid_signature'},{status:400,headers:WORK_MAIL_HEADERS});}
  if(!event||typeof event!=='object'||(event as {type?:unknown}).type!=='email.received')return NextResponse.json({received:true},{headers:WORK_MAIL_HEADERS});
  const data=(event as {data?:unknown}).data;
  if(!data||typeof data!=='object')throw new WorkMailError('invalid',400);
  const value=data as {email_id?:unknown;to?:unknown};
  if(!workMailUuid(value.email_id)||!Array.isArray(value.to)||value.to.length<1||value.to.length>20)throw new WorkMailError('invalid',400);
  const domain=workMailDomain()!,locals=new Set<string>();
  for(const address of value.to){if(typeof address!=='string'||address.length>320)continue;const match=address.toLowerCase().match(/^([^<>\s@]+)@([^<>\s@]+)$/);if(match&&match[2]===domain&&/^cg-[a-f0-9]{48}$/.test(match[1]))locals.add(match[1]);}
  // A delivery may resolve to exactly one private alias; never infer ownership from sender, subject, or a header account ID.
  if(locals.size!==1)return NextResponse.json({received:true},{headers:WORK_MAIL_HEADERS});
  const owner=await workMailResolveAlias([...locals][0]);if(!owner)return NextResponse.json({received:true},{headers:WORK_MAIL_HEADERS});
  const externalKey=workMailHash(`inbound:receiving:${value.email_id}`);
  const prior=await workMailRPC<WorkMailRecord|null>(owner,'item_find',{source:'inbound',externalKey});
  if(prior?.status==='ready')return NextResponse.json({received:true},{headers:WORK_MAIL_HEADERS});
  if(!(await rateLimit(`work-mail-receive:${owner}`,100,86400)).allowed)throw new WorkMailError('quota',429);
  const source=await getWorkMailResendRaw(value.email_id,process.env.WORK_MAIL_RESEND_API_KEY!,fetch,`${[...locals][0]}@${domain}`);
  await workMailPersistSource(owner,'inbound',value.email_id,null,source);
  return NextResponse.json({received:true},{headers:WORK_MAIL_HEADERS});
 }catch(cause){const known=cause instanceof WorkMailError?cause:new WorkMailError();return NextResponse.json({code:known.code},{status:known.status,headers:WORK_MAIL_HEADERS});}
}
