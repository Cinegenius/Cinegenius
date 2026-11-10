import rawData from './catalog.json' with { type: 'json' };
import { countryCode, countryName, placeKey, type Place } from './core';
type LocalNames=Record<string,string>;
type CityEntry={id:string;name:string;country:string;region:string;district:string;aliases:string[];names:LocalNames};
type RegionEntry={id:string;code:string;name:string;country:string;aliases:string[];names:LocalNames};
const data=rawData as {countries:string[];regions:RegionEntry[];districts:{id:string;name:string;names:LocalNames}[];cities:CityEntry[]};
export const placeCatalog=data;
const cityById=new Map(data.cities.map(city=>[city.id,city]));
const regionById=new Map(data.regions.map(region=>[region.id,region]));
const districtById=new Map(data.districts.map(district=>[district.id,district]));
// Use the familiar local city names for the three German city-state labels.
// Region identities and the source catalogue remain unchanged.
const regionDisplayCityIds: Record<string,string> = {
 'DE:geonames:2950157':'geonames:2950159',
 'DE:geonames:2911297':'geonames:2911298',
 'DE:geonames:2944387':'geonames:2944388',
};
export function regionDisplayName(regionId:string,locale:string) {
 const region=regionById.get(regionId),city=cityById.get(regionDisplayCityIds[regionId]);
 return city?.names[locale]??city?.name??region?.names[locale]??region?.name??'';
}
export function regionAliases(region:RegionEntry) {
 const city=cityById.get(regionDisplayCityIds[region.id]);
 return [...new Set([region.name,...region.aliases,...Object.values(region.names),...(city?[city.name,...Object.values(city.names)]:[])])];
}
export function cityDistrictName(city:CityEntry,locale:string) {
 const district=districtById.get(city.district);return district?.names[locale]??district?.name??'';
}
export function localizedPlaceFields(fields:Record<string,unknown>,locale:string): Record<string,unknown> {
 const city=cityById.get(String(fields.place_city_id??'')),region=regionById.get(String(fields.place_region_id??''));
 return {...fields,place_search_terms:[...new Set([city?.name??"",...Object.values(city?.names??{}),...(aliasOverrides[city?.id??""]??[]),...(region?regionAliases(region):[]),...(["de","en","es","it","cs","hu"].map(language=>fields.place_country_code?countryName(String(fields.place_country_code),language):""))])],place_region_aliases:region?regionAliases(region):[],place_city_name:city?.names[locale]??fields.place_city_name,place_region_name:region?regionDisplayName(region.id,locale):fields.place_region_name};
}
const aliasOverrides: Record<string,string[]> = {'geonames:2925533':['Frankfurt a.M.','Frankfurt a. M.','Frankfurt/Main','Frankfurt am Main'],'geonames:2886242':['Köln','Cologne','Koeln']};
export function aliases(city:typeof data.cities[number]) {return [city.name,...city.aliases,...(aliasOverrides[city.id]??[])];}
type CityRecord=typeof data.cities[number];
const exactIndex=new Map<string,CityRecord[]>();
for(const city of data.cities)for(const alias of new Set(aliases(city).map(placeKey))){const key=city.country+":"+alias;const existing=exactIndex.get(key);if(existing)existing.push(city);else exactIndex.set(key,[city]);}
// This is a subset, not a complete gazetteer. A single catalogue match is not
// evidence that smaller namesakes do not exist. Only these reviewed variants
// may be normalized without an explicit selection of a catalogue ID.
const reviewedAliases = new Map<string,string>(Object.entries(aliasOverrides).flatMap(([id, values]) =>
 values.map(value => [`DE:${placeKey(value)}`, id] as const)));
export function resolvePlace(raw: string, selectedCityId?: unknown): Place {
 if (typeof selectedCityId === 'string' && selectedCityId) {
  const selected = placeFieldsForId(selectedCityId, raw);
  if (selected) return {countryCode:selected.place_country_code,regionId:selected.place_region_id,cityId:selected.place_city_id,city:selected.place_city_name,region:selected.place_region_name,status:'verified'};
 }
 const parts=raw.split(',').map(s=>s.trim()).filter(Boolean), country=countryCode(parts.at(-1)??'');
 const empty:Place={countryCode:country,regionId:null,cityId:null,city:parts[0]??'',region:'',status:raw.trim()?'pending':'empty'};
 // Never infer a country from a city name, including well-known names.
 if(!country){
  const key=placeKey(raw),region=data.regions.find(r=>regionAliases(r).some(alias=>placeKey(alias)===key));
  const hasCity=data.countries.some(code=>exactIndex.get(code+":"+key)?.length);
  return region&&!hasCity?{...empty,city:'',region:raw}:empty;
 }
 const rest=parts.slice(0,-1); if(!rest.length)return {...empty,city:'',status:'verified'};
 const city=rest[0],regionText=rest.slice(1).join(', ');
 const regions=data.regions.filter(r=>r.country===country);
 const region=regions.filter(r=>[r.id,...regionAliases(r)].some(n=>placeKey(n)===placeKey(regionText)));
 const regionAsCity=regions.find(r=>regionAliases(r).some(n=>placeKey(n)===placeKey(city)));
 if(regionAsCity&&!regionText&&!(exactIndex.get(country+":"+placeKey(city))?.length))return {...empty,city:'',region:regionAsCity.name,regionId:regionAsCity.id};
 if(regionText&&region.length!==1)return {...empty,region:regionText};
 const candidates=(exactIndex.get(country+":"+placeKey(city))??[]).filter(c=>!regionText||c.region===region[0].id);
 if(candidates.length!==1 || reviewedAliases.get(country+':'+placeKey(city))!==candidates[0].id)return {...empty,region:regionText,regionId:region[0]?.id??null};
 const found=candidates[0],parent=regions.find(r=>r.id===found.region);
 return {countryCode:country,regionId:parent?.id??null,cityId:found.id,city:found.name,region:parent?.name??'',status:'verified'};
}
export function placeWriteFields(raw: string, selectedCityId?: unknown) {
 const p=resolvePlace(raw, selectedCityId);return {place_country_code:p.countryCode||null,place_region_id:p.regionId,place_city_id:p.cityId,place_city_name:p.city,place_region_name:p.region,place_status:p.status,place_original:raw};
}
/** Public projection: never exposes the private migration journal. */
export function placeReadFields(raw: string, stored?: object, locale="de") {
 const record=stored as Record<string,unknown>|undefined;
 if(record && ["verified","pending","empty"].includes(String(record.place_status))) return localizedPlaceFields(Object.fromEntries(["place_country_code","place_region_id","place_city_id","place_city_name","place_region_name","place_status"].map(key=>[key,record[key]])),locale);
 const fields=placeWriteFields(raw); return localizedPlaceFields({place_country_code:fields.place_country_code,place_region_id:fields.place_region_id,place_city_id:fields.place_city_id,place_city_name:fields.place_city_name,place_region_name:fields.place_region_name,place_status:fields.place_status},locale);
}
export function cityWriteFields(raw: string, selectedCityId?: unknown) {
 const fields=placeWriteFields(raw, selectedCityId);return {...fields,city:fields.place_city_name};
}
export function placeSearchFilter(query:string) {
 const key=placeKey(query);if(key.length<2)return '';
 const ids=[...new Set(data.countries.flatMap(code=>(exactIndex.get(code+':'+key)??[]).map(city=>city.id)))].slice(0,50);
 const country=countryCode(query);
 return [ids.length?`place_city_id.in.(${ids.join(',')})`:'',country?`place_country_code.eq.${country}`:''].filter(Boolean).join(',');
}
/** Explicit reviewer selection disambiguates homonyms without accepting a forged path. */
export function placeFieldsForId(cityId:string,raw:string) {
 const city=cityById.get(cityId),parts=raw.split(',').map(part=>part.trim());
 if(!city||countryCode(parts.at(-1)??'')!==city.country||!aliases(city).some(alias=>placeKey(alias)===placeKey(parts[0]??'')))return null;
 const region=regionById.get(city.region);
 const regionText=parts.slice(1,-1).filter(Boolean).join(', ');
 if(regionText&&(!region||![region.id,...regionAliases(region)].some(alias=>placeKey(alias)===placeKey(regionText))))return null;
 return {place_country_code:city.country,place_region_id:region?.id??null,place_city_id:city.id,place_city_name:city.name,place_region_name:region?.name??'',place_status:'verified',place_original:raw};
}
