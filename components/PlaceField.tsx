'use client';
import { useEffect, useId, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { COUNTRY_CODES } from '@/lib/places/countries';
import { countryCode, countryName, placeKey } from '@/lib/places/core';

type CityOption={id:string;name:string;canonicalName:string;regionId:string;region:string;district?:string};
/** The legacy text is a transport/compatibility field only. The server verifies
 * the complete path and stores separate IDs; manual text is always pending. */
export default function PlaceField({value,onChange,id,required=false,onSelection}:{value:string;onChange:(value:string,cityId?:string)=>void;id?:string;required?:boolean;onSelection?:(cityId:string)=>void}) {
 const generated=useId(),base=id??generated,t=useTranslations('Places'),locale=useLocale();
 const parts=value.split(',').map(s=>s.trim()),code=countryCode(parts.at(-1)??'');
 const city=code&&parts.length===1?'':parts[0]??'',region=code?parts.slice(1,-1).join(', '):'';
 const [result,setResult]=useState<{country:string;locale:string;query:string;regions:{id:string;name:string;aliases:string[]}[];cities:CityOption[]}|null>(null),[failed,setFailed]=useState(false),[loading,setLoading]=useState(false);
 const [picked,setPicked]=useState<{id:string;raw:string}|null>(null);
 const current=result?.country===code&&result.locale===locale?result:null;
 const regions=current?.regions??[],cities=current?.query===city?current.cities:[];
 const selectedRegion=regions.find(r=>[r.name,...r.aliases].some(name=>placeKey(name)===placeKey(region)));
 const selectedCity=picked?.raw===value?cities.find(c=>c.id===picked.id):null;
 const countries=useMemo(()=>COUNTRY_CODES.map(value=>({value,label:countryName(value,locale)})).sort((a,b)=>a.label.localeCompare(b.label,locale)),[locale]);
 const emit=(c:string,r:string,s:string)=>{setPicked(null);onChange([s,r,c].join(', '));};
 useEffect(()=>{const controller=new AbortController();const timer=setTimeout(async()=>{
  if(!code){setResult(null);setLoading(false);return;}setLoading(true);setFailed(false);
  try{const params=new URLSearchParams({country:code,region:selectedRegion?.id??'',q:city,locale});const response=await fetch(`/api/places?${params}`,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();if(!controller.signal.aborted)setResult({country:code,locale,query:city,regions:data.regions,cities:data.cities});}
  catch(error){if(!(error instanceof DOMException&&error.name==='AbortError')){setFailed(true);setResult(null);}}
  finally{if(!controller.signal.aborted)setLoading(false);}
 },250);return()=>{clearTimeout(timer);controller.abort();};},[code,city,selectedRegion?.id,locale]);
 const input='min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-secondary px-3 py-2.5 text-sm text-text-primary outline-none focus:border-gold';
 return <fieldset className="min-w-0 space-y-3"><legend className="mb-2 text-sm font-medium text-text-primary">{t('location')}</legend>
 <div><label className="mb-1 block text-sm text-text-secondary" htmlFor={`${base}-country`}>{t('country')}</label><div className="relative"><select id={`${base}-country`} autoComplete="country" required={required} value={code} onChange={e=>emit(e.target.value,'',code?'':city)} className={`${input} appearance-none pr-9`}><option value="">{t('chooseCountry')}</option>{countries.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select><ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"/></div></div>
 {code&&<>{(regions.length>0||region||failed)&&<div><label className="mb-1 block text-sm text-text-secondary" htmlFor={`${base}-region`}>{t(code==='CH'?'canton':['DE','AT'].includes(code)?'state':'region')}</label><input id={`${base}-region`} autoComplete="address-level1" maxLength={100} list={`${base}-regions`} value={selectedRegion?.name??region} onChange={e=>emit(code,e.target.value,'')} className={input}/><datalist id={`${base}-regions`}>{regions.map(r=><option key={r.id} value={r.name}/>)}</datalist><p className="mt-1 text-xs text-text-muted">{t('regionOptional')}</p></div>}
 <div><label className="mb-1 block text-sm text-text-secondary" htmlFor={base}>{t('city')}</label><input id={base} autoComplete="address-level2" required={required} maxLength={100} value={selectedCity?.name??city} onChange={e=>emit(code,region,e.target.value)} aria-describedby={`${base}-help`} className={input}/></div>
 <div role="status" aria-live="polite" className="text-xs text-text-muted">{loading?t('searching'):failed?t('unavailable'):''}</div>
 {cities.length>0&&<div className="max-h-60 overflow-y-auto rounded-xl border border-border bg-bg-primary"><p className="px-3 pt-3 text-xs text-text-muted">{t('suggestions')}</p>{cities.map(c=><button key={c.id} type="button" onClick={()=>{const raw=[c.name,c.region,code].join(', ');setPicked({id:c.id,raw});onChange(raw,c.id);onSelection?.(c.id);}} className="block min-h-11 w-full break-words px-3 py-3 text-left text-sm hover:bg-bg-elevated focus-visible:outline-gold">{[c.name,c.district,c.region].filter(Boolean).join(', ')}</button>)}</div>}
 <p id={`${base}-help`} className="text-xs leading-5 text-text-muted">{t('manualHelp')}</p></>}
 {!code&&value&&<p className="break-words text-xs text-text-muted">{t('legacy',{value})}</p>}
 <p className="text-xs text-text-muted"><a href="https://www.geonames.org/" target="_blank" rel="noreferrer">{t('source')}</a>{' · '}<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">{t('sourceLicense')}</a>{' · '}{t('sourceChanges')}</p>
 </fieldset>;
}
