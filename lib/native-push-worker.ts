import 'server-only';
import {after} from 'next/server';
import {createApnsSender} from './apns-server';
import {type ApnsConfiguration,type ApnsDelivery,type ApnsResult,validApnsDeviceToken} from './apns';
import {nativePushRpc,pushObject,readNativePushConfiguration,verifyNativePushSession} from './native-push-server';
import {isPushId} from './native-push';
import {isAppLocale,type AppLocale} from './i18n/locales';
import {loadMessages} from './i18n/messages';
type Destination='messages'|'notifications';
type ReadyJob={id:string;lease:string;revision:string;accountId:string;sessionId:string;deviceToken:string;locale:AppLocale;destination:Destination;expiresAt:string};
const identity=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
function readyJob(value:Record<string,unknown>,id:string,lease:string,configuration:ApnsConfiguration):ReadyJob|null{
 if(value.status!=='ready')return null;
 if(value.id!==id||value.lease!==lease||!isPushId(value.revision)||!identity(value.accountId)||!identity(value.sessionId)||!validApnsDeviceToken(value.deviceToken)||!isAppLocale(value.locale)
  ||!['messages','notifications'].includes(String(value.destination))||typeof value.expiresAt!=='string'||!Number.isFinite(Date.parse(value.expiresAt))
  ||value.bundleId!==configuration.bundleId||value.environment!==configuration.environment)throw new Error('push_unavailable');
 return value as unknown as ReadyJob;
}
async function genericBody(locale:AppLocale,destination:Destination):Promise<string>{
 const messages=await loadMessages(locale),copy=messages.PushNotifications;
 if(!pushObject(copy))throw new Error('push_unavailable');
 const text=copy[destination==='messages'?'messageBody':'noticeBody'];
 if(typeof text!=='string'||!text.trim()||text.length>512)throw new Error('push_unavailable');return text;
}
type Dependencies={configuration?:ApnsConfiguration|null;rpc?:typeof nativePushRpc;verifySession?:typeof verifyNativePushSession;send?:(delivery:ApnsDelivery)=>Promise<ApnsResult>;body?:(locale:AppLocale,destination:Destination)=>Promise<string>};
/** No automatic activation, historical enqueue, payload content or persistent session cache. */
export async function runNativePushWorker(dependencies:Dependencies={}){
 const configuration=dependencies.configuration===undefined?readNativePushConfiguration():dependencies.configuration;
 const counts={claimed:0,accepted:0,cancelled:0,retry:0,failed:0};
 if(!configuration)return{status:'disabled',...counts};
 const rpc=dependencies.rpc??nativePushRpc,verify=dependencies.verifySession??verifyNativePushSession,send=dependencies.send??createApnsSender(configuration),copy=dependencies.body??genericBody;
 const configInput={bundleId:configuration.bundleId,environment:configuration.environment};
 const heartbeat=await rpc('worker_heartbeat',null,null,configInput);
 if(heartbeat.status==='disabled')return{status:'disabled',...counts};if(heartbeat.status!=='ok')throw new Error('push_unavailable');
 const claimed=await rpc('claim',null,null,configInput);
 if(claimed.status==='disabled')return{status:'disabled',...counts};
 if(claimed.status!=='ok'||!Array.isArray(claimed.jobs)||claimed.jobs.length>10)throw new Error('push_unavailable');
 for(const reference of claimed.jobs){
  if(!pushObject(reference)||!isPushId(reference.id)||!isPushId(reference.lease))throw new Error('push_unavailable');
  const id=reference.id,lease=reference.lease;counts.claimed++;
  const finish=async(result:ApnsResult|{kind:'revoked'})=>{
   const ack=await rpc('finish',null,null,{...configInput,id,lease,outcome:result.kind,...('invalidSince'in result?{invalidSince:result.invalidSince}:{}),...('retryAfterMs'in result?{retryAfterMs:result.retryAfterMs}:{})});
   if(ack.status!=='ok'&&ack.status!=='stale')throw new Error('push_unavailable');
  };
  const firstState=await rpc('prepare',null,null,{...configInput,id,lease});
  if(firstState.status==='deferred'){counts.retry++;continue;}
  const first=readyJob(firstState,id,lease,configuration);
  if(!first){counts.cancelled++;continue;}
  const verified=await verify(first.accountId,first.sessionId);
  if(verified!=='active'){await finish(verified==='revoked'?{kind:'revoked'}:{kind:'retry',retryAfterMs:60_000});if(verified==='revoked')counts.cancelled++;else counts.retry++;continue;}
  let bodyText:string;try{bodyText=await copy(first.locale,first.destination);}catch{await finish({kind:'retry',retryAfterMs:60_000});counts.retry++;continue;}
  // Re-read current read receipts, membership/blocks, registration revision and opt-ins after Clerk verification.
  const currentState=await rpc('prepare',null,null,{...configInput,id,lease});
  if(currentState.status==='deferred'){counts.retry++;continue;}
  const current=readyJob(currentState,id,lease,configuration);
  if(!current){counts.cancelled++;continue;}
  if(current.revision!==first.revision||current.accountId!==first.accountId||current.sessionId!==first.sessionId||current.deviceToken!==first.deviceToken){await finish({kind:'rejected'});counts.cancelled++;continue;}
  if(Date.parse(current.expiresAt)<=Date.now()){await finish({kind:'expired'});counts.failed++;continue;}
  let result:ApnsResult;
  try{result=await send({id,deviceToken:current.deviceToken,body:bodyText,destination:current.destination,expiresAt:Date.parse(current.expiresAt)});}catch{result={kind:'retry',retryAfterMs:60_000};}
  await finish(result);
  if(result.kind==='accepted')counts.accepted++;else if(result.kind==='retry'||result.kind==='configuration')counts.retry++;else counts.failed++;
  if(result.kind==='configuration')break;
 }
 await rpc('prune',null,null,configInput);
 return{status:'completed',...counts};
}


/** Wake the durable outbox only after the caller has validated a committed message ACK. */
export function scheduleNativePushAfterCommit(schedule:typeof after=after,run:()=>Promise<unknown>=runNativePushWorker,enabled=process.env.NATIVE_PUSH_ENABLED==='true'){
 if(!enabled)return;
 try{schedule(async()=>{try{await run();}catch{/* Durable queue and cron remain authoritative. */}});}catch{/* Never roll back a confirmed message. */}
}
