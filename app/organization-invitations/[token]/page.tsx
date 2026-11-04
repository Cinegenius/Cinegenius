import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import OrganizationInvitation from '@/components/organizations/OrganizationInvitation';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{token:string}>}) {
 const {token}=await params;
 if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
 const {userId}=await auth();
 if (!userId) redirect(`/sign-in?redirect_url=${encodeURIComponent(`/organization-invitations/${token}`)}`);
 // Possession of the URL never discloses a private organization's content.
 const {data,error}=await db.from('organization_invitations').select('id,recipient_hash,organization:organizations(name)').eq('token_hash',createHash('sha256').update(token).digest('hex')).eq('status','pending').gt('expires_at',new Date().toISOString()).maybeSingle();
 if(error) throw new Error('organization_invitation_load_failed');
 const user=await currentUser();
 const verified=user?.id===userId && user.emailAddresses.some(email=>email.verification?.status==='verified' && createHash('sha256').update(email.emailAddress.trim().toLowerCase()).digest('hex')===data?.recipient_hash);
 const organization=data?.organization as unknown as {name:string}|null;
 return <OrganizationInvitation token={token} available={!!data && !!verified} organizationName={verified?organization?.name:undefined}/>;
}
