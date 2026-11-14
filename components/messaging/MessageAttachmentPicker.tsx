"use client";
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {useUser} from '@clerk/nextjs';
import {useTranslations} from 'next-intl';
import {Paperclip,RotateCcw,X} from 'lucide-react';
import {compressImage} from '@/lib/compressImage';
import {useExistingDraftProtection} from '@/lib/use-form-draft';
import {MESSAGE_ATTACHMENT_ACCEPT,MAX_MESSAGE_ATTACHMENTS,MAX_MESSAGE_FILE_BYTES,validMessageAttachment,type MessageAttachment} from '@/lib/message-attachments';
type PendingFile={id:string;file:File;progress:number;error:string;started:boolean};

export default function MessageAttachmentPicker({accountId,destination,count,disabled,onUploaded,onPending}:{accountId:string;destination:string;count:number;disabled:boolean;onUploaded:(file:MessageAttachment)=>void;onPending:(pending:boolean)=>void}){
  const t=useTranslations('Messaging'),ui=useTranslations();const {user}=useUser();
  const [files,setFiles]=useState<PendingFile[]>([]),[error,setError]=useState('');
  const input=useRef<HTMLInputElement>(null),requests=useRef(new Map<string,XMLHttpRequest>()),alive=useRef(false),owner=useRef(user?.id),active=useRef(new Set<string>());
  useLayoutEffect(()=>{const pendingRequests=requests.current,pendingIds=active.current;alive.current=true;owner.current=user?.id;return()=>{alive.current=false;owner.current=undefined;for(const request of pendingRequests.values())request.abort();pendingRequests.clear();pendingIds.clear();};},[user?.id]);
  useEffect(()=>{onPending(files.length>0);return()=>onPending(false);},[files.length,onPending]);
  useExistingDraftProtection({value:files.map(({id})=>id),ready:true,busy:files.length>0,enabled:files.length>0,save:async()=>false});
  const stillHere=(id:string)=>alive.current&&owner.current===accountId&&active.current.has(id);
  const update=(id:string,patch:Partial<PendingFile>)=>{if(stillHere(id))setFiles(current=>current.map(file=>file.id===id?{...file,...patch}:file));};
  async function upload(item:PendingFile){
    if(!stillHere(item.id)||requests.current.has(item.id))return;
    update(item.id,{error:'',started:true,progress:0});
    try{
      const image=/\.(jpe?g|png|webp|heic|heif)$/i.test(item.file.name)||item.file.type.startsWith('image/');
      if(!item.file.size||item.file.size>(image?20*1024*1024:MAX_MESSAGE_FILE_BYTES))throw new Error(t('attachmentInvalid'));
      const file=image?await compressImage(item.file,{maxBytes:MAX_MESSAGE_FILE_BYTES,translate:ui}):item.file;
      if(!stillHere(item.id))return;
      const attachment=await new Promise<MessageAttachment>((resolve,reject)=>{
        const xhr=new XMLHttpRequest();requests.current.set(item.id,xhr);
        xhr.open('POST','/api/message-attachments');xhr.timeout=45000;
        xhr.upload.onprogress=event=>{if(event.lengthComputable)update(item.id,{progress:Math.min(99,Math.round(100*event.loaded/event.total))});};
        xhr.onerror=xhr.ontimeout=()=>reject(new Error(t('attachmentUploadError')));xhr.onabort=()=>reject(new Error(t('attachmentUploadError')));
        xhr.onload=()=>{let payload;try{payload=JSON.parse(xhr.responseText)}catch{reject(new Error(t('attachmentUploadError')));return;}
          if(xhr.status>=200&&xhr.status<300&&validMessageAttachment(payload.attachment)&&payload.attachment.id===item.id)resolve(payload.attachment);else reject(new Error(typeof payload.error==='string'?payload.error:t('attachmentUploadError')));};
        const form=new FormData();form.set('id',item.id);form.set('accountId',accountId);form.set('destination',destination);form.set('file',file);xhr.send(form);
      });
      if(stillHere(item.id)){onUploaded(attachment);active.current.delete(item.id);setFiles(current=>current.filter(file=>file.id!==item.id));}
    }catch(cause){update(item.id,{error:cause instanceof Error?cause.message:t('attachmentUploadError'),started:false});}
    finally{requests.current.delete(item.id);}
  }
  function choose(selected:File[]){
    const room=MAX_MESSAGE_ATTACHMENTS-count-files.length;
    if(selected.length>room){setError(t('attachmentLimit'));return;}
    setError('');const pending=selected.map(file=>({id:crypto.randomUUID(),file,progress:0,error:'',started:false}));
    for(const item of pending)active.current.add(item.id);
    setFiles(current=>[...current,...pending]);for(const item of pending)void upload(item);
  }
  function remove(id:string){active.current.delete(id);requests.current.get(id)?.abort();requests.current.delete(id);setFiles(current=>current.filter(file=>file.id!==id));}
  return <div className="mb-2 min-w-0">
    <input ref={input} type="file" multiple accept={MESSAGE_ATTACHMENT_ACCEPT} className="hidden" tabIndex={-1} onChange={event=>{choose(Array.from(event.target.files??[]));event.target.value='';}}/>
    <div className="flex min-w-0 items-center gap-2"><button type="button" disabled={disabled||count+files.length>=MAX_MESSAGE_ATTACHMENTS} onClick={()=>input.current?.click()} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-2 text-xs text-text-secondary hover:text-gold disabled:opacity-40"><Paperclip size={18}/>{t('attachFile')}</button><span className="min-w-0 text-[11px] leading-4 text-text-muted">{t('attachmentHint')}</span></div>
    {files.map(file=><div key={file.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-border px-2"><span className="min-w-0 flex-1 break-words text-xs text-text-secondary [overflow-wrap:anywhere]">{file.file.name}<span role={file.error?'alert':'status'} className="block text-text-muted">{file.error||t('attachmentUploading',{progress:file.progress})}</span></span>{file.error&&<button type="button" aria-label={t('retryUpload')} onClick={()=>void upload(file)} className="flex min-h-11 min-w-11 items-center justify-center text-gold"><RotateCcw size={16}/></button>}<button type="button" aria-label={t('removeAttachment',{name:file.file.name})} onClick={()=>remove(file.id)} className="flex min-h-11 min-w-11 items-center justify-center text-text-muted"><X size={16}/></button></div>)}
    {error&&<p role="alert" className="text-xs text-red-400">{error}</p>}
  </div>;
}
