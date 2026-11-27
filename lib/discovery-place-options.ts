import {aliases,cityDistrictName,placeCatalog,regionDisplayName} from '@/lib/places/catalog';
import {cityName,countryName,placeKey} from '@/lib/places/core';
import {publicMapPoint} from '@/lib/places/public-map-point';
export const DISCOVERY_PLACE_AREAS=['crew','marketplace','locations','companies','jobs'] as const;
export const DISCOVERY_PLACE_SURFACES=['smart','directory'] as const;
export type DiscoveryPlaceSurface=typeof DISCOVERY_PLACE_SURFACES[number];
export type DiscoveryPlaceArea=typeof DISCOVERY_PLACE_AREAS[number];
export type DiscoveryCountryOption={id:string;name:string};
export type DiscoveryCityOption={id:string;name:string;canonicalName:string;countryCode:string;countryName:string;regionId:string;region:string;district:string;label:string;center:{lat:number;lng:number}|null};
export type DiscoveryCitiesEnvelope={version:1;mode:'cities';cities:DiscoveryCityOption[]};
export type DiscoveryCountriesEnvelope={version:1;mode:'countries';surface:DiscoveryPlaceSurface;accountId:string|null;areas:DiscoveryPlaceArea[];countries:DiscoveryCountryOption[]};
const citiesById=new Map(placeCatalog.cities.map(city=>[city.id,city]));
// Catalogue-only search keys. Never derive names/points from profile or offer rows.
const cityKeys=placeCatalog.cities.map(city=>({city,keys:[...new Set(aliases(city).map(placeKey).filter(Boolean))]}));
/** Suggestion-only typo tolerance, bounded to one edit. This never writes an ID. */
export function onePlaceEdit(left:string,right:string){
 if(Math.abs(left.length-right.length)>1)return false;
 let i=0,j=0,edits=0;
 while(i<left.length&&j<right.length){if(left[i]===right[j]){i++;j++;continue;}if(++edits>1)return false;if(left.length>=right.length)i++;if(right.length>=left.length)j++;}
 return edits+(i<left.length||j<right.length?1:0)<=1;
}
function option(city:typeof placeCatalog.cities[number],locale:string):DiscoveryCityOption {
 const name=city.names[locale]??cityName(city.id,city.name,locale),region=regionDisplayName(city.region,locale),district=cityDistrictName(city,locale),country=countryName(city.country,locale);
 const point=publicMapPoint({place_city_id:city.id,place_country_code:city.country,place_status:'verified'});
 return{id:city.id,name,canonicalName:city.name,countryCode:city.country,countryName:country,regionId:city.region,region,district,label:[name,district,region,country].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', '),center:point.lat!==null&&point.lng!==null?{lat:point.lat,lng:point.lng}:null};
}
/** Global explicit catalogue choices, independent of inventory availability/errors. */
export function discoveryCityOptions(query:string,locale:string,country='',cityId=''):DiscoveryCityOption[] {
 if(cityId){const city=citiesById.get(cityId);return city&&(!country||city.country===country)?[option(city,locale)]:[];}
 const key=placeKey(query);if(key.length<2)return[];
 const collator=new Intl.Collator(locale,{sensitivity:'base'}),matches:{city:typeof placeCatalog.cities[number];rank:number}[]=[];
 for(const entry of cityKeys){
  if(country&&entry.city.country!==country)continue;
  let rank=4;
  for(const name of entry.keys){
   if(name===key){rank=0;break;}
   if(name.startsWith(key))rank=Math.min(rank,1);
   else if(name.includes(key))rank=Math.min(rank,2);
   else if(rank>2&&key.length>=5&&key.length<=64&&onePlaceEdit(name,key))rank=3;
  }
  if(rank<4)matches.push({city:entry.city,rank});
 }
 matches.sort((a,b)=>a.rank-b.rank||collator.compare(a.city.names[locale]??a.city.name,b.city.names[locale]??b.city.name)||collator.compare(countryName(a.city.country,locale),countryName(b.city.country,locale))||collator.compare(regionDisplayName(a.city.region,locale),regionDisplayName(b.city.region,locale))||collator.compare(cityDistrictName(a.city,locale),cityDistrictName(b.city,locale))||a.city.id.localeCompare(b.city.id));
 return matches.slice(0,30).map(entry=>option(entry.city,locale));
}
