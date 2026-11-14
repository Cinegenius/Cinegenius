import {NextRequest,NextResponse} from 'next/server';
import {requireAuth} from '@/lib/auth';
import {db} from '@/lib/db';
import {MESSAGING_HEADERS,messagingUuid} from '@/lib/messaging-backend';
const headers={...MESSAGING_HEADERS,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Cross-Origin-Resource-Policy':'same-origin'};
export const runtime='nodejs';
export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const caller=await requireAuth();if(caller instanceof NextResponse)return caller;
  const {id}=await params;if(!messagingUuid(id))return new NextResponse(null,{status:404,headers});
  try{
    const {data,error}=await db.rpc('readable_message_attachment',{p_id:id,p_viewer:caller.userId});
    if(error)return new NextResponse(null,{status:503,headers});
    const row=Array.isArray(data)?data[0]:data;
    if(!row||row.id!==id||String(row.mime_type).startsWith('image/'))return new NextResponse(null,{status:404,headers});
    const file=await db.storage.from('message-documents').download(row.storage_path);
    if(file.error||!file.data)return new NextResponse(null,{status:503,headers});
    return new NextResponse(new Uint8Array(await file.data.arrayBuffer()),{headers:{...headers,'Content-Type':row.mime_type,'Content-Disposition':`attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(row.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`}});
  }catch{return new NextResponse(null,{status:503,headers});}
}
