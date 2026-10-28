import { DEPARTMENTS, marketplaceCategory } from './marketplaceCategories';

export const MARKETPLACE_COMMON_FIELDS = ['manufacturer','model','quantity','condition','faults','included','excluded','minimum_rental','deposit','fulfilment_costs','availability'] as const;
export const MARKETPLACE_SPECS: Record<string, string[]> = {
  licht: ['power','temperature','rgb','connectors','protocols'], strom: ['voltage','current','power','connectors'],
  kamera: ['mount','sensor','formats'], grip: ['dimensions','weight','load','compatibility'],
  ton: ['connectors','channels','frequency'], video: ['connectors','formats','capacity','protocols'],
  kostuem: ['size','dimensions','era','material'], maske: ['dimensions','equipment','packaging','expiry'],
  requisiten: ['dimensions','weight','material','era'], produktion:['dimensions','weight','load','equipment'],
  catering: ['dimensions','capacity','power','equipment'], sfx: ['power','protocols','material'],
  studio: ['dimensions','material','equipment'], fahrzeuge: [],
};
export function marketplaceSpecFields(category:string):string[] {
  if(category==='licht-steuerung'||category==='licht-signal')return ['universes','protocols','connectors','wireless'];
  if(category==='kamera-objektive')return ['mount','focal_length','aperture'];
  if(category==='kostuem-staender')return ['dimensions','load','wheels','folding'];
  return MARKETPLACE_SPECS[marketplaceCategory(category)?.department??'']??[];
}
export type MarketplaceOffer = {
  mode:'rent'|'sale'|'both'; rent_mode:'fixed'|'negotiable'|'request'; sale_mode:'fixed'|'negotiable'|'request';
  rent_price:number|null; sale_price:number|null; unit:'hour'|'day'|'week'|'month'|'project';
  bundle:'single'|'set'|'package'; fulfilment:string[]; specs:Record<string,string>;
} & Partial<Record<typeof MARKETPLACE_COMMON_FIELDS[number],string>>;
export type MarketplaceDraft = { category:string; values:Record<string,string>; specsByCategory:Record<string,Record<string,string>> };
export function marketplaceDraft(category='',price=0,metadata:unknown={}):MarketplaceDraft {
  const meta=metadata && typeof metadata==='object' ? metadata as Record<string,unknown> : {};
  const value=meta.marketplace && typeof meta.marketplace==='object' ? meta.marketplace as Record<string,unknown> : {};
  const mode=meta.rental_type==='kauf'?'sale':meta.rental_type==='beides'?'both':'rent';
  const priceMode=meta.price_negotiable?'negotiable':meta.price_on_request||price<=0?'request':'fixed';
  const values:Record<string,string>={mode,rent_mode:priceMode,sale_mode:priceMode,rent_price:mode==='sale'?'':String(price||''),sale_price:mode==='sale'?String(price||''):'',unit:'day',bundle:'single',fulfilment:'pickup'};
  for(const [key,item]of Object.entries(value))if(typeof item==='string'||typeof item==='number')values[key]=String(item);
  if(Array.isArray(value.fulfilment))values.fulfilment=value.fulfilment.join(',');
  for(const key of MARKETPLACE_COMMON_FIELDS)if(!(key in values)&&typeof meta[key]==='string')values[key]=String(meta[key]);
  const specs:Record<string,string>={};
  for(const key of marketplaceSpecFields(category)){const raw=(value.specs as Record<string,unknown>|undefined)?.[key]??meta[key];if(typeof raw==='string')specs[key]=raw;}
  return {category,values,specsByCategory:{[category]:specs}};
}
export function serializeMarketplaceDraft(draft:MarketplaceDraft):MarketplaceOffer {
  const v=draft.values;
  return {
    mode:(v.mode||'rent') as MarketplaceOffer['mode'], rent_mode:(v.rent_mode||'request') as MarketplaceOffer['rent_mode'],sale_mode:(v.sale_mode||'request') as MarketplaceOffer['sale_mode'],
    rent_price:v.rent_price?.trim()?Number(v.rent_price):null,sale_price:v.sale_price?.trim()?Number(v.sale_price):null,
    unit:(v.unit||'day') as MarketplaceOffer['unit'],bundle:(v.bundle||'single') as MarketplaceOffer['bundle'],
    fulfilment:(v.fulfilment||'').split(',').filter(Boolean),
    ...Object.fromEntries(MARKETPLACE_COMMON_FIELDS.filter(key=>v[key]?.trim()).map(key=>[key,v[key].trim()])),
    specs:Object.fromEntries(marketplaceSpecFields(draft.category).flatMap(key=>{const value=draft.specsByCategory[draft.category]?.[key]?.trim();return value?[[key,value]]:[];})),
  };
}
export function marketplaceMetadataPatch(draft:MarketplaceDraft) {
  const marketplace=serializeMarketplaceDraft(draft);
  const mode=marketplace.mode==='sale'?marketplace.sale_mode:marketplace.rent_mode;
  return {marketplace,rental_type:marketplace.mode==='sale'?'kauf':marketplace.mode==='both'?'beides':'miete',price_negotiable:mode==='negotiable',price_on_request:mode==='request'};
}
export function marketplaceBasePrice(draft:MarketplaceDraft):number {const offer=serializeMarketplaceDraft(draft);return (offer.mode==='sale'?offer.sale_mode==='request'?0:offer.sale_price:offer.rent_mode==='request'?0:offer.rent_price)??0;}
/** Validate only the new envelope. Existing legacy metadata is preserved, never bulk-converted. */
export function validateMarketplaceOffer(category:unknown,type:string,value:unknown,complete=true):string|null {
  if(value===undefined)return null;
  if(!value||typeof value!=='object'||Array.isArray(value)||!marketplaceCategory(category,type)?.subcategory || !DEPARTMENTS.some(d=>d.groups.some(g=>g.id===category)))return 'invalidCategory';
  const data=value as Record<string,unknown>;
  const allowed=new Set(['mode','rent_mode','sale_mode','rent_price','sale_price','unit','bundle','fulfilment','specs',...MARKETPLACE_COMMON_FIELDS]);
  if(Object.keys(data).some(key=>!allowed.has(key)))return 'invalidDetails';
  if(!['rent','sale','both'].includes(String(data.mode))||!['hour','day','week','month','project'].includes(String(data.unit))||!['single','set','package'].includes(String(data.bundle)))return 'invalidDetails';
  for(const kind of ['rent','sale']) {
    if(!['fixed','negotiable','request'].includes(String(data[`${kind}_mode`])))return 'invalidPrice';
    const amount=data[`${kind}_price`];
    if(amount!==null&&(typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>1000000))return 'invalidPrice';
    if(complete&&(data.mode===kind||data.mode==='both')&&data[`${kind}_mode`]==='fixed'&&!(typeof amount==='number'&&amount>0))return 'priceRequired';
  }
  if(!Array.isArray(data.fulfilment)||data.fulfilment.length>3||new Set(data.fulfilment).size!==data.fulfilment.length||data.fulfilment.some(v=>!['pickup','shipping','delivery'].includes(String(v))))return 'invalidDetails';
  for(const key of MARKETPLACE_COMMON_FIELDS)if(data[key]!==undefined&&(typeof data[key]!=='string'||String(data[key]).length>1000))return 'invalidDetails';
  if(data.quantity!==undefined&&(!/^\d+$/.test(String(data.quantity))||Number(data.quantity)<1||Number(data.quantity)>1000000))return 'invalidDetails';
  if(data.deposit!==undefined&&(!/^\d+(\.\d{1,2})?$/.test(String(data.deposit))||Number(data.deposit)>1000000))return 'invalidPrice';
  if(!data.specs||typeof data.specs!=='object'||Array.isArray(data.specs))return 'invalidDetails';
  const fields=marketplaceSpecFields(String(category));
  if(Object.entries(data.specs).some(([key,v])=>!fields.includes(key)||typeof v!=='string'||v.length>240))return 'invalidDetails';
  return null;
}
export function marketplaceCategoryLabel(category:string,t:(key:string)=>string):string {
 const mapped=marketplaceCategory(category);if(!mapped)return category;
 return mapped.subcategory?t(`subcategories.${mapped.subcategory}`):t(`categories.${mapped.department}`);
}
export function marketplaceDepartmentIds():string[]{return DEPARTMENTS.map(d=>d.id);}
