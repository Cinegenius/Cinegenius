export const MAX_MESSAGE_ATTACHMENTS = 5;
export const MAX_MESSAGE_FILE_BYTES = 4 * 1024 * 1024;
export const MESSAGE_ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,.pdf,.txt,.docx';
export type MessageAttachment = {id:string;url:string;name:string;mime:string;size:number};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const mimeTypes=new Set(['image/jpeg','image/png','image/webp','application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
export function attachmentIds(value: unknown): string[] | null {
  if(value===undefined)return [];
  return Array.isArray(value)&&value.length<=MAX_MESSAGE_ATTACHMENTS&&value.every(id=>typeof id==='string'&&uuid.test(id))&&new Set(value).size===value.length?value:null;
}
export function validMessageAttachment(value:unknown):value is MessageAttachment {
  if(!value||typeof value!=='object')return false;
  const a=value as MessageAttachment;
  return typeof a.id==='string'&&uuid.test(a.id)&&typeof a.name==='string'&&a.name.length>0&&a.name.length<=180&&mimeTypes.has(a.mime)&&Number.isInteger(a.size)&&a.size>0&&a.size<=MAX_MESSAGE_FILE_BYTES&&typeof a.url==='string'&&
    (a.mime.startsWith('image/') ? /^\/api\/media\/[A-Za-z0-9_-]{1,128}\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(a.url) : a.url===`/api/message-attachments/${a.id}`);
}
export function restoredAttachments(value:unknown):MessageAttachment[]|null {
  if(value===undefined)return [];
  return Array.isArray(value)&&value.length<=MAX_MESSAGE_ATTACHMENTS&&value.every(validMessageAttachment)&&new Set(value.map(a=>a.id)).size===value.length?value.map(({id,url,name,mime,size})=>({id,url,name,mime,size})):null;
}
