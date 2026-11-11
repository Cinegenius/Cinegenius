import { SUPPORTED_LOCALES } from "../i18n/locales";
import { COUNTRY_CODES } from './countries';
export type Place = { countryCode: string; regionId: string | null; cityId: string | null; city: string; region: string; status: 'verified' | 'pending' | 'empty' };
export const PLACE_COLUMNS = 'place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status';
export function placeKey(value: string) { return value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/ß/g,'ss').replace(/[^\p{L}\p{N}]/gu,''); }
export function countryName(code: string, locale = 'de') { return new Intl.DisplayNames([locale], {type:'region'}).of(code) ?? code; }
const countryAliases = new Map<string,string>();
for (const code of COUNTRY_CODES) { countryAliases.set(placeKey(code),code); for (const locale of SUPPORTED_LOCALES) countryAliases.set(placeKey(countryName(code,locale)),code); }
export function countryCode(value: string) { return countryAliases.get(placeKey(value)) ?? ''; }
const names: Record<string,Record<string,string>> = {
 'geonames:2886242': {de:'Köln',en:'Cologne',es:'Colonia',it:'Colonia',cs:'Kolín nad Rýnem',hu:'Köln',nl:'Keulen','nl-BE':'Keulen',sv:'Köln'},
 'geonames:2925533': {de:'Frankfurt am Main',en:'Frankfurt am Main',es:'Fráncfort del Meno',it:'Francoforte sul Meno',cs:'Frankfurt nad Mohanem',hu:'Frankfurt am Main',nl:'Frankfurt am Main','nl-BE':'Frankfurt am Main',sv:'Frankfurt am Main'},
 'geonames:2867714': {de:'München',en:'Munich',es:'Múnich',it:'Monaco di Baviera',cs:'Mnichov',hu:'München',nl:'München','nl-BE':'München',sv:'München'},
 'geonames:2761369': {de:'Wien',en:'Vienna',es:'Viena',it:'Vienna',cs:'Vídeň',hu:'Bécs',nl:'Wenen','nl-BE':'Wenen',sv:'Wien'},
 'geonames:3067696': {de:'Prag',en:'Prague',es:'Praga',it:'Praga',cs:'Praha',hu:'Prága',nl:'Praag','nl-BE':'Praag',sv:'Prag'},
 'geonames:2657896': {de:'Zürich',en:'Zurich',es:'Zúrich',it:'Zurigo',cs:'Curych',hu:'Zürich',nl:'Zürich','nl-BE':'Zürich',sv:'Zürich'},
};

/** Reviewed variant labels shared unchanged by the catalogue and search. */
export const aliasOverrides: Record<string,string[]> = {'geonames:2925533':['Frankfurt a.M.','Frankfurt a. M.','Frankfurt/Main','Frankfurt am Main'],'geonames:2886242':['Köln','Cologne','Koeln']};
const citySearchAliasGroups = Object.entries(names).map(([id, labels]) =>
 [...new Set([...Object.values(labels), ...(aliasOverrides[id] ?? [])])]);
/** Search only: exact known aliases expand without assigning an identity or country. */
export function placeCitySearchAliases(query: string): string[] {
 const key = placeKey(query);
 if (!key) return [];
 const group = citySearchAliasGroups.find(labels => labels.some(label => placeKey(label) === key));
 return group ? [...group] : [];
}

export function cityName(id: string | null, fallback: string, locale = 'de') { return (id && (names[id]?.[locale] ?? names[id]?.[locale.split('-')[0]])) || fallback; }
export function placeFromRecord(input: object): Place {
 const row=input as Record<string,unknown>;
 return {countryCode:String(row.place_country_code??''),regionId:row.place_region_id as string|null??null,cityId:row.place_city_id as string|null??null,city:String(row.place_city_name??''),region:String(row.place_region_name??''),status:(row.place_status as Place['status'])??'pending'};
}
export function placeInputValue(row: object, legacy: string) {
 const p=placeFromRecord(row); return p.countryCode ? [p.city,p.region,p.countryCode].join(', ') : legacy;
}
export function placeDisplay(row: object, fallback: string, locale: string) {
 const p=placeFromRecord(row);return p.status==='verified' ? [cityName(p.cityId,p.city,locale),countryName(p.countryCode,locale)].filter(Boolean).join(', ') : fallback;
}
export function placeOptions(rows: object[], kind:'city'|'country'|'region', locale:string, country='') {
 const options=new Map<string,string>();for(const row of rows){const p=placeFromRecord(row);if(country&&p.countryCode!==country)continue;
 if(kind==='country'&&p.countryCode)options.set(p.countryCode,countryName(p.countryCode,locale));
 if(kind==='region'&&p.regionId)options.set(p.regionId,p.region);
 if(kind==='city'&&p.status==='verified'&&p.cityId)options.set(p.cityId,[cityName(p.cityId,p.city,locale),p.region,countryName(p.countryCode,locale)].filter(Boolean).join(', '));}
 return [...options].map(([value,label])=>({value,label})).sort((a,b)=>new Intl.Collator(locale,{sensitivity:'base'}).compare(a.label,b.label));
}
export function matchesPlace(row: object, kind:'city'|'country'|'region', id:string){const p=placeFromRecord(row);return !id||(kind==='city'?p.cityId:kind==='country'?p.countryCode:p.regionId)===id;}

export function hasPlaceCity(value: string) { const first=value.split(",")[0].trim();return !!first && !(value.split(",").length===1 && countryCode(first)); }
/** Upgrade old saved filters only when the visible records give one unique identity. */
export function canonicalFilterValue(value:string,rows:object[],kind:'city'|'country'|'region') {
 if(!value)return value;
 if(kind==='country')return countryCode(value)||value;
 if(kind==='city'&&value.startsWith('geonames:'))return value;
 const candidates=new Set<string>();
 for(const row of rows){const p=placeFromRecord(row),record=row as Record<string,unknown>;const id=kind==='city'?p.cityId:p.regionId;
 const labels=kind==='city'?[p.city,...Object.values(p.cityId?names[p.cityId]??{}:{})]:[p.region,...(Array.isArray(record.place_region_aliases)?record.place_region_aliases.filter((value):value is string=>typeof value==='string'):[])];
 if(id&&labels.some(label=>placeKey(label)===placeKey(value)))candidates.add(id);}
 return candidates.size===1?[...candidates][0]:value;
}
export function placeSearchMatches(input:object,query:string) {
 const row=input as Record<string,unknown>,p=placeFromRecord(input),key=placeKey(query);
 if(!key)return true;
 const terms=[p.city,p.region,p.countryCode,...(Array.isArray(row.place_search_terms)?row.place_search_terms.filter((value):value is string=>typeof value==='string'):[]),...Object.values(p.cityId?names[p.cityId]??{}:{})];
 if (terms.some(term=>placeKey(term).includes(key))) return true;
 if (p.cityId) return false;
 const aliases = new Set(placeCitySearchAliases(query).map(label => label.toLowerCase()));
 // SQL ILIKE exact alternatives use the original stored labels: do not fold
 // accents, trim or parse them, or expand region/country search terms as cities.
 const labels = [p.city, row.city, row.location].filter((value): value is string => typeof value === 'string');
 return labels.some(label => aliases.has(label.toLowerCase()));
}
