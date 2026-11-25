'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '@clerk/nextjs';
import {useTranslations} from 'next-intl';
import {erasureSummary,type ErasureSummary} from '@/lib/account-erasure';

export default function AccountErasurePanel() {
 const {userId,isLoaded}=useAuth();
 return <AccountErasureContent key={userId??'signed-out'} userId={userId??null} isLoaded={isLoaded}/>;
}
function AccountErasureContent({userId,isLoaded}:{userId:string|null;isLoaded:boolean}){
 const t=useTranslations('AccountErasure');
 const current=useRef<string|null>(userId);
 const lock=useRef(false),epoch=useRef(0);
 const [result,setResult]=useState<{account:string;request:ErasureSummary|null}|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const load=useCallback(async()=>{
  if(!userId)return;const account=userId,version=++epoch.current;
  try{
   const response=await fetch('/api/account',{cache:'no-store'}),value=await response.json();
   if(current.current!==account||version!==epoch.current)return;
   if(!response.ok||value.accountId!==account||(value.request!==null&&!erasureSummary(value.request)))throw new Error();
   setError(null);setResult({account,request:value.request});
  }catch{if(current.current===account&&version===epoch.current)setError(account);}
 },[userId]);
 useEffect(()=>{current.current=userId;const timer=setTimeout(()=>void load(),0);return()=>{clearTimeout(timer);current.current=null;};},[load,userId]);
 async function requestDeletion(){
  if(lock.current||!userId||result?.account!==userId||result.request||!window.confirm(t('confirm')))return;
  const account=userId,version=++epoch.current;lock.current=true;setBusy(true);setError(null);
  try{
   const response=await fetch('/api/account',{method:'DELETE',headers:{'X-Account-Id':account}}),value=await response.json();
   if(current.current!==account||version!==epoch.current)return;
   if(response.status!==202||value.accepted!==true||value.accountId!==account||!erasureSummary(value.request))throw new Error();
   setResult({account,request:value.request});
  }catch{if(current.current===account&&version===epoch.current)setError(account);}
  finally{if(current.current===account&&version===epoch.current){lock.current=false;setBusy(false);}}
 }
 const request=result&&result.account===userId?result.request:null;
 return <section className="min-w-0 rounded-xl border border-red-500/30 bg-red-500/5 p-5" aria-labelledby="erasure-title">
  <h3 id="erasure-title" className="mb-2 text-sm font-semibold text-red-400">{t('title')}</h3>
  <p className="mb-4 text-sm leading-relaxed text-text-muted">{t('intro')}</p>
  {request?<div role="status" className="space-y-2 text-sm [overflow-wrap:anywhere]"><p>{t('accepted')}</p><p>{t(`states.${request.state}`)}</p><p>{t('receipt',{id:request.id})}</p></div>:
   <button type="button" onClick={()=>void requestDeletion()} disabled={!isLoaded||!userId||result?.account!==userId||busy} aria-busy={busy} className="min-h-11 rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-400 disabled:opacity-50">{t(busy?'sending':'delete')}</button>}
  {error===userId&&<p role="alert" className="mt-3 text-sm">{t('error')}</p>}
  {(request||error===userId)&&<button type="button" onClick={()=>void load()} disabled={busy} className="mt-3 min-h-11 rounded-lg border border-border px-4 py-2 text-sm">{t('refresh')}</button>}
  {!result&&!error&&<p role="status" className="mt-2 text-sm text-text-muted">{t('loading')}</p>}
  <a href="mailto:hello@cinegenius.co" className="mt-3 inline-flex min-h-11 items-center break-all text-sm underline">hello@cinegenius.co</a>
 </section>;
}
