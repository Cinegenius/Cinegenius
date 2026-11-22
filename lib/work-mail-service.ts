import 'server-only';
import {randomUUID} from 'node:crypto';
import {WORK_MAIL_LIMITS,WorkMailError,workMailDomain,workMailHash,workMailAttachmentId,workMailAttachmentList,workMailText,type WorkMailProvider,type WorkMailSource} from './work-mail';
import {workMailRPC,workMailStoreBytes,workMailStoragePath,workMailLoadBytes,type WorkMailConnection,type WorkMailRecord} from './work-mail-store';
import {workMailProviderConfig,sealWorkMailToken,unsealWorkMailToken,refreshWorkMailToken,listWorkMailMessages,getWorkMailRaw,getWorkMailAttachment,revokeWorkMailToken} from './work-mail-oauth';
import {getWorkMailResendAttachment} from './work-mail-resend';

export function workMailCapabilities(schema:boolean,env:NodeJS.ProcessEnv=process.env) {
 const active=env.WORK_MAIL_ENABLED==='1';
 const forwarding=!!(schema&&active&&workMailDomain(env)&&env.WORK_MAIL_RESEND_API_KEY&&env.WORK_MAIL_RESEND_WEBHOOK_SECRET);
 const enabled=(provider:WorkMailProvider)=>{try{workMailProviderConfig(provider,env);const key=env.WORK_MAIL_ENCRYPTION_KEY??'';return schema&&active&&/^[A-Za-z0-9+/]{43}=$/.test(key)&&Buffer.from(key,'base64').length===32;}catch{return false;}};
 return {archive:schema,forwarding,gmail:enabled('gmail'),microsoft:enabled('microsoft')};
}
export async function workMailConnectionToken(owner:string,id:string) {
 let connection=await workMailRPC<WorkMailConnection>(owner,'connection_get',{connectionId:id});
 if(!workMailCapabilities(true)[connection.provider])throw new WorkMailError();
 const context={accountId:owner,provider:connection.provider,connectionId:connection.id};
 if(connection.owner_id!==owner)throw new WorkMailError('notFound',404);
 let tokens=unsealWorkMailToken(connection.encrypted_tokens,context);
 if(tokens.expiresAt>Date.now()+60_000)return {connection,tokens};
 const claim=randomUUID();
 await workMailRPC(owner,'refresh_claim',{connectionId:id,revision:connection.revision,claim});
 try {
  tokens=await refreshWorkMailToken({provider:connection.provider,tokens});
  const encryptedTokens=sealWorkMailToken(tokens,context);
  await workMailRPC(owner,'refresh_commit',{connectionId:id,claim,encryptedTokens,expiresAt:new Date(tokens.expiresAt).toISOString()});
  connection={...connection,revision:connection.revision+1,encrypted_tokens:encryptedTokens};
  return {connection,tokens};
 }catch(cause){await workMailRPC(owner,'refresh_release',{connectionId:id,claim}).catch(()=>{});throw cause;}
}
export async function workMailListProvider(owner:string,id:string,cursor?:string) {
 const {connection,tokens}=await workMailConnectionToken(owner,id);
 if(!workMailCapabilities(true)[connection.provider])throw new WorkMailError();
 return listWorkMailMessages({provider:connection.provider,accessToken:tokens.accessToken,cursor,limit:10});
}
export async function workMailPersistSource(owner:string,source:WorkMailRecord['source'],providerId:string,connectionId:string|null,value:WorkMailSource) {
 if(!value.raw.length||value.raw.length>WORK_MAIL_LIMITS.rawBytes)throw new WorkMailError('tooLarge',413);
 const attachments=workMailAttachmentList(value.attachments);
 const externalKey=workMailHash(`${source}:${connectionId??'receiving'}:${providerId}`),hash=workMailHash(value.raw);
 const item=await workMailRPC<WorkMailRecord>(owner,'item_reserve',{source,providerId,connectionId,externalKey,subject:workMailText(value.subject,500),from:workMailText(value.from,500),receivedAt:value.receivedAt,text:value.text===null?null:workMailText(value.text,200_000),attachments,size:value.raw.length,sha256:hash});
 if(item.owner_id!==owner)throw new WorkMailError('notFound',404);
 if(item.status!=='ready'){
  await workMailStoreBytes(workMailStoragePath(item),value.raw,hash);
  await workMailRPC(owner,'item_commit',{itemId:item.id,sha256:hash});
 }
 return {id:item.id,sha256:hash,size:value.raw.length};
}
export async function workMailImportProvider(owner:string,connectionId:string,messageId:string) {
 const {connection,tokens}=await workMailConnectionToken(owner,connectionId);
 if(!workMailCapabilities(true)[connection.provider])throw new WorkMailError();
 const externalKey=workMailHash(`${connection.provider}:${connection.id}:${messageId}`);
 const prior=await workMailRPC<WorkMailRecord|null>(owner,'item_find',{source:connection.provider,externalKey});
 if(prior?.status==='ready')return {id:prior.id,sha256:prior.original_hash,size:prior.original_size};
 const mail=await getWorkMailRaw({provider:connection.provider,accessToken:tokens.accessToken,messageId});
 return workMailPersistSource(owner,connection.provider,messageId,connectionId,mail);
}
export async function workMailDisconnect(owner:string,id:string) {
 const connection=await workMailRPC<WorkMailConnection>(owner,'connection_get',{connectionId:id}).catch(cause=>{if(cause instanceof WorkMailError&&cause.status===404)return null;throw cause;});
 if(!connection)return {remoteRevoked:false,manualRequired:true,manageUrls:[]};
 if(connection.owner_id!==owner)throw new WorkMailError('notFound',404);
 let result:{remoteRevoked:boolean;manualRequired:boolean;manageUrls?:string[]}={remoteRevoked:false,manualRequired:true};
 try{const tokens=unsealWorkMailToken(connection.encrypted_tokens,{accountId:owner,provider:connection.provider,connectionId:id});result=await revokeWorkMailToken({provider:connection.provider,tokens});}catch{}
 // Always remove local credentials even if a provider is offline; disclose remote consent separately.
 await workMailRPC(owner,'connection_delete',{connectionId:id});return result;
}
export async function workMailItem(owner:string,id:string) {
 const item=await workMailRPC<WorkMailRecord>(owner,'item_get',{itemId:id});
 if(item.owner_id!==owner)throw new WorkMailError('notFound',404);
 const cached=await workMailRPC<Array<{id:string;size:number;sha256:string}>>(owner,'attachments_list',{itemId:id});
 return {id:item.id,source:item.source,subject:item.subject,from:item.sender,receivedAt:item.received_at,text:item.preview_text,imported:!!item.imported_at,
  original:{name:'original.eml',type:'message/rfc822',size:item.original_size,sha256:item.original_hash,downloadPath:`/api/work/mail/items/${item.id}/file`},
  attachments:item.attachments.map(a=>({id:workMailAttachmentId(a.id),name:a.name,type:a.type,size:a.size,sha256:cached.find(c=>c.id===workMailAttachmentId(a.id))?.sha256,cached:cached.some(c=>c.id===workMailAttachmentId(a.id)),downloadPath:`/api/work/mail/items/${item.id}/file?attachment=${workMailAttachmentId(a.id)}`}))};
}
export async function workMailFile(owner:string,id:string,attachmentKey?:string) {
 const item=await workMailRPC<WorkMailRecord>(owner,'item_get',{itemId:id});
 if(item.owner_id!==owner)throw new WorkMailError('notFound',404);
 if(!attachmentKey)return {bytes:await workMailLoadBytes(workMailStoragePath(item),item.original_size,item.original_hash),name:'original.eml',sha256:item.original_hash};
 const selected=item.attachments.find(a=>workMailAttachmentId(a.id)===attachmentKey);if(!selected)throw new WorkMailError('notFound',404);
 const cached=await workMailRPC<{size:number;sha256:string}|null>(owner,'attachment_get',{itemId:id,attachmentKey});
 const stored=cached?await workMailLoadBytes(workMailStoragePath(item,attachmentKey),cached.size,cached.sha256).catch(()=>null):null;
 if(stored&&cached)return {bytes:stored,name:selected.name,sha256:cached.sha256};
 let file:{bytes:Buffer;name:string;type:string;size:number};
 if(item.source==='inbound'){
  if(!workMailCapabilities(true).forwarding)throw new WorkMailError();
  file=await getWorkMailResendAttachment(item.provider_id,selected.id,process.env.WORK_MAIL_RESEND_API_KEY!);
 }else{
  if(!item.connection_id)throw new WorkMailError('connectionRequired',409);
  const {connection,tokens}=await workMailConnectionToken(owner,item.connection_id).catch(()=>{throw new WorkMailError('connectionRequired',409);});
  if(connection.provider!==item.source||!workMailCapabilities(true)[connection.provider])throw new WorkMailError();
  file=await getWorkMailAttachment({provider:connection.provider,accessToken:tokens.accessToken,messageId:item.provider_id,attachmentId:selected.id});
 }
 if(file.bytes.length!==selected.size||file.bytes.length>WORK_MAIL_LIMITS.attachmentBytes)throw new WorkMailError('providerUnavailable',502);
 const sha256=workMailHash(file.bytes);
 await workMailRPC(owner,'attachment_commit',{itemId:id,attachmentKey,size:file.bytes.length,sha256});
 await workMailStoreBytes(workMailStoragePath(item,attachmentKey),file.bytes,sha256);
 return {bytes:file.bytes,name:selected.name,sha256};
}
