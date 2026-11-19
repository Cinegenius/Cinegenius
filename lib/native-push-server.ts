import 'server-only';
import {createHash} from 'node:crypto';
import {auth,clerkClient} from '@clerk/nextjs/server';
import {getCurrentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {rateLimit} from '@/lib/rateLimit';
import {trustedMutationOrigin} from '@/lib/request-origin';
import {createApnsRequestBuilder,type ApnsConfiguration} from './apns';
import {isAppLocale} from './i18n/locales';
import {NATIVE_PUSH_CONTRACT,isPushId,isPushInstallationProof,readPushRegistration,readPushRevision,type PushCapabilities,type PushErrorCode} from './native-push';
export const PUSH_PRIVATE_HEADERS={'Cache-Control':'private, no-store, max-age=0','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export class NativePushFailure extends Error {
 readonly code:PushErrorCode;readonly status:number;
 constructor(code:PushErrorCode,status=503){super(code);this.code=code;this.status=status;}
}
export const pushHash=(value:string)=>createHash('sha256').update(value).digest('hex');
export const pushObject=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function readNativePushConfiguration(environment:Record<string,string|undefined>=process.env):ApnsConfiguration|null{
 if(environment.NATIVE_PUSH_ENABLED!=='true')return null;
 const configuration={teamId:environment.APNS_TEAM_ID??'',keyId:environment.APNS_KEY_ID??'',privateKey:(environment.APNS_PRIVATE_KEY??'').replace(/\\n/g,'\n'),bundleId:environment.APNS_BUNDLE_ID??'',environment:environment.APNS_ENVIRONMENT};
 if(configuration.environment!=='sandbox'&&configuration.environment!=='production')return null;
 try{createApnsRequestBuilder(configuration as ApnsConfiguration);return configuration as ApnsConfiguration;}catch{return null;}
}
export async function nativePushRpc(action:string,actor:string|null,session:string|null,input:Record<string,unknown>={}){
 const result=await db.rpc('native_push_v1',{p_action:action,p_actor:actor,p_session:session,p:input}).abortSignal(AbortSignal.timeout(12_000));
 if(result.error||!pushObject(result.data)||typeof result.data.status!=='string')throw new NativePushFailure('unavailable');
 return result.data;
}
function success(data:Record<string,unknown>){
 if(data.status==='ok')return;
 const errors:Record<string,[PushErrorCode,number]>={missing:['not_found',404],conflict:['conflict',409],invalid:['invalid',400],capacity:['rate_limited',429]};
 const mapped=errors[String(data.status)]??['unavailable',503];throw new NativePushFailure(mapped[0],mapped[1]);
}
function json(accountId:string|null,body:Record<string,unknown>,capabilities:PushCapabilities={register:false,dispatch:false},status=200){
 return Response.json({contract:NATIVE_PUSH_CONTRACT,accountId,serverNow:new Date().toISOString(),capabilities,...body},{status,headers:PUSH_PRIVATE_HEADERS});
}
export async function verifyNativePushSession(userId:string,sessionId:string):Promise<'active'|'revoked'|'unavailable'>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const client=await clerkClient();
  const result=await Promise.race([client.sessions.getSession(sessionId),new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),6_000);})]);
  if(!result)return'unavailable';
  return result.id===sessionId&&result.userId===userId&&result.status==='active'&&Number.isFinite(result.expireAt)&&result.expireAt>Date.now()?'active':'revoked';
 }catch(cause){return pushObject(cause)&&(cause.status===404||cause.status===401)?'revoked':'unavailable';}finally{clearTimeout(timer);}
}
async function body(request:Request,limit=4096):Promise<unknown>{
 if(request.headers.get('content-type')?.split(';',1)[0].trim()!=='application/json'||!request.body)throw new NativePushFailure('invalid',400);
 const length=request.headers.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>limit))throw new NativePushFailure('invalid',400);
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>limit){await reader.cancel();throw new NativePushFailure('invalid',400);}chunks.push(next.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }catch(cause){if(cause instanceof NativePushFailure)throw cause;throw new NativePushFailure('invalid',400);}
}
const configurationInput=(configuration:ApnsConfiguration|null)=>({bundleId:configuration?.bundleId??null,environment:configuration?.environment??null});
function view(data:Record<string,unknown>,installationId:string){
 if(data.installationId!==installationId||!(data.revision===null||isPushId(data.revision))||!['own','different-account','absent'].includes(String(data.binding)))throw new NativePushFailure('unavailable');
 const result:Record<string,unknown>={installationId,revision:data.revision,binding:data.binding};
 if(data.binding==='own'){
  if(!pushObject(data.preferences)||typeof data.preferences.messages!=='boolean'||typeof data.preferences.notices!=='boolean'||!isAppLocale(data.locale))throw new NativePushFailure('unavailable');
  result.preferences={messages:data.preferences.messages,notices:data.preferences.notices};result.locale=data.locale;
 }
 return result;
}
export async function nativePushRoute(request:Request,action:'capabilities'|'view'|'register'|'revoke',installationId?:string):Promise<Response>{
 let actor:string|null=null;
 try{
  actor=(await getCurrentUser())?.userId??null;const identity=await auth();
  if(!actor||identity.userId!==actor||!identity.sessionId)throw new NativePushFailure('unauthorized',401);
  if(request.headers.get('X-Push-Account')!==actor)throw new NativePushFailure('account_changed',409);
  if(request.headers.get('X-CineGenius-Push-Contract')!==NATIVE_PUSH_CONTRACT)throw new NativePushFailure('invalid',400);
  const mutation=action==='register'||action==='revoke';
  if(mutation&&!trustedMutationOrigin({requestUrl:request.url,origin:request.headers.get('origin'),referer:request.headers.get('referer'),development:process.env.NODE_ENV!=='production',deploymentHost:process.env.VERCEL_URL}))throw new NativePushFailure('invalid',403);
  if(!(await rateLimit(`native-push:${mutation?'write':'read'}:${actor}`,mutation?20:60,60)).allowed)throw new NativePushFailure('rate_limited',429);
  const proof=request.headers.get('X-Push-Installation-Proof');
  if(action!=='capabilities'&&(!isPushId(installationId)||!isPushInstallationProof(proof)))throw new NativePushFailure('invalid',400);
  const verified=await verifyNativePushSession(actor,identity.sessionId);
  if(verified!=='active')throw new NativePushFailure(verified==='revoked'?'unauthorized':'unavailable',verified==='revoked'?401:503);
  const configuration=readNativePushConfiguration(),configInput=configurationInput(configuration);
  const rawCapabilities=await nativePushRpc('capabilities',actor,identity.sessionId,configInput);success(rawCapabilities);
  const capabilities={register:!!configuration&&rawCapabilities.register===true,dispatch:!!configuration&&rawCapabilities.dispatch===true};
  if(action==='capabilities')return json(actor,{server:configuration?{bundleId:configuration.bundleId,environment:configuration.environment}:null},capabilities);
  const input:Record<string,unknown>={...configInput,installationId,proofHash:pushHash(proof!)};
  if(action==='view'){const data=await nativePushRpc('view',actor,identity.sessionId,input);success(data);return json(actor,view(data,installationId!),capabilities);}
  const rawBody=await body(request,action==='register'?4096:256);
  if(action==='revoke'){
   const parsed=readPushRevision(rawBody);if(!parsed)throw new NativePushFailure('invalid',400);
   const data=await nativePushRpc('revoke',actor,identity.sessionId,{...input,...parsed});success(data);
   if(data.installationId!==installationId||!isPushId(data.revision)||data.revoked!==true)throw new NativePushFailure('unavailable');
   return json(actor,{installationId,revision:data.revision,revoked:true},capabilities);
  }
  const parsed=readPushRegistration(rawBody);if(!parsed)throw new NativePushFailure('invalid',400);
  if(!configuration||!capabilities.register)throw new NativePushFailure('unavailable');
  if(parsed.environment!==configuration.environment)throw new NativePushFailure('invalid',400);
  const data=await nativePushRpc('register',actor,identity.sessionId,{...input,expectedRevision:parsed.expectedRevision,deviceToken:parsed.deviceToken,tokenHash:pushHash(parsed.deviceToken),messages:parsed.preferences.messages,notices:parsed.preferences.notices,locale:parsed.locale});
  success(data);const saved=view(data,installationId!);
  if(saved.binding!=='own'||!isPushId(saved.revision)||saved.locale!==parsed.locale||!pushObject(saved.preferences)||saved.preferences.messages!==parsed.preferences.messages||saved.preferences.notices!==parsed.preferences.notices)throw new NativePushFailure('unavailable');
  return json(actor,saved,capabilities);
 }catch(cause){const failure=cause instanceof NativePushFailure?cause:new NativePushFailure('unavailable');return json(actor,{error:{code:failure.code}},undefined,failure.status);}
}
