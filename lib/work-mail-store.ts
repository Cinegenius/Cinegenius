import 'server-only';
import {db} from '@/lib/db';
import {WorkMailError,WORK_MAIL_LIMITS,workMailHash,workMailAccount,workMailUuid,type WorkMailAttachment} from './work-mail';
export type WorkMailRecord={id:string;owner_id:string;source:'inbound'|'gmail'|'microsoft';external_key:string;provider_id:string;connection_id:string|null;subject:string;sender:string;received_at:string;preview_text:string|null;attachments:WorkMailAttachment[];original_size:number;original_hash:string;status:'pending'|'ready';imported_at:string|null;created_at:string};
export type WorkMailConnection={id:string;owner_id:string;provider:'gmail'|'microsoft';encrypted_tokens:string;expires_at:string;revision:number};
export async function workMailRPC<T=Record<string,unknown>>(owner:string,action:string,p:Record<string,unknown>={}):Promise<T> {
 const {data,error}=await db.rpc('work_mail_v1',{p_actor:owner,p_action:action,p});
 if(error){const code=error.code==='PT404'?'notFound':error.code==='PT429'?'quota':error.code==='PT409'||error.code==='55P03'?'busy':error.code==='42501'?'notAllowed':error.code==='22023'||error.code==='22P02'?'invalid':'unavailable';throw new WorkMailError(code,code==='notFound'?404:code==='quota'?429:code==='busy'?409:code==='notAllowed'?403:code==='invalid'?400:503);}
 return data as T;
}
export async function workMailResolveAlias(local:string):Promise<string|null> {
 const {data,error}=await db.rpc('work_mail_resolve_alias',{p_local:local});if(error)throw new WorkMailError();return typeof data==='string'?data:null;
}
const bucket='work-mail-private';
export function workMailStoragePath(item:WorkMailRecord,attachmentKey?:string):string {
 if(!workMailAccount(item.owner_id)||!workMailUuid(item.id)||attachmentKey&&!/^[a-f0-9]{64}$/.test(attachmentKey))throw new WorkMailError('invalid',400);
 return `${item.owner_id}/${item.id}/${attachmentKey?'attachments/'+attachmentKey+'.bin':'original.eml'}`;
}
export async function workMailStoreBytes(path:string,bytes:Buffer,hash:string):Promise<void> {
 if(bytes.length>WORK_MAIL_LIMITS.rawBytes||workMailHash(bytes)!==hash)throw new WorkMailError('invalid',400);
 const {error}=await db.storage.from(bucket).upload(path,bytes,{contentType:'application/octet-stream',cacheControl:'0',upsert:false});
 if(!error)return;
 // Lost acknowledgements retry an immutable path; only byte-identical stored data can acknowledge it.
 const existing=await workMailLoadBytes(path,bytes.length,hash).catch(()=>null);
 if(!existing)throw new WorkMailError('saveFailed',503);
}
export async function workMailLoadBytes(path:string,size:number,hash:string):Promise<Buffer> {
 const {data,error}=await db.storage.from(bucket).download(path);
 if(error||!data||data.size!==size||data.size>WORK_MAIL_LIMITS.rawBytes)throw new WorkMailError('saveFailed',503);
 const bytes=Buffer.from(await data.arrayBuffer());if(workMailHash(bytes)!==hash)throw new WorkMailError('saveFailed',503);return bytes;
}
