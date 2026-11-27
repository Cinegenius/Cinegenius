"use client";

import {useEffect,useLayoutEffect,useRef,useState} from "react";
import {useAuth} from "@clerk/nextjs";
import {useLocale,useTranslations} from "next-intl";
import {useNativeAppAppearance} from "@/lib/use-native-app-appearance";
import {fetchPlaceSearch,placeSearchCityId,readPlaceSearchCities,type PlaceSearchCity} from "@/lib/place-search-client";

/** Display only: an unloaded global city must not expose its catalogue ID in a filter chip. */
export function useDiscoveryPlaceLabels(cityId:string){
 const native=useNativeAppAppearance(),locale=useLocale(),t=useTranslations("Places"),ui=useTranslations();
 const {userId,sessionId,isLoaded}=useAuth();
 const key=JSON.stringify([native,isLoaded,userId??null,sessionId??null,locale,cityId]);
 const live=useRef(key);
 useLayoutEffect(()=>{live.current=key;return()=>{live.current="";};},[key]);
 const [resolved,setResolved]=useState<{key:string;city:PlaceSearchCity}|null>(null);
 const city=native&&isLoaded&&resolved?.key===key?resolved.city:null;
 useEffect(()=>{
  if(!native||!isLoaded||!placeSearchCityId(cityId))return;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  void fetchPlaceSearch(new URLSearchParams({mode:"cities",locale,city:cityId}),controller.signal).then(value=>{
   const selected=readPlaceSearchCities(value,cityId)[0];
   if(selected&&!controller.signal.aborted&&live.current===key)setResolved({key,city:selected});
  }).catch(()=>{}).finally(()=>clearTimeout(timer));
  return()=>{controller.abort();clearTimeout(timer);};
 },[key,native,isLoaded,locale,cityId]);
 return (kind:"city"|"region"|"country",value:string,fallback:string)=>{
  if(!native)return fallback;
  if(city){
   if(kind==="city"&&value===city.id)return city.label;
   if(kind==="region"&&value===city.regionId&&city.region)return city.region;
   if(kind==="country"&&value===city.countryCode)return city.countryName;
  }
  if(kind==="country"&&ui.has("CountryNames."+value))return ui("CountryNames."+value);
  // Existing human-readable legacy values and loaded-row labels remain intact.
  return /(?:^|:)geonames:\d+/.test(fallback)?t(kind):fallback;
 };
}
