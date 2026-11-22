import 'server-only';
import {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual} from 'node:crypto';

export type WorkMailProvider='gmail'|'microsoft';
export type WorkMailEnvironment=Record<string,string|undefined>;
export type WorkMailBinding={accountId:string;provider:WorkMailProvider;connectionId:string};
export type WorkMailTokenSet={accessToken:string;refreshToken:string;expiresAt:number;scope:string[]};
export type WorkMailSummary={id:string;subject:string;from:string;receivedAt:string;hasAttachments:boolean};
export type WorkMailAttachment={id:string;name:string;type:string;size:number};
export const WORK_MAIL_MAX_RAW_BYTES=12*1024*1024;
export const WORK_MAIL_MAX_ATTACHMENT_BYTES=12*1024*1024;
const GMAIL_SCOPE='https://www.googleapis.com/auth/gmail.readonly';
const GRAPH_SCOPE='https://graph.microsoft.com/Mail.Read';
const GRAPH_FIELDS='id,subject,from,receivedDateTime,hasAttachments';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCOUNT=/^[A-Za-z0-9_-]{1,160}$/;
export class WorkMailOAuthError extends Error {
  readonly code:string;
  constructor(code:string){super(code);this.name='WorkMailOAuthError';this.code=code;}
}
function fail(code:string):never{throw new WorkMailOAuthError(code);}
function provider(value:unknown):asserts value is WorkMailProvider{if(value!=='gmail'&&value!=='microsoft')fail('invalid_provider');}
function validBinding(value:WorkMailBinding){provider(value.provider);if(!ACCOUNT.test(value.accountId)||!UUID.test(value.connectionId))fail('invalid_binding');}
function key(env:WorkMailEnvironment):Buffer{
  const value=env.WORK_MAIL_ENCRYPTION_KEY;
  if(!value||!/^[A-Za-z0-9+/]{43}=$/.test(value))fail('provider_unconfigured');
  const bytes=Buffer.from(value,'base64');if(bytes.length!==32||bytes.toString('base64')!==value)fail('provider_unconfigured');return bytes;
}
function scopeAllowed(p:WorkMailProvider,scope:string[]){
  if(!scope.length||scope.length>10)return false;
  return p==='gmail'?scope.every(s=>s===GMAIL_SCOPE):scope.some(s=>s.toLowerCase()==='mail.read'||s.toLowerCase()===GRAPH_SCOPE.toLowerCase())&&scope.every(s=>['mail.read','offline_access',GRAPH_SCOPE.toLowerCase()].includes(s.toLowerCase()));
}
function tokenString(value:unknown):value is string{return typeof value==='string'&&value.length<=16384&&/^[\x21-\x7e]+$/.test(value);}
function tokenSet(value:unknown,p:WorkMailProvider):WorkMailTokenSet{
  const t=value as WorkMailTokenSet;
  if(!t||!tokenString(t.accessToken)||!tokenString(t.refreshToken)||!Number.isSafeInteger(t.expiresAt)||t.expiresAt<0||!Array.isArray(t.scope)||t.scope.some(s=>typeof s!=='string')||!scopeAllowed(p,t.scope))fail('invalid_token');
  return {accessToken:t.accessToken,refreshToken:t.refreshToken,expiresAt:t.expiresAt,scope:[...t.scope]};
}
function aad(purpose:string,values:Record<string,string>){return Buffer.from(JSON.stringify({v:1,purpose,...Object.fromEntries(Object.entries(values).sort(([a],[b])=>a.localeCompare(b)))}));}
function encrypt(value:unknown,associated:Buffer,env:WorkMailEnvironment){
  const bytes=Buffer.from(JSON.stringify(value));if(bytes.length>48000)fail('invalid_token');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(env),iv);cipher.setAAD(associated);
  const ciphertext=Buffer.concat([cipher.update(bytes),cipher.final()]);
  return 'v1.'+Buffer.concat([iv,ciphertext,cipher.getAuthTag()]).toString('base64url');
}
function decrypt(value:string,associated:Buffer,env:WorkMailEnvironment):unknown{
  if(typeof value!=='string'||!/^v1\.[A-Za-z0-9_-]{40,65536}$/.test(value))fail('invalid_token');
  const bytes=Buffer.from(value.slice(3),'base64url');if(bytes.toString('base64url')!==value.slice(3)||bytes.length<29)fail('invalid_token');
  try{const cipher=createDecipheriv('aes-256-gcm',key(env),bytes.subarray(0,12));cipher.setAAD(associated);cipher.setAuthTag(bytes.subarray(-16));return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(12,-16)),cipher.final()]).toString('utf8'));}
  catch(error){if(error instanceof WorkMailOAuthError)throw error;return fail('invalid_token');}
}
/** Server-only opaque ciphertext; AAD makes account/provider/connection swaps fail. */
export function sealWorkMailToken(tokens:WorkMailTokenSet,binding:WorkMailBinding,env:WorkMailEnvironment=process.env){
  validBinding(binding);return encrypt(tokenSet(tokens,binding.provider),aad('work-mail-tokens',binding),env);
}
export function unsealWorkMailToken(ciphertext:string,binding:WorkMailBinding,env:WorkMailEnvironment=process.env):WorkMailTokenSet{
  validBinding(binding);return tokenSet(decrypt(ciphertext,aad('work-mail-tokens',binding),env),binding.provider);
}
export function workMailProviderConfig(p:WorkMailProvider,env:WorkMailEnvironment=process.env){
  provider(p);key(env);
  const origin=env.WORK_MAIL_PUBLIC_ORIGIN??'https://www.cinegenius.co';
  if(!['https://www.cinegenius.co','https://cinegenius.co'].includes(origin))fail('provider_unconfigured');
  const clientId=env[p==='gmail'?'WORK_MAIL_GOOGLE_CLIENT_ID':'WORK_MAIL_MICROSOFT_CLIENT_ID'];
  const clientSecret=env[p==='gmail'?'WORK_MAIL_GOOGLE_CLIENT_SECRET':'WORK_MAIL_MICROSOFT_CLIENT_SECRET'];
  if(!clientId||clientId.length>512||/[\r\n\s]/.test(clientId)||!clientSecret||clientSecret.length>4096||/[\r\n]/.test(clientSecret))fail('provider_unconfigured');
  return {provider:p,clientId,clientSecret,redirectUri:origin+`/api/work/mail/oauth/${p}/callback`,
    authorizationEndpoint:p==='gmail'?'https://accounts.google.com/o/oauth2/v2/auth':'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint:p==='gmail'?'https://oauth2.googleapis.com/token':'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes:p==='gmail'?[GMAIL_SCOPE]:[GRAPH_SCOPE,'offline_access']};
}
export function workMailProviderReady(p:WorkMailProvider,env:WorkMailEnvironment=process.env){try{workMailProviderConfig(p,env);return true;}catch{return false;}}
export type VerifiedWorkMailAuthorization=WorkMailBinding&{sessionId:string;codeVerifier:string;stateHash:string;redirectUri:string};
/** Cookie must be HttpOnly/Secure/SameSite=Lax. Store and atomically consume the
 * returned stateHash in the current Clerk account/session BEFORE code exchange. */
export function createWorkMailAuthorization(input:WorkMailBinding&{sessionId:string;env?:WorkMailEnvironment;now?:number}){
  validBinding(input);if(!ACCOUNT.test(input.sessionId))fail('invalid_binding');
  const config=workMailProviderConfig(input.provider,input.env),now=input.now??Date.now();if(!Number.isSafeInteger(now)||now<0)fail('invalid_state');
  const stateToken=randomBytes(32).toString('base64url'),codeVerifier=randomBytes(48).toString('base64url'),expiresAt=now+10*60*1000;
  const stateHash=createHash('sha256').update(stateToken).digest('hex');
  const binding={accountId:input.accountId,sessionId:input.sessionId,provider:input.provider};
  const stateCookie=encrypt({...binding,connectionId:input.connectionId,stateToken,codeVerifier,expiresAt,createdAt:now,redirectUri:config.redirectUri},aad('work-mail-state',binding),input.env??process.env);
  const url=new URL(config.authorizationEndpoint);for(const [k,v]of Object.entries({client_id:config.clientId,redirect_uri:config.redirectUri,response_type:'code',scope:config.scopes.join(' '),state:stateToken,code_challenge:createHash('sha256').update(codeVerifier).digest('base64url'),code_challenge_method:'S256',prompt:'consent'}))url.searchParams.set(k,v);
  if(input.provider==='gmail'){url.searchParams.set('access_type','offline');url.searchParams.set('include_granted_scopes','false');}
  else url.searchParams.set('response_mode','query');
  return {url:url.href,stateCookie,stateToken,stateHash,connectionId:input.connectionId,expiresAt,redirectUri:config.redirectUri};
}
export function verifyWorkMailAuthorization(input:{provider:WorkMailProvider;accountId:string;sessionId:string;stateCookie:string;stateToken:string;env?:WorkMailEnvironment;now?:number}):VerifiedWorkMailAuthorization{
  provider(input.provider);if(!ACCOUNT.test(input.accountId)||!ACCOUNT.test(input.sessionId)||!/[A-Za-z0-9_-]{43}/.test(input.stateToken)||input.stateToken.length!==43)fail('invalid_state');
  const binding={accountId:input.accountId,sessionId:input.sessionId,provider:input.provider};
  let raw:Record<string,unknown>;try{raw=decrypt(input.stateCookie,aad('work-mail-state',binding),input.env??process.env) as Record<string,unknown>;}catch(error){if(error instanceof WorkMailOAuthError&&error.code==='provider_unconfigured')throw error;return fail('invalid_state');}
  const now=input.now??Date.now();
  if(!Number.isSafeInteger(now)||now<0)fail('invalid_state');
  if(!raw||typeof raw.stateToken!=='string'||raw.stateToken.length!==input.stateToken.length||!timingSafeEqual(Buffer.from(raw.stateToken),Buffer.from(input.stateToken))
    ||typeof raw.createdAt!=='number'||typeof raw.expiresAt!=='number'||raw.createdAt>now+30000||raw.expiresAt<=now||raw.expiresAt-raw.createdAt!==600000
    ||typeof raw.connectionId!=='string'||!UUID.test(raw.connectionId)||typeof raw.codeVerifier!=='string'||!(/^[A-Za-z0-9_-]{64}$/).test(raw.codeVerifier)
    ||raw.redirectUri!==workMailProviderConfig(input.provider,input.env).redirectUri)fail('invalid_state');
  return {...binding,connectionId:raw.connectionId,codeVerifier:raw.codeVerifier,stateHash:createHash('sha256').update(input.stateToken).digest('hex'),redirectUri:raw.redirectUri as string};
}

type Transport={fetch?:typeof globalThis.fetch;signal?:AbortSignal};
function signalFor(signal?:AbortSignal){return signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000);}
function operationTransport(input:Transport):Transport{return {...input,signal:input.signal?AbortSignal.any([input.signal,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000)};}
async function bounded(response:Response,limit:number,signal:AbortSignal,tokenError=false):Promise<Buffer>{
  if(response.redirected||response.status>=300&&response.status<400)fail('provider_redirect');
  if(!response.ok&&!(tokenError&&response.status===400)){await response.body?.cancel().catch(()=>{});fail(response.status===401||response.status===403?'provider_reauthorization_required':'provider_unavailable');}
  const declared=response.headers.get('content-length');if(declared&&/^\d+$/.test(declared)&&Number(declared)>limit){await response.body?.cancel().catch(()=>{});fail('message_too_large');}
  const reader=response.body?.getReader();if(!reader)return Buffer.alloc(0);
  const chunks:Buffer[]=[];let total=0;const cancel=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
  try{while(true){signal.throwIfAborted();const next=await reader.read();signal.throwIfAborted();if(next.done)break;total+=next.value.byteLength;if(total>limit){await reader.cancel().catch(()=>{});fail('message_too_large');}chunks.push(Buffer.from(next.value));}return Buffer.concat(chunks,total);}
  finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
}
async function request(url:string,init:RequestInit,max:number,transport:Transport,tokenError=false):Promise<{bytes:Buffer;type:string;status:number}>{
  const signal=signalFor(transport.signal);
  try{const response=await (transport.fetch??globalThis.fetch)(url,{...init,redirect:'error',cache:'no-store',signal});return {bytes:await bounded(response,max,signal,tokenError),type:response.headers.get('content-type')??'',status:response.status};}
  catch(error){if(error instanceof WorkMailOAuthError)throw error;return fail(signal.aborted?'provider_cancelled':'provider_unavailable');}
}
async function json(url:string,init:RequestInit,max:number,transport:Transport,tokenError=false):Promise<Record<string,unknown>>{
  const {bytes,type,status}=await request(url,init,max,transport,tokenError);if(!/^application\/(?:[\w.+-]*\+)?json(?:;|$)/i.test(type))fail('invalid_provider_response');
  try{const value=JSON.parse(bytes.toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))fail('invalid_provider_response');if(tokenError&&status===400)fail(['invalid_grant','access_denied'].includes(value.error)?'provider_reauthorization_required':value.error==='invalid_client'?'provider_unconfigured':'provider_unavailable');return value;}catch(error){if(error instanceof WorkMailOAuthError)throw error;return fail('invalid_provider_response');}
}
function tokensFrom(value:Record<string,unknown>,p:WorkMailProvider,now:number,prior?:WorkMailTokenSet){
  const scopes=typeof value.scope==='string'?value.scope.split(/\s+/).filter(Boolean):prior?.scope;
  if(!prior&&!tokenString(value.refresh_token))fail('provider_reauthorization_required');
  if(typeof value.token_type!=='string'||value.token_type.toLowerCase()!=='bearer'||typeof value.expires_in!=='number'||!Number.isInteger(value.expires_in)||value.expires_in<1||value.expires_in>86400||!scopes)fail('invalid_provider_response');
  return tokenSet({accessToken:value.access_token,refreshToken:value.refresh_token??prior?.refreshToken,expiresAt:now+value.expires_in*1000,scope:scopes},p);
}
export async function exchangeWorkMailCode(input:{authorization:VerifiedWorkMailAuthorization;code:string;env?:WorkMailEnvironment;now?:number}&Transport):Promise<WorkMailTokenSet>{
  validBinding(input.authorization);if(!ACCOUNT.test(input.authorization.sessionId)||!(/^[A-Za-z0-9_-]{64}$/).test(input.authorization.codeVerifier)||typeof input.code!=='string'||input.code.length>8192||!input.code||/[\r\n]/.test(input.code))fail('invalid_state');
  const config=workMailProviderConfig(input.authorization.provider,input.env);if(input.authorization.redirectUri!==config.redirectUri)fail('invalid_state');
  const body=new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,code:input.code,code_verifier:input.authorization.codeVerifier,redirect_uri:config.redirectUri,grant_type:'authorization_code'});
  if(config.provider==='microsoft')body.set('scope',config.scopes.join(' '));
  return tokensFrom(await json(config.tokenEndpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()},65536,input,true),config.provider,input.now??Date.now());
}
export async function refreshWorkMailToken(input:{provider:WorkMailProvider;tokens:WorkMailTokenSet;env?:WorkMailEnvironment;now?:number}&Transport):Promise<WorkMailTokenSet>{
  const previous=tokenSet(input.tokens,input.provider),config=workMailProviderConfig(input.provider,input.env);
  const body=new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,refresh_token:previous.refreshToken,grant_type:'refresh_token'});if(input.provider==='microsoft')body.set('scope',config.scopes.join(' '));
  return tokensFrom(await json(config.tokenEndpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()},65536,input,true),input.provider,input.now??Date.now(),previous);
}
function headers(accessToken:string,plain=false):Record<string,string>{if(!tokenString(accessToken))fail('invalid_token');const result:Record<string,string>={Authorization:'Bearer '+accessToken};if(plain)result.Prefer='outlook.body-content-type="text", IdType="ImmutableId"';return result;}
function id(value:string){if(typeof value!=='string'||!(/^[A-Za-z0-9_+=/-]{1,2048}$/).test(value))fail('invalid_message');return encodeURIComponent(value);}
function clean(value:unknown,max=500){return typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,' ').slice(0,max):'';}
function filename(value:unknown){return clean(value,180).replace(/[\\/]/g,'_')||'attachment';}
function mime(value:unknown){return typeof value==='string'&&value.length<=120&&/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(value)?value.toLowerCase():'application/octet-stream';}
function iso(value:unknown){const time=typeof value==='number'?value:typeof value==='string'?Date.parse(value):NaN;return Number.isFinite(time)&&Math.abs(time)<=8640000000000000?new Date(time).toISOString():null;}
function base64(value:unknown,max:number,url=true):Buffer{
  if(typeof value!=='string'||value.length>Math.ceil(max/3)*4+4||!(url?/^[A-Za-z0-9_-]*={0,2}$/:/^[A-Za-z0-9+/]*={0,2}$/).test(value)||value.replace(/=+$/,'').length%4===1)fail('invalid_provider_response');
  const result=Buffer.from(value,url?'base64url':'base64');if(result.length>max)fail('message_too_large');if(result.toString(url?'base64url':'base64').replace(/=+$/,'')!==value.replace(/=+$/,''))fail('invalid_provider_response');return result;
}
type GmailPart={partId?:string;filename?:string;mimeType?:string;headers?:Array<{name:string;value:string}>;body?:{attachmentId?:string;data?:string;size?:number};parts?:GmailPart[]};
function gmailParts(value:unknown):GmailPart[]{
  const result:GmailPart[]=[];function walk(part:GmailPart,depth:number){if(!part||typeof part!=='object'||depth>15||result.length>=500)fail('invalid_provider_response');result.push(part);if(part.parts){if(!Array.isArray(part.parts))fail('invalid_provider_response');for(const child of part.parts)walk(child,depth+1);}}
  if(value)walk(value as GmailPart,0);return result;
}
function gmailSummary(message:Record<string,unknown>):WorkMailSummary{
  const parts=gmailParts(message.payload),head=(message.payload as GmailPart|undefined)?.headers??[];
  if(!Array.isArray(head)||head.some(h=>!h||typeof h.name!=='string'||typeof h.value!=='string')||typeof message.id!=='string')fail('invalid_provider_response');
  const receivedAt=iso(typeof message.internalDate==='string'?Number(message.internalDate):NaN);if(!receivedAt)fail('invalid_provider_response');
  return {id:message.id,subject:clean(head.find(h=>h.name.toLowerCase()==='subject')?.value),from:clean(head.find(h=>h.name.toLowerCase()==='from')?.value),receivedAt,hasAttachments:parts.some(p=>!!p.filename||!!p.body?.attachmentId)};
}
function graphSummary(message:Record<string,unknown>):WorkMailSummary{
  if(typeof message.id!=='string')fail('invalid_provider_response');
  const from=message.from as {emailAddress?:{name?:string;address?:string}}|undefined;
  const receivedAt=iso(message.receivedDateTime);if(!receivedAt)fail('invalid_provider_response');
  return {id:message.id,subject:clean(message.subject),from:clean(from?.emailAddress?.name?`${from.emailAddress.name} <${from.emailAddress.address??''}>`:from?.emailAddress?.address),receivedAt,hasAttachments:message.hasAttachments===true};
}
function graphCursor(value:unknown,path='/v1.0/me/messages'):string|null{
  if(value==null)return null;if(typeof value!=='string'||value.length>8192)fail('invalid_provider_response');
  let url:URL;try{url=new URL(value);}catch{return fail('invalid_provider_response');}
  if(url.origin!=='https://graph.microsoft.com'||url.pathname!==path||url.username||url.password||url.hash)fail('invalid_provider_response');
  const allowed=['$top','$select','$orderby','$skip','$skiptoken'];for(const key of url.searchParams.keys())if(!allowed.includes(key)||url.searchParams.getAll(key).length!==1)fail('invalid_provider_response');
  if(url.searchParams.get('$select')!==GRAPH_FIELDS||url.searchParams.get('$orderby')!=='receivedDateTime desc')fail('invalid_provider_response');
  if(!/^(?:[1-9]|1[0-9]|2[0-5])$/.test(url.searchParams.get('$top')??''))fail('invalid_provider_response');
  if(url.searchParams.has('$skip')&&!/^\d{1,16}$/.test(url.searchParams.get('$skip')!))fail('invalid_provider_response');
  return url.href;
}
export async function listWorkMailMessages(input:{provider:WorkMailProvider;accessToken:string;cursor?:string|null;limit?:number}&Transport):Promise<{messages:WorkMailSummary[];cursor:string|null}>{
  provider(input.provider);const transport=operationTransport(input);const limit=input.limit??10;if(!Number.isInteger(limit)||limit<1||limit>25)fail('invalid_request');
  if(input.provider==='gmail'){
    if(input.cursor&&(input.cursor.length>4096||/[\x00-\x20\x7f]/.test(input.cursor)))fail('invalid_request');
    const url=new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');url.searchParams.set('maxResults',String(limit));url.searchParams.set('includeSpamTrash','false');if(input.cursor)url.searchParams.set('pageToken',input.cursor);
    const list=await json(url.href,{headers:headers(input.accessToken)},65536,transport);if(list.messages!==undefined&&!Array.isArray(list.messages))fail('invalid_provider_response');
    const entries=(list.messages??[]) as Array<{id:string}>;if(entries.length>limit)fail('invalid_provider_response');
    const fields='id,internalDate,payload(headers,filename,mimeType,body(attachmentId,size),parts(partId,filename,mimeType,body(attachmentId,size),parts(partId,filename,mimeType,body(attachmentId,size),parts(partId,filename,mimeType,body(attachmentId,size))))';
    const messages:WorkMailSummary[]=[];
    for(let start=0;start<entries.length;start+=3){messages.push(...await Promise.all(entries.slice(start,start+3).map(async entry=>gmailSummary(await json(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id(entry.id)}?format=full&fields=${encodeURIComponent(fields)}`,{headers:headers(input.accessToken)},256*1024,transport)))));}
    if(list.nextPageToken!==undefined&&(typeof list.nextPageToken!=='string'||list.nextPageToken.length>4096||/[\x00-\x20\x7f]/.test(list.nextPageToken)))fail('invalid_provider_response');
    return {messages,cursor:list.nextPageToken as string??null};
  }
  const initial=new URL('https://graph.microsoft.com/v1.0/me/messages');initial.searchParams.set('$top',String(limit));initial.searchParams.set('$select',GRAPH_FIELDS);initial.searchParams.set('$orderby','receivedDateTime desc');
  const url=input.cursor?graphCursor(input.cursor):initial.href;if(!url)fail('invalid_request');
  const list=await json(url,{headers:headers(input.accessToken,true)},256*1024,transport);if(!Array.isArray(list.value)||list.value.length>25)fail('invalid_provider_response');
  return {messages:list.value.map(v=>graphSummary(v as Record<string,unknown>)),cursor:graphCursor(list['@odata.nextLink'])};
}
export type WorkMailRaw=Omit<WorkMailSummary,'receivedAt'>&{receivedAt:string;raw:Buffer;text:string|null;attachments:WorkMailAttachment[]};
function selectedSummary(summary:WorkMailSummary){if(!summary.receivedAt)fail('invalid_provider_response');return {...summary,receivedAt:summary.receivedAt};}
export async function getWorkMailRaw(input:{provider:WorkMailProvider;accessToken:string;messageId:string}&Transport):Promise<WorkMailRaw>{
  provider(input.provider);const transport=operationTransport(input);const message=id(input.messageId),auth={headers:headers(input.accessToken,true)};
  if(input.provider==='gmail'){
    const base=`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message}`;
    const raw=await json(base+'?format=raw&fields=id,raw',auth,Math.ceil(WORK_MAIL_MAX_RAW_BYTES*4/3)+65536,transport);
    const full=await json(base+'?format=full',auth,Math.ceil(WORK_MAIL_MAX_RAW_BYTES*4/3)+65536,transport),parts=gmailParts(full.payload);
    const text=parts.filter(p=>p.mimeType==='text/plain'&&!p.filename&&typeof p.body?.data==='string').map(p=>base64(p.body!.data,WORK_MAIL_MAX_RAW_BYTES).toString('utf8')).join('\n');
    return {...selectedSummary(gmailSummary(full)),raw:base64(raw.raw,WORK_MAIL_MAX_RAW_BYTES),text:text||null,attachments:parts.filter(p=>!!p.filename&&typeof p.partId==='string').map(p=>({id:p.partId===''?'root':p.partId!,name:filename(p.filename),type:mime(p.mimeType),size:typeof p.body?.size==='number'?p.body.size:0}))};
  }
  const base=`https://graph.microsoft.com/v1.0/me/messages/${message}`;
  const meta=await json(base+'?$select='+encodeURIComponent(GRAPH_FIELDS+',body'),auth,256*1024,transport);
  const raw=await request(base+'/$value',auth,WORK_MAIL_MAX_RAW_BYTES,transport);
  const attachments:WorkMailAttachment[]=[];
  { // Include inline files too; Graph's hasAttachments excludes inline-only mail.
    const list=await json(base+'/attachments?$select=id,name,contentType,size&$top=100',auth,256*1024,transport);
    if(!Array.isArray(list.value)||list.value.length>100||list['@odata.nextLink'])fail('attachment_limit');
    for(const attachment of list.value as Array<Record<string,unknown>>){if(attachment['@odata.type']==='#microsoft.graph.fileAttachment'&&typeof attachment.id==='string')attachments.push({id:attachment.id,name:filename(attachment.name),type:mime(attachment.contentType),size:typeof attachment.size==='number'?attachment.size:0});}
  }
  const body=meta.body as {contentType?:string;content?:string}|undefined;
  return {...selectedSummary(graphSummary(meta)),raw:raw.bytes,text:body?.contentType?.toLowerCase()==='text'&&typeof body.content==='string'?body.content:null,attachments};
}
export async function getWorkMailAttachment(input:{provider:WorkMailProvider;accessToken:string;messageId:string;attachmentId:string}&Transport):Promise<{bytes:Buffer;name:string;type:string;size:number}>{
  provider(input.provider);const transport=operationTransport(input);const message=id(input.messageId),auth={headers:headers(input.accessToken,true)};
  if(input.provider==='gmail'){
    if(!/^(?:root|\d+(?:\.\d+)*)$/.test(input.attachmentId)||input.attachmentId.length>80)fail('invalid_attachment');
    const base=`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message}`,full=await json(base+'?format=full',auth,Math.ceil(WORK_MAIL_MAX_RAW_BYTES*4/3)+65536,transport);
    const part=gmailParts(full.payload).find(p=>p.partId===(input.attachmentId==='root'?'':input.attachmentId)&&p.filename);if(!part)fail('attachment_unavailable');
    if(typeof part.body?.size==='number'&&part.body.size>WORK_MAIL_MAX_ATTACHMENT_BYTES)fail('message_too_large');
    const payload=part.body?.attachmentId?await json(base+'/attachments/'+id(part.body.attachmentId),auth,Math.ceil(WORK_MAIL_MAX_ATTACHMENT_BYTES*4/3)+65536,transport):part.body;
    const bytes=base64(payload?.data,WORK_MAIL_MAX_ATTACHMENT_BYTES);return {bytes,name:filename(part.filename),type:mime(part.mimeType),size:bytes.length};
  }
  const base=`https://graph.microsoft.com/v1.0/me/messages/${message}/attachments/${id(input.attachmentId)}`;
  const meta=await json(base+'?$select=id,name,contentType,size',auth,65536,transport);
  if(meta['@odata.type']!=='#microsoft.graph.fileAttachment')fail('unsupported_attachment');
  if(typeof meta.size==='number'&&meta.size>WORK_MAIL_MAX_ATTACHMENT_BYTES)fail('message_too_large');
  const raw=await request(base+'/$value',auth,WORK_MAIL_MAX_ATTACHMENT_BYTES,transport);return {bytes:raw.bytes,name:filename(meta.name),type:mime(meta.contentType),size:raw.bytes.length};
}
/** Microsoft has no per-token revoke endpoint at Mail.Read scope. Do not call
 * revokeSignInSessions: it needs broader rights and affects other applications. */
export async function revokeWorkMailToken(input:{provider:WorkMailProvider;refreshToken?:string;tokens?:WorkMailTokenSet}&Transport):Promise<{remoteRevoked:boolean;manualRequired:boolean;manageUrls:string[]}>{
  provider(input.provider);const refreshToken=input.refreshToken??input.tokens?.refreshToken;if(!tokenString(refreshToken))fail('invalid_token');
  if(input.provider==='microsoft')return {remoteRevoked:false,manualRequired:true,manageUrls:['https://account.live.com/consent/Manage','https://myaccount.microsoft.com/permissions']};
  // Google revokes the entire project's previously granted scopes for this user.
  await request('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:refreshToken}).toString()},65536,input);
  return {remoteRevoked:true,manualRequired:false,manageUrls:['https://myaccount.google.com/connections']};
}
