'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState,useMemo} from 'react';
import {useUser} from '@clerk/nextjs';
import {useTranslations,useLocale} from 'next-intl';
import {useRouter} from 'next/navigation';
import {useNativeAppAppearance} from '@/lib/use-native-app-appearance';

type Provider='gmail'|'microsoft';
type Summary={id:string;source?:string;subject:string;from:string;receivedAt:string|null;createdAt?:string;imported?:boolean;hasAttachments:boolean};
type File={id?:string;name:string;type:string;size:number;sha256?:string;downloadPath:string};
type Item={id:string;source:string;subject:string;from:string;receivedAt:string;text:string|null;imported:boolean;original:File;attachments:File[]};
type Connection={id:string;provider:Provider;createdAt:string};
type State={accountId:string;capabilities:{archive:boolean;forwarding:boolean;gmail:boolean;microsoft:boolean};alias:{address:string|null;enabled:boolean}|null;connections:Connection[];items:Summary[];cursor:string|null};
const control='min-h-11 min-w-11 rounded-xl border border-border bg-bg-secondary px-3 py-2 text-sm disabled:opacity-40';
const MAIL_ERROR={unavailable:'unavailable',saveFailed:'saveFailed'} as const;
const card='rounded-2xl border border-border bg-bg-primary p-4';

export default function WorkMail({accountId}:{accountId:string}){
 const t=useTranslations('WorkMail'),router=useRouter(),{user,isLoaded}=useUser(),nativeAppearance=useNativeAppAppearance(),locale=useLocale();
 const owner=useRef<string|undefined>(user?.id),epoch=useRef(0),pending=useRef(false),controllers=useRef(new Set<AbortController>());
 const [prepared,setPrepared]=useState<{bytes:ArrayBuffer;name:string}|null>(null);
 const preparedCanShare=useMemo(()=>{if(!prepared)return false;try{return !!navigator.canShare?.({files:[new window.File([prepared.bytes],prepared.name,{type:'application/octet-stream'})]});}catch{return false;}},[prepared]);
 const [state,setState]=useState<State|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[selected,setSelected]=useState<Item|null>(null);
 const [mailbox,setMailbox]=useState<{connection:Connection;messages:Summary[];cursor:string|null}|null>(null),[loading,setLoading]=useState(true);
 const cancelRequests=useCallback(()=>{epoch.current++;const active=controllers.current;for(const c of active)c.abort();active.clear();},[]);
 useLayoutEffect(()=>{owner.current=user?.id;cancelRequests();const current=epoch.current;queueMicrotask(()=>{if(current===epoch.current){setState(null);setSelected(null);setMailbox(null);setPrepared(null);setError('');setNotice('');}});return()=>{owner.current=undefined;cancelRequests();};},[user?.id,cancelRequests]);
 const same=isLoaded&&user?.id===accountId;
 const api=useCallback(async(path='',body?:Record<string,unknown>)=>{
  if(owner.current!==accountId)throw new Error('accountChanged');const controller=new AbortController();controllers.current.add(controller);const timer=setTimeout(()=>controller.abort(),45000),current=epoch.current;
  try{const response=await fetch('/api/work/mail'+path,{method:body?'POST':'GET',cache:'no-store',signal:controller.signal,headers:{'X-Mail-Account':accountId,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify({accountId,...body})}:{})});
   const value=await response.json().catch(()=>({code:'unavailable'}));if(owner.current!==accountId||current!==epoch.current)throw new Error('accountChanged');if(!response.ok)throw new Error(value.code??'unavailable');return value;
  }finally{clearTimeout(timer);controllers.current.delete(controller);}
 },[accountId]);
 const load=useCallback(async()=>{
  if(owner.current!==accountId)return;const current=epoch.current;
  try{const value=await api();if(owner.current===accountId&&epoch.current===current){setState(value);setError('');}}
  catch(cause){if(owner.current===accountId)setError(cause instanceof Error?cause.message:MAIL_ERROR.unavailable);}
  finally{if(owner.current===accountId)setLoading(false);}
 },[accountId,api]);
 useEffect(()=>{let disposed=false;queueMicrotask(()=>{if(same&&!disposed)void load();});return()=>{disposed=true;};},[same,load]);
 useEffect(()=>{const hide=()=>{if(document.visibilityState!=='visible'){epoch.current++;for(const c of controllers.current)c.abort();setState(null);setSelected(null);setMailbox(null);setPrepared(null);}else if(owner.current===accountId)void load();};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[accountId,load]);
 async function run(action:(current:()=>boolean)=>Promise<void>){if(pending.current||owner.current!==accountId)return;pending.current=true;setBusy(true);setError('');setNotice('');const currentEpoch=epoch.current,current=()=>owner.current===accountId&&epoch.current===currentEpoch;try{await action(current);}catch(cause){if(owner.current===accountId)setError(cause instanceof Error?cause.message:MAIL_ERROR.unavailable);}finally{pending.current=false;if(owner.current===accountId)setBusy(false);}}
 async function openItem(id:string){await run(async current=>{const value=await api('?item='+encodeURIComponent(id));if(current())setSelected(value);});}
 async function browse(connection:Connection,cursor?:string){await run(async current=>{const value=await api('?connection='+connection.id+(cursor?'&cursor='+encodeURIComponent(cursor):''));if(!current())return;setMailbox({connection,messages:value.messages,cursor:value.cursor});setSelected(null);});}
 async function download(file:File){await run(async()=>{
  if(!/^\/api\/work\/mail\/items\/[0-9a-f-]{36}\/file(?:\?attachment=[a-f0-9]{64})?$/.test(file.downloadPath))throw new Error('invalid');
  const current=epoch.current,controller=new AbortController();controllers.current.add(controller);const timer=setTimeout(()=>controller.abort(),45000);
  try{const response=await fetch(file.downloadPath,{headers:{'X-Mail-Account':accountId},cache:'no-store',signal:controller.signal});if(!response.ok){const value=await response.json().catch(()=>({}));throw new Error(value.code??'unavailable');}
   const length=Number(response.headers.get('content-length')),hash=response.headers.get('x-content-sha256');if(!Number.isSafeInteger(length)||length<0||length>12*1024*1024||!/^[a-f0-9]{64}$/.test(hash??''))throw new Error('invalid');
   const bytes=await response.arrayBuffer();if(bytes.byteLength!==length||owner.current!==accountId||epoch.current!==current)throw new Error('accountChanged');
   const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');if(actual!==hash||file.sha256&&file.sha256!==hash)throw new Error('invalid');if(owner.current!==accountId||epoch.current!==current)throw new Error('accountChanged');
   setPrepared({bytes,name:file.name});setNotice(t('filePrepared'));
  }finally{clearTimeout(timer);controllers.current.delete(controller);}
 });}
 async function savePrepared(){
  if(!prepared||owner.current!==accountId)return;
  const file=new window.File([prepared.bytes],prepared.name,{type:'application/octet-stream'});
  try{if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file]});if(owner.current===accountId)setPrepared(null);}
   else if(nativeAppearance){setError(MAIL_ERROR.saveFailed);}
   else{const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=prepared.name;link.hidden=true;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}}
  catch(cause){if(owner.current===accountId&&!(cause instanceof DOMException&&cause.name==='AbortError'))setError(MAIL_ERROR.saveFailed);}
 }
 function displayError(value:string){return ['unavailable','invalid','notAllowed','accountChanged','tooLarge','quota','busy','notFound','saveFailed','providerUnavailable','connectionRequired','oauthFailed'].includes(value)?t(value):t('unavailable');}
 if(!same)return <section className="site-container py-6"><p role="status">{t(isLoaded?'accountChanged':'loading')}</p></section>;
 return <section className="site-container space-y-4 py-5 pb-28" aria-busy={busy||loading}>
  <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="font-display text-2xl font-bold">{t('title')}</h1><button className={control} onClick={()=>router.back()}>{t('back')}</button></div>
  <p className="text-sm text-text-secondary">{t('intro')}</p>
  {error&&<p role="alert" className="text-sm text-red-400">{displayError(error)}</p>}{notice&&<p role="status" className="text-sm text-text-secondary">{notice}</p>}
  <button className={control} onClick={()=>void load()} disabled={busy}>{t('refresh')}</button>
  {prepared&&<div className={card}><p className="mb-2 break-all text-sm">{prepared.name}</p><div className="flex flex-wrap gap-2">{nativeAppearance&&!preparedCanShare?<a className={control+' inline-flex items-center'} href="/work/mail" target="_blank" rel="noopener noreferrer">{t('openInBrowser')}</a>:<button className={control} onClick={()=>void savePrepared()}>{t('savePrepared')}</button>}<button className={control} onClick={()=>setPrepared(null)}>{t('cancel')}</button></div></div>}
  {loading&&!state&&<p role="status">{t('loading')}</p>}
  {state&&<>
   <div className="grid min-w-0 gap-4 md:grid-cols-2">
    <section className={card}><h2 className="text-lg font-semibold">{t('forwarding')}</h2><p className="my-2 text-sm text-text-secondary">{t('forwardingHelp')}</p>
     {state.alias?.address&&<p className="my-3 break-all rounded-xl bg-bg-secondary p-3 font-mono text-sm">{state.alias.address}</p>}
     {!state.capabilities.forwarding&&<p className="my-2 text-sm text-text-secondary">{t('setupRequired')}</p>}
     <div className="flex flex-wrap gap-2">
      <button className={control} disabled={busy||!state.capabilities.forwarding} onClick={()=>void run(async()=>{await api('',{action:state.alias?'alias_rotate':'alias_create'});await load();})}>{t(state.alias?'rotateAddress':'createAddress')}</button>
      {state.alias&&<button className={control} disabled={busy||!state.capabilities.forwarding&&!state.alias.enabled} onClick={()=>void run(async()=>{await api('',{action:'alias_toggle',enabled:!state.alias!.enabled});await load();})}>{t(state.alias.enabled?'pauseAddress':'enableAddress')}</button>}
     </div>{state.alias&&<p className="mt-2 text-xs text-text-secondary">{t(state.alias.enabled?'addressActive':'addressPaused')}</p>}
    </section>
    <section className={card}><h2 className="text-lg font-semibold">{t('connectMailbox')}</h2><p className="my-2 text-sm text-text-secondary">{t('connectHelp')}</p>{nativeAppearance&&<p className="my-2 text-sm text-text-secondary">{t('browserConnectionHelp')}</p>}
     {(['gmail','microsoft'] as const).map(provider=>{const connection=state.connections.find(c=>c.provider===provider);return <div key={provider} className="mt-3 space-y-2 border-t border-border pt-3"><p className="font-medium">{t(provider==='gmail'?'providerGmail':'providerMicrosoft')}</p>
      {!state.capabilities[provider]&&<p className="text-sm text-text-secondary">{t('setupRequired')}</p>}
      <div className="flex flex-wrap gap-2">{nativeAppearance&&state.capabilities[provider]&&!busy?<a className={control+" inline-flex items-center"} href="/work/mail" target="_blank" rel="noopener noreferrer">{t('openInBrowser')}</a>:<button className={control} disabled={busy||!state.capabilities[provider]||nativeAppearance} onClick={()=>void run(async current=>{const value=await api('',{action:'connect',provider});if(!current())return;const url=new URL(value.url);if(!['https://accounts.google.com','https://login.microsoftonline.com'].includes(url.origin))throw new Error('invalid');window.location.assign(url.href);})}>{t(connection?'reconnect':'connect')}</button>}
       {connection&&<><button className={control} disabled={busy||!state.capabilities[provider]} onClick={()=>void browse(connection)}>{t('chooseMessages')}</button><button className={control} disabled={busy} onClick={()=>void run(async current=>{const result=await api('',{action:'disconnect',connectionId:connection.id});if(!current())return;setMailbox(null);setNotice(t(result.remoteRevoked?'disconnected':'disconnectedManual'));await load();})}>{t('disconnect')}</button></>}
      </div>{connection&&<p className="text-xs text-text-secondary">{t(provider==='gmail'?'googleRevokeHelp':'microsoftRevokeHelp')}</p>}
     </div>;})}
    </section>
   </div>
   {mailbox&&<section className={card}><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{t('chooseMessages')}</h2><button className={control} onClick={()=>setMailbox(null)}>{t('close')}</button></div><p className="my-2 text-sm text-text-secondary">{t('selectionHelp')}</p>
    <ul className="divide-y divide-border">{mailbox.messages.map(message=><li key={message.id} className="flex min-w-0 flex-wrap items-start gap-3 py-3"><div className="min-w-0 flex-1 basis-full break-words sm:basis-0"><p className="font-medium">{message.subject||t('noSubject')}</p><p className="break-all text-sm text-text-secondary">{message.from}</p>{message.receivedAt&&<time className="text-xs text-text-secondary">{new Date(message.receivedAt).toLocaleString(locale)}</time>}</div><button className={control} disabled={busy} onClick={()=>void run(async current=>{const result=await api('',{action:'import_provider',connectionId:mailbox.connection.id,messageId:message.id});await load();const value=await api('?item='+result.id);if(!current())return;setSelected(value);setNotice(t('imported'));})}>{t('importSelected')}</button></li>)}</ul>
    {!mailbox.messages.length&&<p className="py-3 text-sm">{t('emptyMailbox')}</p>}{mailbox.cursor&&<button className={control} disabled={busy} onClick={()=>void browse(mailbox.connection,mailbox.cursor??undefined)}>{t('nextMessages')}</button>}
   </section>}
   <section className={card}><h2 className="text-lg font-semibold">{t('privateArchive')}</h2><p className="my-2 text-sm text-text-secondary">{t('archiveHelp')}</p>
    {!state.capabilities.archive&&<p className="text-sm text-text-secondary">{t('setupRequired')}</p>}
    <ul className="divide-y divide-border">{state.items.map(item=><li key={item.id}><button className="w-full min-w-0 rounded-xl px-1 py-3 text-left disabled:opacity-40" disabled={busy} onClick={()=>void openItem(item.id)}><span className="block break-words font-medium">{item.subject||t('noSubject')}</span><span className="block break-all text-sm text-text-secondary">{item.from}</span><span className="block text-xs text-text-secondary">{t(item.imported?'imported':'received')} · {item.source==='inbound'?t('forwarding'):t(item.source==='gmail'?'providerGmail':'providerMicrosoft')}</span></button></li>)}</ul>
    {!state.items.length&&state.capabilities.archive&&<p className="py-3 text-sm">{t('emptyArchive')}</p>}
    {state.cursor&&<button className={control} disabled={busy} onClick={()=>void run(async current=>{const value=await api('?cursor='+encodeURIComponent(state.cursor!));if(!current())return;setState(current=>current?{...value,items:[...current.items,...value.items]}:value);})}>{t('more')}</button>}
   </section>
  </>}
  {selected&&<section className={card} aria-label={t('messageDetails')}><div className="flex flex-wrap items-start justify-between gap-2"><h2 className="min-w-0 break-words text-lg font-semibold">{selected.subject||t('noSubject')}</h2><button className={control} onClick={()=>setSelected(null)}>{t('close')}</button></div><p className="my-2 break-all text-sm text-text-secondary">{selected.from}</p><p className="text-xs text-text-secondary">{t('externalSource')}</p>
   {selected.text?<pre className="my-4 whitespace-pre-wrap break-words font-sans text-sm">{selected.text}</pre>:<p className="my-4 text-sm text-text-secondary">{t('noPlainText')}</p>}
   {!selected.imported&&<button className={control} disabled={busy} onClick={()=>void run(async current=>{await api('',{action:'import_inbound',itemId:selected.id});if(!current())return;setSelected({...selected,imported:true});setNotice(t('imported'));await load();})}>{t('importSelected')}</button>}
   <p className="my-3 text-sm text-text-secondary">{t('downloadHelp')}</p><button className={control} disabled={busy} onClick={()=>void download(selected.original)}>{t('downloadOriginal')}</button>
   {!!selected.attachments.length&&<><h3 className="mt-4 font-semibold">{t('attachments')}</h3><ul className="divide-y divide-border">{selected.attachments.map(file=><li key={file.id} className="flex min-w-0 flex-wrap items-center gap-2 py-3"><span className="min-w-0 flex-1 basis-full break-all text-sm sm:basis-0">{file.name} · {Math.ceil(file.size/1024)} KB</span><button className={control} disabled={busy} onClick={()=>void download(file)}>{t('downloadSelected')}</button></li>)}</ul></>}
  </section>}
 </section>;
}
