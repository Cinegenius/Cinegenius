import {COUNTRY_CODES} from './places/countries';
export const PLACE_SEARCH_AREAS=['crew','marketplace','locations','companies','jobs'] as const;
export type PlaceSearchArea=typeof PLACE_SEARCH_AREAS[number];
export type PlaceSearchSurface='smart'|'directory';
export type PlaceSearchValue={country:string;region:string;city:string};
export type PlaceSearchCity={id:string;name:string;canonicalName:string;countryCode:string;countryName:string;regionId:string;region:string;district:string;label:string;center:{lat:number;lng:number}|null};
export type PlaceSearchCountry={id:string;name:string};
export type PlaceSearchCountries={version:1;mode:'countries';surface:PlaceSearchSurface;accountId:string|null;areas:PlaceSearchArea[];countries:PlaceSearchCountry[]};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max=300):v is string=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
const countries=new Set<string>(COUNTRY_CODES);
const code=(v:unknown):v is string=>typeof v==='string'&&countries.has(v);
export const placeSearchCityId=(v:unknown):v is string=>typeof v==='string'&&/^geonames:[0-9]{1,12}$/.test(v);
export const placeSearchAreas=(areas:readonly PlaceSearchArea[])=>PLACE_SEARCH_AREAS.filter(a=>areas.includes(a));
export class PlaceSearchError extends Error{constructor(){super('place_search_unavailable');}}
export function readPlaceSearchCities(value:unknown,selectedId='',country=''):PlaceSearchCity[]{
 if(!record(value)||value.version!==1||value.mode!=='cities'||!Array.isArray(value.cities)||value.cities.length>30)throw new PlaceSearchError();
 const seen=new Set<string>();for(const v of value.cities){if(!record(v)||!placeSearchCityId(v.id)||seen.has(v.id)||selectedId&&v.id!==selectedId||!code(v.countryCode)||country&&v.countryCode!==country||!text(v.name,160)||!v.name||!text(v.canonicalName,160)||!v.canonicalName||!text(v.countryName,160)||!v.countryName||!text(v.regionId,100)||!text(v.region,160)||!text(v.district,160)||!text(v.label,500)||!v.label||v.center!==null&&(!record(v.center)||!Number.isFinite(v.center.lat)||Number(v.center.lat)<-90||Number(v.center.lat)>90||!Number.isFinite(v.center.lng)||Number(v.center.lng)<-180||Number(v.center.lng)>180))throw new PlaceSearchError();seen.add(v.id);}
 if(selectedId&&value.cities.length>1)throw new PlaceSearchError();return value.cities as PlaceSearchCity[];
}
export function readPlaceSearchCountries(value:unknown,accountId:string|null,areas:readonly PlaceSearchArea[],surface:PlaceSearchSurface):PlaceSearchCountry[]{
 const canonical=placeSearchAreas(areas);if(!record(value)||value.version!==1||value.mode!=='countries'||value.surface!==surface||value.accountId!==accountId||!Array.isArray(value.areas)||JSON.stringify(value.areas)!==JSON.stringify(canonical)||!Array.isArray(value.countries)||value.countries.length>300)throw new PlaceSearchError();
 const seen=new Set<string>();for(const row of value.countries){if(!record(row)||!code(row.id)||seen.has(row.id)||!text(row.name,160)||!row.name)throw new PlaceSearchError();seen.add(row.id);}return value.countries as PlaceSearchCountry[];
}
export async function fetchPlaceSearch(params:URLSearchParams,signal:AbortSignal){const response=await fetch('/api/places/discovery?'+params,{signal,cache:'no-store',credentials:'same-origin',redirect:'error'});if(response.status!==200)throw new PlaceSearchError();return response.json() as Promise<unknown>;}
