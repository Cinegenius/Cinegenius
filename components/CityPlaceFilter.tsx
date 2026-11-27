'use client';
import {useEffect,useId,useLayoutEffect,useMemo,useRef,useState,type KeyboardEvent} from 'react';
import {useAuth} from '@clerk/nextjs';
import {useLocale,useTranslations} from 'next-intl';
import {Check,MapPin,Search,X} from 'lucide-react';
import BrowseSelect from '@/components/BrowseSelect';
import {fetchPlaceSearch,placeSearchAreas,placeSearchCityId,readPlaceSearchCities,readPlaceSearchCountries,type PlaceSearchArea,type PlaceSearchSurface,type PlaceSearchCity,type PlaceSearchCountry,type PlaceSearchValue} from '@/lib/place-search-client';

/** Search filters only. Text never becomes a stored/canonical place identity. */
export default function CityPlaceFilter({surface,areas,value,label='',onChange,radiusKm,onRadiusChange}:{surface:PlaceSearchSurface;areas:readonly PlaceSearchArea[];value:PlaceSearchValue;label?:string;onChange:(value:PlaceSearchValue,label:string,city:PlaceSearchCity|null)=>void;radiusKm:number|null;onRadiusChange:(km:number|null,city:PlaceSearchCity|null)=>void}){
 const t=useTranslations('PlaceSearch'),p=useTranslations('Places'),ui=useTranslations(),locale=useLocale(),id=useId();
 const {userId,sessionId,isLoaded}=useAuth();
 const areaKey=placeSearchAreas(areas).join(','),canonicalAreas=useMemo(()=>areaKey?areaKey.split(',') as PlaceSearchArea[]:[],[areaKey]);
 const ownerSource=JSON.stringify([userId??null,sessionId??null]);
 const source=JSON.stringify([userId??null,sessionId??null,locale]),countryScope=source+'|'+surface+'|'+areaKey;
 const valueKey=JSON.stringify({country:value.country,region:value.region,city:value.city}),scope=source+'|'+valueKey;
 const live=useRef(source);useLayoutEffect(()=>{live.current=source;return()=>{live.current='';};},[source]);
 const [draft,setDraft]=useState<{scope:string;text:string}|null>(null),[picked,setPicked]=useState<{source:string;city:PlaceSearchCity}|null>(null);
 const [refinement,setRefinement]=useState<{source:string;country:string}|null>(null);
 const country=refinement?.source===ownerSource?refinement.country:value.city?'':/^[A-Z]{2}$/.test(value.country)?value.country:'';
 const [countryData,setCountryData]=useState<{source:string;rows:PlaceSearchCountry[]}|null>(null),[countryError,setCountryError]=useState('');
 const [cityData,setCityData]=useState<{key:string;rows:PlaceSearchCity[]}|null>(null),[cityError,setCityError]=useState(''),[cityBusy,setCityBusy]=useState('');
 const [open,setOpen]=useState(false),[active,setActive]=useState(-1);
 const input=useRef<HTMLInputElement>(null),optionRef=useRef<HTMLButtonElement>(null);
 const typing=draft?.scope===scope?draft.text:null;
 const selectedId=placeSearchCityId(value.city)?value.city:'';
 const exactId=typing===null?selectedId:'';
 const query=typing??'';
 const requestKey=JSON.stringify([source,query,country,exactId]);
 const currentCities=cityData?.key===requestKey?cityData.rows:[];
 const selected=picked?.source===source&&picked.city.id===selectedId?picked.city:exactId?currentCities.find(city=>city.id===exactId):undefined;
 const text=typing??selected?.name??(value.city?label:'');
 const countries=isLoaded&&countryData?.source===countryScope?countryData.rows:null;
 const failedCountry=countryError===countryScope,failedCity=cityError===requestKey;
 const suggestions=open&&!exactId&&query.trim().length>=2?currentCities:[];
 const selectedCountry=countries?.some(row=>row.id===country)?country:'';
 const selectedLabel=selected?.label||label;
 const selectionText=selectedLabel||(!selectedId||failedCity||cityData?.key===requestKey?t('selectionUnavailable'):t('loadingSelection'));
 const resultId=id+'-cities',selectedDescription=id+'-selected';
 const busy=cityBusy===requestKey;
 useEffect(()=>{
  if(!isLoaded)return;const controller=new AbortController();let timedOut=false;const timeout=setTimeout(()=>{timedOut=true;controller.abort();if(live.current===source)setCountryError(countryScope);},10000);
  void fetchPlaceSearch(new URLSearchParams({mode:'countries',surface,locale,areas:areaKey}),controller.signal).then(data=>{const rows=readPlaceSearchCountries(data,userId??null,canonicalAreas,surface);if(!controller.signal.aborted&&live.current===source){setCountryData({source:countryScope,rows});setCountryError('');}}).catch(()=>{if((!controller.signal.aborted||timedOut)&&live.current===source)setCountryError(countryScope);}).finally(()=>clearTimeout(timeout));
  return()=>{clearTimeout(timeout);controller.abort();};
 },[source,countryScope,isLoaded,locale,areaKey,canonicalAreas,userId,surface]);
 useEffect(()=>{
  if(!exactId&&(query.trim().length<2||query.length>120))return;
  const controller=new AbortController();let timedOut=false;const timeout=setTimeout(()=>{timedOut=true;controller.abort();if(live.current===source){setCityError(requestKey);setCityBusy('');}},10000);
  const timer=setTimeout(()=>{setCityBusy(requestKey);const params=new URLSearchParams({mode:'cities',locale,...(exactId?{city:exactId}:{q:query.trim()}),...(country?{country}:{})});void fetchPlaceSearch(params,controller.signal).then(data=>{const rows=readPlaceSearchCities(data,exactId,country);if(!controller.signal.aborted&&live.current===source){setCityData({key:requestKey,rows});setCityError('');setActive(-1);}}).catch(()=>{if((!controller.signal.aborted||timedOut)&&live.current===source)setCityError(requestKey);}).finally(()=>{clearTimeout(timeout);if(live.current===source)setCityBusy(current=>current===requestKey?'':current);});},exactId?0:200);
  return()=>{clearTimeout(timer);clearTimeout(timeout);controller.abort();};
 },[source,requestKey,exactId,query,country,locale]);
 useEffect(()=>{if(active>=0)optionRef.current?.scrollIntoView({block:'nearest'});},[active]);
 function edit(next:string){const cleared={country,region:'',city:''};setDraft({scope:source+'|'+JSON.stringify(cleared),text:next});setPicked(null);setOpen(true);setActive(-1);onChange(cleared,'',null);}
 function choose(city:PlaceSearchCity){const next={country:city.countryCode,region:city.regionId,city:city.id};setPicked({source,city});setDraft(null);setOpen(false);setActive(-1);onChange(next,city.label,city);}
 function clear(){const next={country:'',region:'',city:''};setRefinement({source:ownerSource,country:''});setDraft({scope:source+'|'+JSON.stringify(next),text:''});setPicked(null);setOpen(false);setActive(-1);onChange(next,'',null);input.current?.focus();}
 function chooseCountry(next:string){if(next&&!countries?.some(row=>row.id===next))return;const place={country:next,region:'',city:''};setRefinement({source:ownerSource,country:next});setDraft({scope:source+'|'+JSON.stringify(place),text:''});setPicked(null);setOpen(false);setActive(-1);onChange(place,'',null);input.current?.focus();}
 function keyDown(event:KeyboardEvent<HTMLInputElement>){if(event.nativeEvent.isComposing)return;if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false);setActive(-1);}else if(event.key==='Tab'){setOpen(false);setActive(-1);}else if(['ArrowDown','ArrowUp'].includes(event.key)&&suggestions.length){event.preventDefault();setActive(index=>event.key==='ArrowDown'?(index+1)%suggestions.length:(index<0?suggestions.length-1:(index-1+suggestions.length)%suggestions.length));}else if(event.key==='Enter'&&suggestions.length&&(active>=0||suggestions.length===1)){event.preventDefault();choose(suggestions[active>=0?active:0]);}}
 return <fieldset className="min-w-0 space-y-3" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null)){setOpen(false);setActive(-1);}}}>
  <legend className="sr-only">{t('cityOrPlace')}</legend>
  <label htmlFor={id} className="block text-xs text-text-muted">{t('cityOrPlace')}</label>
  <div className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-border bg-bg-secondary px-3 focus-within:border-gold"><Search size={17} className="shrink-0 text-text-muted" aria-hidden="true"/><input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={suggestions.length>0} aria-controls={suggestions.length?resultId:undefined} aria-activedescendant={active>=0&&suggestions[active]?id+'-city-'+active:undefined} aria-describedby={value.city?selectedDescription:undefined} aria-busy={busy} autoComplete="off" maxLength={120} placeholder={t('placeholder')} value={text} onChange={event=>edit(event.target.value)} onFocus={()=>setOpen(true)} onKeyDown={keyDown} className="min-h-11 min-w-0 flex-1 bg-transparent py-2 text-base text-text-primary outline-none"/>{(text||value.city||value.country)&&<button type="button" aria-label={t('clear')} onClick={clear} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-text-muted"><X size={17} aria-hidden="true"/></button>}</div>
  {value.city&&<p id={selectedDescription} role="status" className="flex min-w-0 items-start gap-1.5 break-words text-xs text-text-secondary">{selected?<Check size={14} className="mt-0.5 shrink-0" aria-hidden="true"/>:<MapPin size={14} className="mt-0.5 shrink-0" aria-hidden="true"/>}{selectionText}</p>}
  {suggestions.length>0&&<div id={resultId} role="listbox" aria-label={p('suggestions')} className="max-h-56 overflow-y-auto rounded-xl border border-border bg-bg-primary">{suggestions.map((city,index)=><button key={city.id} ref={index===active?optionRef:undefined} id={id+'-city-'+index} type="button" role="option" tabIndex={-1} aria-selected={index===active} onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>choose(city)} className={'block min-h-11 w-full break-words px-3 py-2 text-left text-sm '+(index===active?'bg-bg-elevated':'hover:bg-bg-elevated')}><span className="font-medium">{city.name}</span><span className="mt-0.5 block text-xs text-text-muted">{[city.district,city.region,city.countryName].filter(Boolean).join(' · ')}</span></button>)}</div>}
  {busy?<p role="status" className="text-xs text-text-muted">{p('searching')}</p>:failedCity?<p role="status" className="text-xs text-text-muted">{t('unavailable')}</p>:open&&typing!==null&&query.trim().length>=2&&cityData?.key===requestKey&&!suggestions.length?<p role="status" className="text-xs text-text-muted">{t('noMatches')}</p>:typing&&<p className="text-xs text-text-muted">{t('selectSuggestion')}</p>}
  <div className={'grid min-w-0 gap-3 '+(value.city?'min-[360px]:grid-cols-2':'')}><div className="mobile-filter-field"><label>{t('countryOptional')}</label><BrowseSelect label={t('countryOptional')} value={selectedCountry} disabled={!countries||failedCountry} triggerClassName="browse-filter-select" options={[{value:'',label:p('allCountries')},...(countries??[]).map(row=>({value:row.id,label:row.name}))]} onChange={chooseCountry}/>{failedCountry&&<p role="status" className="mt-1 text-xs text-text-muted">{t('countryUnavailable')}</p>}{country&&!selectedCountry&&countries&&<p className="mt-1 text-xs text-text-muted">{t('countrySelected',{country:ui.has('CountryNames.'+country)?ui('CountryNames.'+country):country})}</p>}</div>
  {!!value.city&&<div className="mobile-filter-field"><label>{t('radiusOptional')}</label><BrowseSelect label={t('radiusOptional')} value={radiusKm?String(radiusKm):''} disabled={!selected?.center} triggerClassName="browse-filter-select" options={[{value:'',label:ui('BrowseFilters.cityOnly')},...[10,25,50,100,200].map(km=>({value:String(km),label:ui('locations.inRadius',{radius:km})}))]} onChange={km=>onRadiusChange(km?Number(km):null,selected??null)}/>{selected&&!selected.center&&<p className="mt-1 text-xs text-text-muted">{t('radiusUnavailable')}</p>}</div>}</div>
  <details className="text-xs text-text-muted"><summary className="flex min-h-11 cursor-pointer items-center">{p('source')}</summary><p className="break-words leading-5"><a href="https://www.geonames.org/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">{p('source')}</a>{' · '}<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">{p('sourceLicense')}</a>{' · '}{p('sourceChanges')}</p></details>
 </fieldset>;
}
