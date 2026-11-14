import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/requireAdmin';
import {db} from '@/lib/db';
import {MESSAGING_HEADERS,messagingUuid} from '@/lib/messaging-backend';
import {PROTECTED_MEDIA_BUCKET} from '@/lib/protected-media';
const headers={...MESSAGING_HEADERS,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Cross-Origin-Resource-Policy':'same-origin'};
export const runtime='nodejs';
/** Support staff may read only files already sent into a support conversation. */
export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const admin=await requireAdmin();if(admin instanceof NextResponse)return admin;
 const {id}=await params;if(!messagingUuid(id))return new NextResponse(null,{status:404,headers});
 try{
  const {data:file,error}=await db.from('message_attachments').select('storage_path,mime_type,filename,message_id').eq('id',id).maybeSingle();
  if(error)return new NextResponse(null,{status:503,headers});
  if(!file?.message_id)return new NextResponse(null,{status:404,headers});
  const message=await db.from('messages').select('conversation_id').eq('id',file.message_id).maybeSingle();
  if(message.error)return new NextResponse(null,{status:503,headers});
  if(!message.data)return new NextResponse(null,{status:404,headers});
  const thread=await db.from('conversations').select('id').eq('id',message.data.conversation_id).eq('kind','support').maybeSingle();
  if(thread.error)return new NextResponse(null,{status:503,headers});
  if(!thread.data)return new NextResponse(null,{status:404,headers});
  const image=file.mime_type.startsWith('image/');
  const stored=await db.storage.from(image?PROTECTED_MEDIA_BUCKET:'message-documents').download(file.storage_path);
  if(stored.error||!stored.data)return new NextResponse(null,{status:503,headers});
  return new NextResponse(new Uint8Array(await stored.data.arrayBuffer()),{headers:{...headers,'Content-Type':file.mime_type,'Content-Disposition':`${image?'inline':'attachment'}; filename="document"; filename*=UTF-8''${encodeURIComponent(file.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`}});
 }catch{return new NextResponse(null,{status:503,headers});}
}
