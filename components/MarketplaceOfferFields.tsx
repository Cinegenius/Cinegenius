'use client';

import { useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { localizedMarketplaceDepartments, marketplaceCategory } from '@/lib/marketplaceCategories';
import { marketplaceCategoryOptions, searchMarketplaceCategoryOptions, type MarketplaceCategoryOption } from '@/lib/marketplace-category-search';
import { MARKETPLACE_COMMON_FIELDS, marketplaceSpecFields, type MarketplaceDraft } from '@/lib/marketplace-offer';

const inputClass='min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-gold focus:outline-none';
export function MarketplaceCategoryPicker({value,onChange,vehicleOnly=false}:{value:string;onChange:(value:string)=>void;vehicleOnly?:boolean}) {
 const t=useTranslations('MarketplaceNavigation');const catalog=useTranslations('MarketplaceCatalog');const locale=useLocale();
 const [query,setQuery]=useState('');const selected=marketplaceCategory(value);
 const [browse,setBrowse]=useState({value,department:selected?.department??''});
 const input=useRef<HTMLInputElement>(null);const resultsId=useId();
 const collator=new Intl.Collator(locale,{sensitivity:'base',numeric:true});
 const departments=localizedMarketplaceDepartments(catalog).filter(d=>!vehicleOnly||d.id==='fahrzeuge').sort((left,right)=>collator.compare(left.label,right.label));
 const current=departments.find(d=>d.id===(browse.value===value?browse.department:selected?.department));
 const choices=marketplaceCategoryOptions(catalog,locale,{vehicleOnly});
 const selectedChoice=choices.find(choice=>choice.value===selected?.subcategory);
 const matches=query.trim()?searchMarketplaceCategoryOptions(query,catalog,locale,{vehicleOnly}):[];
 const choose=(choice:MarketplaceCategoryOption)=>{
  setBrowse({value:choice.value,department:choice.departmentId});setQuery('');onChange(choice.value);input.current?.focus();
 };
 const changeDepartment=(next:string)=>{
  if(next&& !departments.some(department=>department.id===next))return;
  if(next===(current?.id??''))return;
  setBrowse({value:'',department:next});setQuery('');
  if(value)onChange('');
 };
 return <div className="space-y-3" data-marketplace-categories>
  {value && value!==selectedChoice?.value && <p className="break-words text-xs leading-5 text-text-muted">{t('legacy')} <span>{value}</span></p>}
  {selectedChoice && <p className="break-words text-sm text-text-secondary"><span className="font-medium text-text-primary">{t('selected')}: </span>{selectedChoice.path}</p>}
  <label className="block text-sm text-text-secondary">{t('searchLabel')}<input ref={input} className={`${inputClass} mt-1`} type="search" placeholder={t('searchPlaceholder')} value={query} aria-controls={query.trim()?resultsId:undefined} onChange={event=>setQuery(event.target.value)}/></label>
  {query.trim() && <div className="space-y-2">
   <div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><p className="text-xs text-text-muted" role="status" aria-live="polite">{t('searchResults',{count:matches.length})}</p><button type="button" className="min-h-11 min-w-11 text-xs text-gold hover:text-gold-light" onClick={()=>{setQuery('');input.current?.focus();}}>{t('clearSearch')}</button></div>
   <ul id={resultsId} className="grid max-h-72 gap-2 overflow-y-auto overscroll-contain sm:grid-cols-2">
    {matches.map(choice=><li key={choice.value} className="min-w-0"><button type="button" aria-pressed={selectedChoice?.value===choice.value} onClick={()=>choose(choice)} className={`min-h-11 w-full min-w-0 rounded-xl border p-3 text-left ${selectedChoice?.value===choice.value?'border-gold bg-gold/10':'border-border bg-bg-elevated hover:border-gold/50'}`}><span className="block break-words text-sm font-medium text-text-primary">{choice.label}</span><span className="mt-1 block break-words text-xs text-text-muted">{choice.path}</span></button></li>)}
   </ul>
   {!matches.length&&<p className="text-sm text-text-muted">{t('empty')}</p>}
  </div>}
  <div className="grid gap-3 sm:grid-cols-2">
   <label className="min-w-0 text-sm text-text-secondary">{t('category')}<select className={`${inputClass} mt-1`} value={current?.id??''} onChange={event=>changeDepartment(event.target.value)}><option value="">{t('chooseCategory')}</option>{departments.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
   <label className="min-w-0 text-sm text-text-secondary">{t('subcategory')}<select className={`${inputClass} mt-1`} value={selectedChoice?.departmentId===current?.id?selectedChoice?.value??'':''} disabled={!current} onChange={event=>{const choice=choices.find(item=>item.value===event.target.value&&item.departmentId===current?.id);if(choice)choose(choice);}}><option value="">{t('chooseSubcategory')}</option>{choices.filter(choice=>choice.departmentId===current?.id).map(choice=><option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label>
  </div>
 </div>;
}

export default function MarketplaceOfferFields({value,onChange,vehicleOnly=false,category=true,prices=true,details=true}:{value:MarketplaceDraft;onChange:(value:MarketplaceDraft)=>void;vehicleOnly?:boolean;category?:boolean;prices?:boolean;details?:boolean}) {
 const t=useTranslations('MarketplaceOffer');const v=value.values;
 const set=(key:string,text:string)=>onChange({...value,values:{...v,[key]:text}});
 const field=(key:string,technical=false)=><label key={key} className="block min-w-0 text-sm text-text-secondary">{t(`fields.${key}`)}<input className={`${inputClass} mt-1`} value={technical?value.specsByCategory[value.category]?.[key]??'':v[key]??''} maxLength={technical?240:1000} inputMode={['quantity','deposit'].includes(key)?'decimal':undefined} onChange={event=>technical?onChange({...value,specsByCategory:{...value.specsByCategory,[value.category]:{...value.specsByCategory[value.category],[key]:event.target.value}}}):set(key,event.target.value)}/></label>;
 return <div className="space-y-5" data-marketplace-offer>
  {category&&<MarketplaceCategoryPicker value={value.category} vehicleOnly={vehicleOnly} onChange={next=>onChange({...value,category:next})}/>}
  {prices&&<div className="space-y-3">
   <label className="block text-sm text-text-secondary">{t('mode')}<select className={`${inputClass} mt-1`} value={v.mode} onChange={event=>set('mode',event.target.value)}>{['rent','sale','both'].map(mode=><option value={mode} key={mode}>{t(mode)}</option>)}</select></label>
   <div className="grid gap-3 sm:grid-cols-2">{['rent','sale'].filter(kind=>v.mode===kind||v.mode==='both').map(kind=><fieldset key={kind} className="min-w-0 space-y-2 rounded-xl border border-border p-3"><legend className="px-1 text-sm font-medium">{t(`${kind}Price`)}</legend><select aria-label={t(`${kind}Price`)} className={inputClass} value={v[`${kind}_mode`]} onChange={event=>set(`${kind}_mode`,event.target.value)}>{['fixed','negotiable','request'].map(mode=><option key={mode} value={mode}>{t(mode)}</option>)}</select>{v[`${kind}_mode`]!=='request'&&<input aria-label={t(`${kind}Price`)} type="number" min="0" max="1000000" step="0.01" className={inputClass} value={v[`${kind}_price`]??''} onChange={event=>set(`${kind}_price`,event.target.value)}/>}</fieldset>)}</div>
   {v.mode!=='sale'&&<div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-text-secondary">{t('unit')}<select className={`${inputClass} mt-1`} value={v.unit} onChange={event=>set('unit',event.target.value)}>{['hour','day','week','month','project'].map(unit=><option key={unit} value={unit}>{t(unit)}</option>)}</select></label></div>}
  </div>}
  {details&&<>
   <details className="rounded-xl border border-border p-3"><summary className="min-h-11 cursor-pointer content-center text-sm font-medium">{t('optional')}</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm text-text-secondary">{t('bundle')}<select className={`${inputClass} mt-1`} value={v.bundle} onChange={event=>set('bundle',event.target.value)}>{['single','set','package'].map(bundle=><option key={bundle} value={bundle}>{t(bundle)}</option>)}</select></label>{MARKETPLACE_COMMON_FIELDS.filter(key=>!(v.mode==='sale'&&['minimum_rental','deposit'].includes(key))).map(key=>field(key))}<div className="flex flex-wrap gap-3 sm:col-span-2">{['pickup','shipping','delivery'].map(kind=><label key={kind} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={(v.fulfilment??'').split(',').includes(kind)} onChange={event=>{const current=new Set((v.fulfilment??'').split(',').filter(Boolean));if(event.target.checked)current.add(kind);else current.delete(kind);set('fulfilment',[...current].join(','));}}/>{t(kind)}</label>)}</div></div></details>
   {marketplaceSpecFields(value.category).length>0&&<details className="rounded-xl border border-border p-3"><summary className="min-h-11 cursor-pointer content-center text-sm font-medium">{t('technical')}</summary><p className="my-3 text-xs leading-5 text-text-muted">{t('supplierValues')}</p><div className="grid gap-3 sm:grid-cols-2">{marketplaceSpecFields(value.category).map(key=>field(key,true))}</div></details>}
  </>}
 </div>;
}
