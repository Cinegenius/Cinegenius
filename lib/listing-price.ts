export type ListingPriceMetadata = { price_negotiable?: boolean; price_on_request?: boolean; rental_type?: string };
export function listingPriceMetadata(value: unknown): ListingPriceMetadata {
  const data=value && typeof value==='object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
  return {price_negotiable:data.price_negotiable===true,price_on_request:data.price_negotiable!==true && data.price_on_request===true,...(typeof data.rental_type==='string'?{rental_type:data.rental_type}:{})};
}
export function listingPriceLabel(price:number|null|undefined, metadata:unknown=null, unit='/Tag'):string {
  const flags=listingPriceMetadata(metadata);
  const amount=typeof price==='number'&&Number.isFinite(price)&&price>0 ? `${price.toLocaleString('de-DE',{maximumFractionDigits:2})} €${flags.rental_type==='kauf'?'':unit}` : '';
  if(flags.price_negotiable)return amount ? `${amount} VB` : 'VB';
  if(flags.price_on_request||!amount)return 'Preis auf Anfrage';
  return amount;
}
export function listingPriceMetadataError(value:unknown):string|null {
  if(!value||typeof value!=='object'||Array.isArray(value))return 'Die Preisangaben sind ungültig.';
  const record=value as Record<string,unknown>;
  for(const key of ['price_negotiable','price_on_request'])if(key in record&&typeof record[key]!=='boolean')return 'Bitte wähle eine gültige Preisart aus.';
  if(record.price_negotiable===true&&record.price_on_request===true)return 'Bitte wähle entweder Verhandlungsbasis oder Preis auf Anfrage.';
  return null;
}
