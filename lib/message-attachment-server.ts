import 'server-only';
import {db} from '@/lib/db';
import type {MessageAttachment} from '@/lib/message-attachments';
export const ATTACHMENT_FIELDS='id,reference_url,filename,mime_type,byte_size,message_id';
export function publicAttachment(row:Record<string,unknown>):MessageAttachment {
  return {id:String(row.id),url:String(row.reference_url),name:String(row.filename),mime:String(row.mime_type),size:Number(row.byte_size)};
}
/** Call only after authorizing the exact message page, including join-time history. */
export async function attachMessageFiles<T extends {id:string}>(messages:T[]):Promise<(T&{attachments:MessageAttachment[]})[]> {
  if(!messages.length)return [];
  const {data,error}=await db.from('message_attachments').select(ATTACHMENT_FIELDS).in('message_id',messages.map(m=>m.id));
  if(error)throw new Error('Message files unavailable');
  const grouped=new Map<string,MessageAttachment[]>();
  for(const row of data??[]){const list=grouped.get(row.message_id)??[];list.push(publicAttachment(row));grouped.set(row.message_id,list);}
  return messages.map(message=>({...message,attachments:grouped.get(message.id)??[]}));
}
