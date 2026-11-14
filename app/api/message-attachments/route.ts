import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {getTranslations} from 'next-intl/server';
import {requireAuth} from '@/lib/auth';
import {db} from '@/lib/db';
import {rateLimit} from '@/lib/rateLimit';
import {storeProtectedMedia} from '@/lib/protected-media-server';
import {attachmentFilename,prepareMessageAttachment} from '@/lib/message-attachment-files';
import {MAX_MESSAGE_FILE_BYTES} from '@/lib/message-attachments';
import {publicAttachment} from '@/lib/message-attachment-server';
import {MESSAGING_HEADERS,messagingUuid} from '@/lib/messaging-backend';
export const runtime='nodejs';

export async function POST(request:NextRequest){
  const caller=await requireAuth();if(caller instanceof NextResponse)return caller;
  const t=await getTranslations('Messaging'),fail=(key:string,status:number)=>NextResponse.json({error:t(key)},{status,headers:MESSAGING_HEADERS});
  if(Number(request.headers.get('content-length'))>MAX_MESSAGE_FILE_BYTES+64000)return fail('attachmentInvalid',413);
  if(!(await rateLimit(`message-file:${caller.userId}`,25,60)).allowed)return fail('attachmentUploadError',429);
  try{
    const form=await request.formData(),file=form.get('file'),id=form.get('id'),destination=form.get('destination');
    if(form.get('accountId')!==caller.userId)return fail('wrongTarget',403);
    if(!(file instanceof File)||!file.size||file.size>MAX_MESSAGE_FILE_BYTES||!messagingUuid(id)||typeof destination!=='string'||destination.length>150)return fail('attachmentInvalid',400);
    const access=await db.rpc('message_attachment_target',{p_actor:caller.userId,p_destination:destination});
    if(access.error)return fail('attachmentUploadError',503);
    if(access.data!==true)return fail('wrongTarget',403);
    const filename=attachmentFilename(file.name),prepared=await prepareMessageAttachment(Buffer.from(await file.arrayBuffer()),filename);
    const sha=createHash('sha256').update(prepared.bytes).digest('hex');
    const previous=await db.from('message_attachments').select('*').eq('id',id).maybeSingle();
    if(previous.error)return fail('attachmentUploadError',503);
    const same=(row:Record<string,unknown>)=>row.owner_user_id===caller.userId&&row.destination_key===destination&&row.content_sha256===sha&&row.filename===filename;
    if(previous.data){if(!same(previous.data)||previous.data.message_id)return fail('wrongTarget',409);return NextResponse.json({attachment:publicAttachment(previous.data)},{headers:MESSAGING_HEADERS});}
    const path=`${caller.userId}/${id.replaceAll('-','')}.${prepared.extension}`;
    let url:string;
    if(prepared.mime.startsWith('image/')){
      url=await storeProtectedMedia(caller.userId,path,new Uint8Array(prepared.bytes).buffer,prepared.mime);
    }else{
      const bucket=db.storage.from('message-documents'),saved=await bucket.upload(path,prepared.bytes,{contentType:prepared.mime,cacheControl:'0',upsert:false});
      if(saved.error){const existing=await bucket.download(path);if(existing.error||!existing.data||createHash('sha256').update(Buffer.from(await existing.data.arrayBuffer())).digest('hex')!==sha)return fail('attachmentUploadError',503);}
      url=`/api/message-attachments/${id}`;
    }
    const row={id,owner_user_id:caller.userId,destination_key:destination,reference_url:url,storage_path:path,mime_type:prepared.mime,filename,byte_size:prepared.bytes.length,content_sha256:sha};
    const saved=await db.from('message_attachments').insert(row);
    if(saved.error){const confirmed=await db.from('message_attachments').select('*').eq('id',id).maybeSingle();if(confirmed.error||!confirmed.data||!same(confirmed.data)||confirmed.data.message_id)return fail('attachmentUploadError',503);}
    return NextResponse.json({attachment:publicAttachment(row)},{headers:MESSAGING_HEADERS});
  }catch(cause){return fail(cause instanceof Error&&cause.message==='attachmentInvalid'?'attachmentInvalid':'attachmentUploadError',cause instanceof Error&&cause.message==='attachmentInvalid'?400:503);}
}
