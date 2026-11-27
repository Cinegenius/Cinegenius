"use client";
import CityPlaceFilter from "@/components/CityPlaceFilter";
import {type PlaceFilterValue} from "@/components/PlaceFilters";
import {type BrowseRadius} from "@/lib/browse-radius";
import {type PlaceSearchArea} from "@/lib/place-search-client";

/** Native discovery uses complete server facets; rows never define available countries. */
export default function NativeBrowsePlaceFilters({area,value,onChange,radius,onRadiusChange}:{
 area:PlaceSearchArea;rows:object[];value:PlaceFilterValue;onChange:(value:PlaceFilterValue)=>void;
 radius:BrowseRadius|null;onRadiusChange:(value:BrowseRadius|null)=>void;
}){
 return <CityPlaceFilter surface="directory" areas={[area]} value={value} radiusKm={radius?.city===value.city?radius.km:null}
  onChange={next=>{onRadiusChange(null);onChange(next);}}
  onRadiusChange={(km,city)=>onRadiusChange(km&&city?.center?{...city.center,city:city.id,km}:null)}/>;
}
