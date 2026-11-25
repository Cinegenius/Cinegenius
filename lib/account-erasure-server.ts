import 'server-only';
import {createHmac} from 'node:crypto';
import {db} from '@/lib/db';
import {clerkClient} from '@clerk/nextjs/server';
import {erasureId,erasureSummary} from './account-erasure';
import {protectedMediaKey} from './protected-media';
import {appLocale} from './i18n/locales';
import {isConfiguredAdmin} from './admin-policy';
import {sendErasureNotice,sendErasureAlert} from './account-erasure-email';

export class ErasureError extends Error {
  constructor(public status=503) { super('account_erasure_unavailable'); }
}
export async function erasureRPC(actor: string, action: string, id: string | null=null, payload: Record<string, unknown>={}) {
  const {data,error}=await db.rpc('account_erasure',{p_actor:actor,p_action:action,p_id:id,p_payload:payload});
  if(error) throw new ErasureError(error.code==='PT409'?409:error.code==='PT404'?404:error.code==='PT400'?400:503);
  return data;
}
export async function requestErasure(accountId: string, source: 'member' | 'deleted_webhook'='member') {
  const value=await erasureRPC(accountId,source==='deleted_webhook'?'external_deleted':'request');
  if(!erasureSummary(value)) throw new ErasureError();
  return value;
}
function userMissing(cause: unknown) {
  return !!cause && typeof cause==='object' && 'status' in cause && cause.status===404
    && 'errors' in cause && Array.isArray(cause.errors)
    && cause.errors.some(error=>error && typeof error==='object' && error.code==='resource_not_found');
}
/** Bounded work, durable leases and no raw provider errors or user content in logs. */
export async function runAccountErasure(id?: string) {
  const actor='erasure_worker';
  const claim=await erasureRPC(actor,'claim',id??null);
  if(claim===null || claim?.disabled===true) return {status:claim?.disabled?'disabled':'idle'};
  if(!erasureId(claim.id)||!erasureId(claim.token)||typeof claim.ownerId!=='string'||!/^[A-Za-z0-9_-]{3,128}$/.test(claim.ownerId)
    ||!['running','waiting','needs_review'].includes(claim.state)||typeof claim.identityDeleted!=='boolean'||typeof claim.identityReady!=='boolean')throw new ErasureError();
  const rpc=(action:string,payload:Record<string,unknown>={})=>erasureRPC(actor,action,claim.id,{...payload,token:claim.token});
  const review=async(reason:string)=>{await rpc('review_required',{reason});return {status:'needs_review'};};
  try {
    if(claim.state==='needs_review'){await sendErasureAlert(claim.id);await rpc('alert_sent');return {status:'needs_review'};}
    if(isConfiguredAdmin(claim.ownerId,process.env.ADMIN_USER_IDS))return review('provider_review');
    if(claim.state==='waiting') {
      const notice=await rpc('notice');
      if(notice?.review)return review(notice.review);
      if(notice?.ready!==true)throw new ErasureError();
      await sendErasureNotice(claim.id,notice);
      const result=await rpc('notice_sent',{kind:notice.kind});
      if(!['waiting','completed'].includes(result?.state))throw new ErasureError();
      return {status:result.state};
    }
    const prepared=await rpc('prepare');
    if(prepared?.review)return review(prepared.review);
    if(!Array.isArray(prepared?.files)||prepared.files.length>100)throw new ErasureError();
    // Validate the database manifest again before any irreversible provider call.
    const paths=prepared.files.map((file:{bucket:unknown;path:unknown})=>{
      if(file.bucket!=='protected-media'||typeof file.path!=='string'||!protectedMediaKey('/api/media/'+file.path)
        ||file.path.split('/').at(-2)!==claim.ownerId)throw new ErasureError();
      return file.path;
    });
    if(paths.length){
      const removed=await db.storage.from('protected-media').remove(paths);
      if(removed.error)throw new ErasureError();
      await rpc('files_removed',{paths});
    }
    const key=process.env.OPENAI_API_KEY?.trim();
    const rateDigests=key?['genie:user:','native-genie:'].map(prefix=>createHmac('sha256',key).update(prefix+claim.ownerId).digest('hex')):[];
    const cleaned=await rpc('cleanup',{rateDigests});
    if(cleaned?.review)return review(cleaned.review);
    if(cleaned?.more){await rpc('continue');return {status:'pending'};}
    if(cleaned?.ready!==true)throw new ErasureError();
    // Newsletter consent/independent email records are not inferred from an ID.
    // If the identity was removed elsewhere, route the missing mapping for review.
    if(claim.identityDeleted&&!claim.identityReady)return review('provider_review');
    const clerk=await clerkClient();
    let user;
    try{user=await clerk.users.getUser(claim.ownerId);}catch(cause){if(!userMissing(cause))throw cause;}
    if(!user&&!claim.identityReady)return review('provider_review');
    if(user&&!claim.identityReady) {
      if(user.id!==claim.ownerId)throw new ErasureError();
      const emails=user.emailAddresses.map(value=>value.emailAddress.toLowerCase());
      if(emails.length){
        const subscriptions=await db.from('newsletter_subscriptions').select('id').in('email',emails).limit(1);
        if(subscriptions.error)throw new ErasureError();
        if(subscriptions.data?.length)return review('provider_review');
      }
      const primary=user.emailAddresses.find(value=>value.id===user.primaryEmailAddressId&&value.verification?.status==='verified');
      if(!primary)return review('provider_review');
      await rpc('identity_prepare',{email:primary.emailAddress,locale:appLocale(user.locale)
        ??appLocale(user.privateMetadata?.cinegeniusLocale)??appLocale(user.unsafeMetadata?.cinegeniusLocale)??'de'});
    }
    if(user){
      try {const removed=await clerk.users.deleteUser(claim.ownerId);if(removed.id!==claim.ownerId)throw new ErasureError();}
      catch(cause){if(!userMissing(cause))throw cause;}
    }
    const result=await rpc('identity_deleted');
    if(result?.review)return review(result.review);
    if(result?.state!=='waiting')throw new ErasureError();
    return {status:'waiting'};
  } catch {
    await rpc('failed').catch(()=>{}); // An expired lease is recovered by the scheduler.
    throw new ErasureError();
  }
}

/** One scheduled invocation stays bounded; exceptions cannot stall later accounts. */
export async function runAccountErasureBatch(){
 const counts:Record<string,number>={};const started=Date.now();
 for(let index=0;index<5&&Date.now()-started<100_000;index++){
  try{const result=await runAccountErasure();counts[result.status]=(counts[result.status]??0)+1;if(['idle','disabled'].includes(result.status))break;}
  catch{counts.failed=(counts.failed??0)+1;}
 }
 return {counts};
}
