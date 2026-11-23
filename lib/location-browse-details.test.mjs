import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesLocationDetails,readLocationDetailFilters} from './location-browse-details.ts';
import {publicLocationBrowseMetadata} from './location-privacy.ts';
import {filterLandingLocations,DEFAULT_LOCATION_LANDING_FILTERS,readLocationLandingFilters,locationLandingParams} from './locations-landing-filters.ts';
import {browseRadiusCenter,inBrowseRadius,matchesBrowsePlace} from './browse-radius.ts';

test('Location detail bounds require actual structured facts; unknown/false/string values never become matching equipment',()=>{
 const facts={sqm:120,ceiling_height_m:4.5,parking_spots:3,loading_access:true,blackout_possible:true,natural_light:false};
 assert.equal(matchesLocationDetails(facts,{sqm:'100',ceiling:'4.5',parking:'3',loading:'1',blackout:'1'}),true);
 for(const filter of [{sqm:'121'},{ceiling:'4.6'},{parking:'4'},{natural:'1'}])assert.equal(matchesLocationDetails(facts,filter),false);
 for(const missing of [undefined,{}, {sqm:'120',loading_access:'true'}])assert.equal(matchesLocationDetails(missing,{sqm:'100',loading:'1'}),false);
 assert.deepEqual(readLocationDetailFilters({sqm:'10,5',ceiling:'Infinity',parking:'-1',loading:true,blackout:'1',natural:'0',address:'private'}),{sqm:'10.5',blackout:'1'});
});
test('one place predicate treats country and region as the radius origin and preserves exact hierarchy without radius',()=>{
 const origin={country:'CH',region:'CH:basel',city:'geonames:2661604'},radius={city:origin.city,km:50,lat:47.5596,lng:7.5886};
 const rows=[{place_country_code:'CH',place_region_id:'CH:basel',place_city_id:origin.city,lat:47.56,lng:7.59},{place_country_code:'DE',place_region_id:'DE:bw',place_city_id:'synthetic-de',lat:47.59,lng:7.61},{place_country_code:'FR',place_region_id:'FR:alsace',place_city_id:'synthetic-fr',lat:47.58,lng:7.56},{place_country_code:'FR',lat:48.85,lng:2.35},{place_country_code:'DE',lat:null,lng:null}];
 assert.deepEqual(rows.map(row=>matchesBrowsePlace(row,origin,radius)),[true,true,true,false,false]);
 assert.deepEqual(rows.map(row=>matchesBrowsePlace(row,origin)),[true,false,false,false,false]);
 const locationRows=rows.map((row,index)=>({...row,id:String(index),title:'fixture',city:'public',type:'Studio',price:0,priceOnRequest:true,rating:0}));
 assert.deepEqual(filterLandingLocations(locationRows,{...DEFAULT_LOCATION_LANDING_FILTERS,...origin},x=>x,radius).map(r=>r.id),['0','1','2']);
});
test('public discovery projection whitelists existing dimensions/equipment, retaining no private address/notes/precise coordinates',()=>{
 const metadata={sqm:70,ceiling_height_m:3,parking_spots:2,loading_access:true,blackout_possible:false,natural_light:true,private_address:'private',address:'private',access_notes:'private',lat:52.123456,lng:13.123456,unknown:true};
 assert.deepEqual(publicLocationBrowseMetadata(metadata),{natural_light:true,blackout_possible:false,loading_access:true,sqm:70,ceiling_height_m:3,parking_spots:2});
 assert.deepEqual(publicLocationBrowseMetadata({sqm:NaN,ceiling_height_m:Infinity,parking_spots:-1,loading_access:1}),{});
});
test('actual landing filter applies details before result count/pagination, combines currency and category, resets and roundtrips URL',()=>{
 const row=(id,meta)=>({id,title:id,city:'Berlin',type:'Studio',price:200,priceOnRequest:false,rating:0,metadata:meta});
 const rows=[row('match',{sqm:100,ceiling_height_m:4,parking_spots:2,power_available:true,price_currency:'EUR'}),row('small',{sqm:20,ceiling_height_m:4,parking_spots:2,power_available:true}),row('unknown',{}),row('foreign',{sqm:100,ceiling_height_m:4,parking_spots:2,power_available:true,price_currency:'USD'})];
 const f={...DEFAULT_LOCATION_LANDING_FILTERS,type:'Studio',min:'100',currency:'EUR',sqm:'50',ceiling:'3',parking:'2',power:'1'};
 assert.deepEqual(filterLandingLocations(rows,f,x=>x).map(r=>r.id),['match']);
 const decoded=readLocationLandingFilters(Object.fromEntries(locationLandingParams(f)));
 assert.deepEqual(filterLandingLocations(rows,decoded,x=>x),filterLandingLocations(rows,f,x=>x));
 assert.equal(filterLandingLocations(rows,DEFAULT_LOCATION_LANDING_FILTERS,x=>x).length,4);
});
test('native indoor/outdoor selection requires a known public fact while the pre-existing ordinary website branch stays compatible',()=>{
 const row={title:'fixture',city:'public',type:'Studio',price:0,priceOnRequest:true,rating:0};
 const rows=[{...row,id:'both',metadata:{indoor_outdoor:'beides'}},{...row,id:'unknown'}],filters={...DEFAULT_LOCATION_LANDING_FILTERS,lage:'Innen & Außen'};
 assert.deepEqual(filterLandingLocations(rows,filters,x=>x,null,{requireFacts:true}).map(r=>r.id),['both']);
 assert.deepEqual(filterLandingLocations(rows,filters,x=>x).map(r=>r.id),['both','unknown']);
});
test('radius uses public points only, keeps original data, excludes missing/invalid positions only for an explicit valid radius',()=>{
 const city='geonames:2950159',center={place_city_id:city,place_status:'verified',lat:52.52,lng:13.405};
 assert.deepEqual(browseRadiusCenter([center],city),{lat:52.52,lng:13.405});
 assert.equal(browseRadiusCenter([{...center,lat:999}],city),null);
 const near={city,km:25,lat:52.52,lng:13.405},rows=Object.freeze([Object.freeze({lat:52.53,lng:13.41}),Object.freeze({lat:48.85,lng:2.35}),Object.freeze({lat:null,lng:null})]);
 assert.deepEqual(rows.map(row=>inBrowseRadius(row,near)),[true,false,false]);
 assert.ok(rows.every(row=>inBrowseRadius(row,null)));
 for(const km of [0,201,NaN,Infinity])assert.equal(inBrowseRadius(rows[0],{...near,km}),false);
});
