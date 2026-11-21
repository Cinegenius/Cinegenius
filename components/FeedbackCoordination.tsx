'use client';
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useAuth} from '@clerk/nextjs';
import {useLocale,useTranslations} from 'next-intl';
import BrowseSelect from '@/components/BrowseSelect';
import {COUNTRY_CODES} from '@/lib/places/countries';
import {LANGUAGE_OPTIONS} from '@/lib/i18n/locales';
type Item={id:string;conversationId:string;name:string;title:string;country:string;locale:string;createdAt:string};
export default function FeedbackCoordination({accountId}:{accountId:string}) {
  const t=useTranslations('Feedback'),s=useTranslations('SupportContact'),locale=useLocale();
  const {userId,isLoaded}=useAuth(),sameAccount=isLoaded&&userId===accountId;
  const current=useRef(userId), paginationRequest=useRef<AbortController|null>(null);
  useLayoutEffect(()=>{current.current=userId;return()=>{current.current=undefined;paginationRequest.current?.abort();};},[userId]);
  const [country,setCountry]=useState('MX'),[language,setLanguage]=useState('es'),[link,setLink]=useState(''),[copied,setCopied]=useState(false);
  const [items,setItems]=useState<Item[]>([]),[next,setNext]=useState<string|null>(null),[loadingMore,setLoadingMore]=useState(false),[error,setError]=useState('');
  const [attempt,setAttempt]=useState(0);
  const [settledAttempt,setSettledAttempt]=useState(-1);
  const busy=settledAttempt!==attempt || loadingMore;
  const names=useMemo(()=>new Intl.DisplayNames([locale],{type:'region'}),[locale]);
  const countries=useMemo(()=>COUNTRY_CODES.map(value=>({value,label:names.of(value)||value})).sort((a,b)=>a.label.localeCompare(b.label,locale)),[names,locale]);
  const load=useCallback((cursor:string|null,signal:AbortSignal,requestedAttempt:number)=>{
    return fetch('/api/admin/feedback'+(cursor?'?before='+encodeURIComponent(cursor):''),{cache:'no-store',headers:{'X-Feedback-Account':accountId},signal:AbortSignal.any([signal,AbortSignal.timeout(15_000)])})
    .then(async response=>{
      const data=await response.json();
      if(!response.ok||!Array.isArray(data.items))throw Error();
      return data;
    }).then(data=>{
      if(signal.aborted||current.current!==accountId)return;
      setItems(old=>cursor?[...new Map([...old,...data.items].map(item=>[item.id,item])).values()]:data.items);setNext(data.next);setError('');
    }).catch(()=>{if(!signal.aborted&&current.current===accountId)setError(s('sendError'));})
    .finally(()=>{if(!signal.aborted&&current.current===accountId){setSettledAttempt(requestedAttempt);setLoadingMore(false);}});
  },[accountId,s]);
  useEffect(()=>{if(!sameAccount)return;const controller=new AbortController();void load(null,controller.signal,attempt);return()=>controller.abort();},[sameAccount,load,attempt]);
  async function copy() {
    const url=new URL('/mitgestalten',window.location.origin);url.searchParams.set('lang',language);url.searchParams.set('country',country);
    setLink(url.toString());setCopied(false);
    try{await navigator.clipboard.writeText(url.toString());if(current.current===accountId)setCopied(true);}catch{/* A selectable link remains available. */}
  }
  if(!sameAccount)return <p role="status">{s(isLoaded?'accountChanged':'loading')}</p>;
  return <section className="mx-auto max-w-3xl space-y-6">
    <Link href="/mitgestalten" className="inline-flex min-h-11 items-center text-sm text-text-muted">{t('back')}</Link>
    <details className="rounded-2xl border border-border bg-bg-secondary p-4"><summary className="min-h-11 cursor-pointer py-3 font-medium">{t('invitation')}</summary>
      <div className="grid gap-3 sm:grid-cols-2"><BrowseSelect label={t('country')} value={country} options={countries} onChange={v=>{setCountry(v);setLink('');setCopied(false);}} />
      <BrowseSelect label={t('language')} value={language} options={LANGUAGE_OPTIONS.map(l=>({value:l.code,label:l.label}))} onChange={v=>{setLanguage(v);setLink('');setCopied(false);}} /></div>
      <button type="button" onClick={()=>void copy()} className="mt-3 min-h-11 rounded-xl border border-border px-4 text-sm text-gold">{t(copied?'copied':'copy')}</button>
      {link&&<input aria-label={t('invitation')} readOnly value={link} onFocus={e=>e.target.select()} className="mt-3 min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-primary p-3 text-sm" />}
    </details>
    <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{t('overview')}</h2><button type="button" disabled={busy} onClick={()=>setAttempt(v=>v+1)} className="min-h-11 px-3 text-sm text-text-muted">{t('refresh')}</button></div>
    {!busy&&error&&<p role="alert">{error}</p>}
    {!busy&&!error&&!items.length&&<p className="text-sm text-text-muted">{t('empty')}</p>}
    {items.map(item=><article key={item.id} className="rounded-xl border border-border bg-bg-secondary p-4 space-y-2">
      <p className="text-sm text-text-muted">{item.name} · {item.country?names.of(item.country):t('countryNone')} · {new Intl.DateTimeFormat(locale,{dateStyle:'medium'}).format(new Date(item.createdAt))}</p>
      <h3 className="break-words font-medium">{item.title}</h3>
      <Link href={'/admin?supportThread='+encodeURIComponent(item.conversationId)} className="inline-flex min-h-11 items-center text-sm text-gold">{s('openConversation')}</Link>
    </article>)}
    {busy&&<p role="status">{s('loading')}</p>}
    {next&&<button type="button" disabled={busy} className="min-h-11 rounded-xl border border-border px-4 text-sm" onClick={()=>{paginationRequest.current?.abort();const controller=new AbortController();paginationRequest.current=controller;setLoadingMore(true);void load(next,controller.signal,attempt);}}>{t('more')}</button>}
  </section>;
}
