import type { MarketplaceOffer } from "./marketplace-offer";
export type ListingPriceMetadata = { marketplace?: MarketplaceOffer; price_negotiable?: boolean; price_on_request?: boolean; rental_type?: string };
export function listingPriceMetadata(value: unknown): ListingPriceMetadata {
  const data=value && typeof value==='object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
  const market=data.marketplace && typeof data.marketplace==='object'&&!Array.isArray(data.marketplace)?data.marketplace as Record<string,unknown>:null;
  const valid=market && ['rent','sale','both'].includes(String(market.mode)) && ['hour','day','week','month','project'].includes(String(market.unit)) && ['single','set','package'].includes(String(market.bundle)) && ['rent','sale'].every(kind=>['fixed','negotiable','request'].includes(String(market[`${kind}_mode`]))&&(market[`${kind}_price`]===null||(typeof market[`${kind}_price`]==='number'&&Number.isFinite(market[`${kind}_price`])))) && Array.isArray(market.fulfilment) && market.fulfilment.every(value=>['pickup','shipping','delivery'].includes(String(value))) && market.specs && typeof market.specs==='object'&&!Array.isArray(market.specs);
  return {...(valid ? {marketplace:market as MarketplaceOffer}:{}),price_negotiable:data.price_negotiable===true,price_on_request:data.price_negotiable!==true && data.price_on_request===true,...(typeof data.rental_type==='string'?{rental_type:data.rental_type}:{})};
}
export function listingPriceLabel(price:number|null|undefined, metadata:unknown=null, unit='/Tag',locale='de-DE',translate?:(key:string)=>string):string {
  const flags=listingPriceMetadata(metadata);
  const market=flags.marketplace;
  const words=(key:string)=>translate?.(key)??({request:'Preis auf Anfrage',rent:'Miete',sale:'Kauf',hour:'Std.',day:'Tag',week:'Woche',month:'Monat',project:'Projekt'} as Record<string,string>)[key]??key;
  if(market){
    const format=(kind:'rent'|'sale')=>{const mode=market[`${kind}_mode`],value=market[`${kind}_price`];const amount=typeof value==='number'&&value>0?`${value.toLocaleString(locale,{maximumFractionDigits:2})} €${kind==='rent'?`/${words(market.unit)}`:''}`:'';return mode==='request'?words('request'):mode==='negotiable'?amount?`${amount} VB`:'VB':amount||words('request');};
    return market.mode==='both'?`${words('rent')}: ${format('rent')} · ${words('sale')}: ${format('sale')}`:format(market.mode==='sale'?'sale':'rent');
  }
  const amount=typeof price==='number'&&Number.isFinite(price)&&price>0 ? `${price.toLocaleString(locale,{maximumFractionDigits:2})} €${flags.rental_type==='kauf'?'':unit==='/Tag'&&translate?`/${words('day')}`:unit}` : '';
  if(flags.price_negotiable)return amount ? `${amount} VB` : 'VB';
  if(flags.price_on_request||!amount)return words('request');
  return amount;
}
export function listingPriceMetadataError(value:unknown):string|null {
  if(!value||typeof value!=='object'||Array.isArray(value))return 'Die Preisangaben sind ungültig.';
  const record=value as Record<string,unknown>;
  for(const key of ['price_negotiable','price_on_request'])if(key in record&&typeof record[key]!=='boolean')return 'Bitte wähle eine gültige Preisart aus.';
  if(record.price_negotiable===true&&record.price_on_request===true)return 'Bitte wähle entweder Verhandlungsbasis oder Preis auf Anfrage.';
  return null;
}

/** Search-engine prices describe the actual unit and never invent a zero-euro offer. */
export function listingStructuredOffers(price:number|null|undefined,metadata:unknown):Record<string,unknown>[]|undefined {
  const flags=listingPriceMetadata(metadata),market=flags.marketplace;
  const offer=(amount:number,kind:'rent'|'sale',unit='day')=>({
    '@type':'Offer',price:amount,priceCurrency:'EUR',
    businessFunction:kind==='sale'?'http://purl.org/goodrelations/v1#Sell':'http://purl.org/goodrelations/v1#LeaseOut',
    priceSpecification:{'@type':'UnitPriceSpecification',price:amount,priceCurrency:'EUR',...(kind==='rent'?{unitCode:({hour:'HUR',day:'DAY',week:'WEE',month:'MON',project:'C62'} as Record<string,string>)[unit],...(unit==='project'?{unitText:'project'}:{})}:{})},
  });
  if(market){const offers=(['rent','sale'] as const).filter(kind=>market.mode===kind||market.mode==='both').flatMap(kind=>{const amount=market[`${kind}_price`];return market[`${kind}_mode`]==='fixed'&&typeof amount==='number'&&amount>0?[offer(amount,kind,market.unit)]:[];});return offers.length?offers:undefined;}
  return typeof price==='number'&&price>0&&!flags.price_negotiable&&!flags.price_on_request?[offer(price,flags.rental_type==='kauf'?'sale':'rent')]:undefined;
}
