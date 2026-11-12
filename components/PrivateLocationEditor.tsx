"use client";
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useFormDraft } from '@/lib/use-form-draft';
import FormDraftStatus from '@/components/FormDraftStatus';

type Fields = { address: string; lat: string; lng: string };
const empty: Fields = {address:'',lat:'',lng:''};
/** Exact coordinates never enter public listing metadata or a third-party geocoder. */
export default function PrivateLocationEditor({id,onSaved}:{id:string;onSaved?:()=>void}) {
 const t=useTranslations('locationPrivacy');
 const [value,setValue]=useState<Fields>(empty);
 const [revision,setRevision]=useState(0);
 const [ready,setReady]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [saved,setSaved]=useState(false);
 const [attempt,setAttempt]=useState(0);
 const draft=useFormDraft({formKey:`location-private:${id}`,value,restore:setValue,ready,busy});
 useEffect(()=>{let active=true;
  void fetch(`/api/listings/${id}/private-location`,{cache:'no-store'}).then(async response=>{
   const body=await response.json();if(!response.ok)throw new Error();
   if(active){setRevision(body.revision);setValue(body.value?{address:body.value.address,lat:String(body.value.lat),lng:String(body.value.lng)}:empty);setReady(true);setError('');}
  }).catch(()=>{if(active)setError(t('unavailable'));});
  return ()=>{active=false;};
 },[id,t,attempt]);
 const change=(key:keyof Fields,text:string)=>{draft.resume();setSaved(false);setValue(previous=>({...previous,[key]:text}));};
 const save=async(clear=false)=>{
  if(busy||!ready||!draft.loaded)return;
  if(!clear&&(!value.lat.trim()||!value.lng.trim()||!Number.isFinite(Number(value.lat))||Math.abs(Number(value.lat))>90||!Number.isFinite(Number(value.lng))||Math.abs(Number(value.lng))>180)){setError(t('invalid'));return;}
  setBusy(true);setError('');setSaved(false);
  try{
   const response=await fetch(`/api/listings/${id}/private-location`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,value:clear?null:{address:value.address,lat:Number(value.lat),lng:Number(value.lng)}})});
   const body=await response.json();if(!response.ok)throw new Error(body.error||t('unavailable'));
   setRevision(body.revision);if(clear)setValue(empty);setSaved(true);await draft.complete();onSaved?.();
  }catch(cause){setError(cause instanceof Error?cause.message:t('unavailable'));}finally{setBusy(false);}
 };
 return <section className="my-4 space-y-3 rounded-xl border border-border bg-bg-secondary p-4 text-left">
  <h3 className="text-sm font-semibold text-text-primary">{t('title')}</h3>
  <p className="text-xs leading-5 text-text-muted">{t('notice')}</p>
  {ready&&<><FormDraftStatus draft={draft}/><label className="block text-xs text-text-secondary">{t('address')}<input disabled={busy||!draft.loaded} maxLength={500} value={value.address} onChange={e=>change('address',e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3"/></label>
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{(['lat','lng'] as const).map(key=><label key={key} className="text-xs text-text-secondary">{t(key)}<input disabled={busy||!draft.loaded} type="number" inputMode="decimal" step="any" min={key==='lat'?-90:-180} max={key==='lat'?90:180} value={value[key]} onChange={e=>change(key,e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3"/></label>)}</div>
  <p className="text-xs text-text-muted">{t('coordinatesHelp')}</p>
  <div className="flex flex-wrap gap-3"><button type="button" disabled={busy||!draft.loaded} onClick={()=>void save()} className="min-h-11 rounded-lg bg-gold px-3 text-sm font-medium text-bg-primary disabled:opacity-50">{t('save')}</button><button type="button" disabled={busy||!draft.loaded} onClick={()=>void save(true)} className="min-h-11 px-3 text-sm text-text-secondary disabled:opacity-50">{t('clear')}</button></div></>}
  {!ready&&!error&&<p role="status" className="text-xs text-text-muted">{t('loading')}</p>}
  {error&&<><p role="alert" className="text-xs text-red-300">{error}</p><button type="button" onClick={()=>{setSaved(false);setAttempt(n=>n+1);}} className="min-h-11 text-sm text-gold">{t('reload')}</button></>}
  {saved&&<p role="status" className="text-xs text-text-secondary">{t('saved')}</p>}
 </section>;
}
