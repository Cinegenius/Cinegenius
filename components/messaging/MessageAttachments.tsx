"use client";
import {useTranslations} from 'next-intl';
import {Download,FileText} from 'lucide-react';
import ListingImage from '@/components/ListingImage';
import {validMessageAttachment,type MessageAttachment} from '@/lib/message-attachments';

export default function MessageAttachments({attachments=[],supportAccess=false}:{attachments?:MessageAttachment[];supportAccess?:boolean}){
  const t=useTranslations('Messaging');
  return <div className="space-y-2 whitespace-normal" onClick={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}>
    {attachments.filter(validMessageAttachment).map(file=><a key={file.id} href={supportAccess?`/api/admin/support/attachments/${file.id}`:file.url} target="_blank" rel="noopener noreferrer" download={file.mime.startsWith('image/')?undefined:file.name}
      aria-label={t('openAttachment',{name:file.name})} className="block min-h-11 min-w-0 overflow-hidden rounded-lg border border-current/20 bg-bg-primary/10 p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
      {file.mime.startsWith('image/')&&<div className="relative mb-2 aspect-[4/3] w-52 max-w-full overflow-hidden rounded bg-bg-secondary"><ListingImage src={supportAccess?`/api/admin/support/attachments/${file.id}`:file.url} alt={file.name} mediaSize="thumbnail" fill sizes="208px" className="object-contain"/></div>}
      <span className="flex min-w-0 items-center gap-2 text-xs"><FileText size={16} className="shrink-0"/><span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{file.name}</span><Download size={15} className="shrink-0"/></span>
    </a>)}
  </div>;
}
