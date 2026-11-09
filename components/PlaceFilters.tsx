'use client';
import {useId,useEffect,useState} from 'react';
import {useLocale,useTranslations} from 'next-intl';
import {ChevronDown} from 'lucide-react';
import {placeOptions} from '@/lib/places/core';
export type PlaceFilterValue={country:string;region:string;city:string};
export const EMPTY_PLACE_FILTERS:PlaceFilterValue={country:'',region:'',city:''};
export default function PlaceFilters({rows:initialRows,value,onChange,scope}:{rows:object[];value:PlaceFilterValue;onChange:(value:PlaceFilterValue)=>void;scope?:"marketplace"|"locations"}){
 const locale=useLocale(),t=useTranslations('Places'),id=useId();
 const [remoteRows,setRemoteRows]=useState<{key:string;rows:object[]}|null>(null);
 const requestKey=`${scope??''}:${locale}`;
 useEffect(()=>{if(!scope)return;const controller=new AbortController();const params=new URLSearchParams({scope,locale});fetch(`/api/places/options?${params}`,{signal:controller.signal}).then(async response=>{if(response.ok){const data=await response.json();if(!controller.signal.aborted)setRemoteRows({key:requestKey,rows:data.rows});}}).catch(()=>{});return()=>controller.abort();},[scope,locale,requestKey]);
 const rows=remoteRows?.key===requestKey?remoteRows.rows:initialRows;
 return <div className="grid min-w-0 gap-3 sm:grid-cols-3">{(['country','region','city'] as const).map(kind=><div key={kind} className="min-w-0"><label htmlFor={`${id}-${kind}`} className="mb-1 block text-xs text-text-muted">{t(kind)}</label><div className="relative"><select id={`${id}-${kind}`} value={value[kind]} onChange={e=>onChange(kind==='country'?{country:e.target.value,region:'',city:''}:kind==='region'?{...value,region:e.target.value,city:''}:{...value,city:e.target.value})} className="min-h-11 w-full min-w-0 appearance-none rounded-lg border border-border bg-bg-primary pl-3 pr-9 text-sm text-text-primary focus:border-gold focus:outline-none"><option value="">{t(kind==='country'?'allCountries':kind==='region'?'allRegions':'allCities')}</option>{placeOptions(rows,kind,locale,value.country).filter(option=>kind!=='city'||!value.region||rows.some(row=>{const p=row as Record<string,unknown>;return p.place_city_id===option.value&&p.place_region_id===value.region;})).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"/></div></div>)}</div>;
}
