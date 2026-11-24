import 'server-only';
import {randomUUID} from 'node:crypto';
import {PDFParse} from 'pdf-parse';
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
function workMailDispoSummaryScore(message:{subject:string;from:string;hasAttachments:boolean;receivedAt:string|null}) {
 const text=`${message.subject} ${message.from}`.normalize('NFKC').toLowerCase();let score=0;
 if(/\b(?:dispo|tagesdispo|drehdispo|callsheet|call[ _-]?sheet)\b/u.test(text))score+=30;
 if(/\b(?:aktuell|current|final|heute|today|rev(?:ision)?|v\d+)\b/u.test(text))score+=8;
 if(message.hasAttachments)score+=10;
 if(/\b(?:vorab|vordispo|prelim|preliminary|preview|morgen|tomorrow)\b/u.test(text))score-=12;
 if(/\b(?:rechnung|invoice|angebot|quote|newsletter|werbung|marketing|spam)\b/u.test(text))score-=25;
 return score;
}
export async function workMailImportCurrentDispo(owner:string,connectionId:string) {
 const {connection,tokens}=await workMailConnectionToken(owner,connectionId);
 if(!workMailCapabilities(true)[connection.provider])throw new WorkMailError();
 const listed=await listWorkMailMessages({provider:connection.provider,accessToken:tokens.accessToken,limit:10});
 const candidates=listed.messages.map((message,index)=>({message,index,score:workMailDispoSummaryScore(message)})).sort((a,b)=>b.score-a.score||a.index-b.index);
 const selected=candidates.find(candidate=>candidate.score>=35&&candidate.message.hasAttachments);
 if(!selected)throw new WorkMailError('dispoNotFound',404);
 const imported=await workMailImportProvider(owner,connectionId,selected.message.id);
 return {...imported,matched:{id:selected.message.id,subject:selected.message.subject,from:selected.message.from,receivedAt:selected.message.receivedAt,score:selected.score}};
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
const DISPO_TEXT_LIMIT=250_000,DISPO_PAGE_LIMIT=100;
function workMailAnalysisPages(text:string) {
 const clean=text.normalize('NFC').replace(/\u0000/g,'').slice(0,DISPO_TEXT_LIMIT);
 const chunks=clean.split(/\f|\n-{3,}\s*Page\s+\d+\s*-{3,}\n/iu).slice(0,DISPO_PAGE_LIMIT);
 const pages=(chunks.length?chunks:[clean]).map((value,index)=>({number:index+1,text:value.slice(0,100_000)}));
 if(!pages.some(page=>page.text.trim()))throw new WorkMailError('analysisUnsupported',422);
 return pages;
}
async function workMailPDFPages(bytes:Buffer) {
 if(bytes.length<5||bytes.subarray(0,5).toString('latin1')!=='%PDF-')throw new WorkMailError('analysisUnsupported',422);
 const parser=new PDFParse({data:new Uint8Array(bytes)});
 try{
  const result=await parser.getText({first:DISPO_PAGE_LIMIT,lineEnforce:true});
  const pages=result.pages.slice(0,DISPO_PAGE_LIMIT).map((page,index)=>({number:index+1,text:page.text.normalize('NFC').replace(/\u0000/g,'').slice(0,100_000)}));
  if(!pages.some(page=>page.text.trim()))throw new WorkMailError('analysisUnsupported',422);
  let total=0;
  return pages.map(page=>{const remaining=Math.max(0,DISPO_TEXT_LIMIT-total),text=page.text.slice(0,remaining);total+=text.length;return {...page,text};}).filter(page=>page.text.length||page.number===1);
 }catch(cause){if(cause instanceof WorkMailError)throw cause;throw new WorkMailError('analysisUnsupported',422);}
 finally{await parser.destroy().catch(()=>{});}
}
function workMailCurrentDispoPDF(attachments:WorkMailRecord['attachments']) {
 const pdfs=attachments.filter(a=>a.type.toLowerCase().includes('pdf')||/\.pdf$/iu.test(a.name));
 const score=(name:string)=>{
  const value=name.normalize('NFKC').toLowerCase();let n=0;
  if(/\b(?:dispo|tagesdispo|drehdispo|callsheet|call[ _-]?sheet)\b/u.test(value))n+=20;
  if(/\b(?:aktuell|current|final|heute|today|rev(?:ision)?|v\d+)\b/u.test(value))n+=8;
  if(/\b(?:vorab|vordispo|prelim|preliminary|preview|morgen|tomorrow)\b/u.test(value))n-=15;
  if(/\b(?:anlage|anhang|map|karte|route|parking|crew|cast|kontakt|contact|rechnung|invoice)\b/u.test(value))n-=10;
  return n;
 };
 return pdfs.map((pdf,index)=>({pdf,index,score:score(pdf.name)})).sort((a,b)=>b.score-a.score||a.index-b.index)[0]?.pdf??null;
}
export async function workMailAnalysisDocument(owner:string,id:string) {
 const item=await workMailRPC<WorkMailRecord>(owner,'item_get',{itemId:id});
 if(item.owner_id!==owner)throw new WorkMailError('notFound',404);
 const pdf=workMailCurrentDispoPDF(item.attachments);
 let title=workMailText(item.subject||pdf?.name||'Dispo',200)||'Dispo',pages:{number:number;text:string}[];
 if(pdf){
  const attachmentKey=workMailAttachmentId(pdf.id),file=await workMailFile(owner,id,attachmentKey);
  title=workMailText(pdf.name||item.subject||'Dispo PDF',200)||'Dispo PDF';
  pages=(await workMailPDFPages(file.bytes)).map(page=>({...page,text:`${pdf.name}\n\n${page.text}`.slice(0,100_000)}));
 }else pages=workMailAnalysisPages(item.preview_text??'');
 const text=pages.map(page=>page.text).join('\n\f\n'),sha256=workMailHash(text);
 return {source:pdf?'pdf':'messageText',pdfName:pdf?.name??null,document:{id:randomUUID(),title,sha256,pages}};
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
