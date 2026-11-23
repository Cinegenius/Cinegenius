import test from 'node:test';
import assert from 'node:assert/strict';
import {readSearchBrowseFilters as read,hasSearchBrowseFilters,matchesBrowseFilters,publicBrowseFacets} from './browse-filters.ts';
import {placeCatalog,placeWriteFields} from './places/catalog.ts';
import {publicMapPoint} from './places/public-map-point.ts';
import {projectProfilePrivacy} from './profile-privacy.ts';
import {locationDistanceKm} from './location-map.ts';

const berlin=placeCatalog.cities.find(c=>c.name==='Berlin'&&c.country==='DE');
const place=placeWriteFields('Berlin, DE',berlin.id);

test('browse filters are closed, canonical, bounded and reset without inferred coordinates',()=>{
 assert.deepEqual(read(undefined),{version:1});assert.deepEqual(read({version:1,country:'',city:undefined,radiusKm:0,location:{sqm:'0',power:''},departments:[]}),{version:1});
 const normalized=read({version:1,city:berlin.id,companyCategories:['catering-setverpflegung','catering-setverpflegung'],location:{min:'12,50',max:'200',sqm:'25,25',loading:'1'}});
 assert.equal(normalized.country,'DE');assert.equal(normalized.region,berlin.region);assert.equal(normalized.location.min,'12.5');assert.equal(normalized.location.currency,'EUR');
 assert.deepEqual(normalized.companyCategories,['catering-setverpflegung']);assert.ok(hasSearchBrowseFilters(normalized,'locations'));
 for(const invalid of [null,{},true,{version:true},{version:2},{version:1,lat:52},{version:1,city:'Berlin'},{version:1,city:berlin.id,country:'US'},
  {version:1,radiusKm:20},{version:1,city:berlin.id,radiusKm:201},{version:1,city:berlin.id,radiusKm:NaN},{version:1,companyCategories:['forged']},
  {version:1,departments:Array(101).fill('licht')},{version:1,location:{secret:true}},{version:1,location:{min:'0 OR true'}},
  {version:1,location:{min:'20',max:'10'}},{version:1,location:{currency:'ZZZ'}},{version:1,location:{power:true}},
  {version:1,projectTypes:['<script>']},{version:1,jobTypes:['fulltime']}])assert.equal(read(invalid),null,JSON.stringify(invalid));
});

test('public facets preserve existing taxonomy IDs and explicit known aliases only',()=>{
 assert.equal(publicBrowseFacets('locations',{category:'Filmstudio'}).locationType,'Studio');
 for(const [raw,expected] of [['studio','Studio'],['filmstudio','Studio'],['STUDIO','Studio'],['BÜRO','Büro'],['Ｓｔｕｄｉｏ','Studio']]) {
  assert.equal(publicBrowseFacets('locations',{category:raw}).locationType,expected);
  assert.deepEqual(read({version:1,locationTypes:[raw]}).locationTypes,[expected]);
 }
 assert.deepEqual(publicBrowseFacets('companies',{categories:['catering-setverpflegung','unknown'],services:['Kamera & Objektive','drohnen','private arbitrary note']}).companyCategories,['catering-setverpflegung','drohnen']);
 assert.equal(publicBrowseFacets('jobs',{job:{employmentType:'praktikum',startDate:'',endDate:''}}).jobType,'praktikum');
 assert.equal(publicBrowseFacets('projects',{type:'Werbefilm / Commercial'}).projectType,'Werbung');
 for(const [raw,expected] of [['spielfilm','Spielfilm'],['WERBEFILM / COMMERCIAL','Werbung'],['dokumentarfilm','Dokumentation'],['Ｓｅｒｉｅ','Serie']]) {
  assert.equal(publicBrowseFacets('projects',{type:raw}).projectType,expected);
  assert.deepEqual(read({version:1,projectTypes:[raw]}).projectTypes,[expected]);
 }
 assert.equal(publicBrowseFacets('projects',{type:null,metadata:{type:'private arbitrary note'},project_type:'unselected alias'}).projectType,undefined,'only the explicit public type column supplies a project facet');
 assert.equal(read({version:1,projectTypes:['Public custom format']}).projectTypes[0],'Public custom format');
 for(const id of ['constructor','toString','__proto__']) {
  assert.equal(read({version:1,projectTypes:[id]}).projectTypes[0],id);
  assert.equal(read({version:1,locationTypes:[id]}).locationTypes[0],id);
 }
 assert.equal(publicBrowseFacets('locations',{category:'Bar'}).locationType,'Bar');
 assert.equal(publicBrowseFacets('locations',{category:'bar'}).locationType,'bar');
 assert.equal(publicBrowseFacets('projects',{type:'Public CUSTOM format'}).projectType,'Public CUSTOM format');
 assert.equal(matchesBrowseFilters('locations',{category:'Bar'},read({version:1,locationTypes:['Bar']})),true);
 const facets=publicBrowseFacets('crew',{...place,positions:['Gaffer'],role:'Gaffer'});
 assert.ok(facets.departments.includes('licht'));assert.equal(facets.place.city,berlin.id);assert.equal(facets.place.cityName,'Berlin');
 assert.ok(!JSON.stringify(facets).includes('lat'));
});

test('an explicit radius crosses country borders and never falls back to private/unknown points',()=>{
 const basel=placeCatalog.cities.find(c=>c.name==='Basel'&&c.country==='CH');assert.ok(basel);
 const centre=publicMapPoint({place_city_id:basel.id,place_country_code:basel.country,place_status:'verified'});
 const foreign=placeCatalog.cities.map(city=>({city,point:publicMapPoint({place_city_id:city.id,place_country_code:city.country,place_status:'verified'})}))
  .find(({city,point})=>city.country!==basel.country&&point.lat!==null&&locationDistanceKm([centre.lat,centre.lng],[point.lat,point.lng])<50);
 assert.ok(foreign,'the public catalogue supplies a genuine cross-border city centre near Basel');
 const row=placeWriteFields(foreign.city.name+', '+foreign.city.country,foreign.city.id);
 const radius=read({version:1,country:'CH',region:basel.region,city:basel.id,radiusKm:50});
 assert.equal(matchesBrowseFilters('companies',row,radius),true);
 assert.equal(matchesBrowseFilters('companies',row,read({version:1,country:'CH',city:basel.id})),false);
 assert.equal(matchesBrowseFilters('locations',{...row,location_area:{...foreign.point,radius_meters:500}},radius),true);
 assert.equal(matchesBrowseFilters('companies',{place_country_code:foreign.city.country,lat:foreign.point.lat,lng:foreign.point.lng},radius),false);
});

test('location details, exact currency and known prices are mandatory before a match',()=>{
 const f=read({version:1,locationTypes:['Studio'],location:{indoorOutdoor:'innen',currency:'EUR',min:'10',max:'200',sqm:'200',ceiling:'3',parking:'2',loading:'1',power:'1',natural:'1',blackout:'1'}});
 const row={category:'Studio',price:100,price_currency:'EUR',indoor_outdoor:'beides',sqm:250,ceiling_height_m:4,parking_spots:2,loading_access:true,power_available:true,natural_light:true,blackout_possible:true};
 assert.equal(matchesBrowseFilters('locations',row,f),true);
 for(const patch of [{sqm:undefined},{ceiling_height_m:2.9},{parking_spots:1},{loading_access:false},{power_available:false},{natural_light:false},{blackout_possible:false},{price_on_request:true},{price:0},{price_currency:'USD'},{indoor_outdoor:'außen'},{category:'Villa'}])assert.equal(matchesBrowseFilters('locations',{...row,...patch},f),false,JSON.stringify(patch));
 assert.equal(matchesBrowseFilters('companies',{categories:['drohnen']},f),true,'unrelated area filters do not constrain companies');
});

test('radius uses only public city centres or the public500metre area after privacy projection',()=>{
 const f=read({version:1,city:berlin.id,radiusKm:20}),point=publicMapPoint(place);
 assert.equal(matchesBrowseFilters('crew',{...place,location:'Berlin, DE'},f),true);
 const hidden=projectProfilePrivacy({...place,location:'Berlin, DE',lat:point.lat,lng:point.lng}, {profile:true,location:false,map:false,activity:false,phone:false,email:false});
 assert.equal(matchesBrowseFilters('crew',hidden,f),false);assert.equal(publicBrowseFacets('crew',hidden).place,undefined);
 assert.equal(matchesBrowseFilters('locations',{...place,location_area:{...point,radius_meters:500}},f),true);
 assert.equal(matchesBrowseFilters('locations',{place_country_code:'DE',lat:point.lat,lng:point.lng,private_location:{address:'secret',...point}},f),false,'raw/private location coordinates cannot create a match');
 assert.equal(matchesBrowseFilters('crew',{...place,map_visible:false,lat:point.lat,lng:point.lng},f),false,'map opt-out is not an inference source');
});
