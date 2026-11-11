import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {NextRequest,NextResponse} from 'next/server.js';
import * as places from './places/catalog.ts';
import * as placeCore from './places/core.ts';
import * as catalog from './marketplaceCategories.ts';
import {intlServerFor} from './i18n-test-fixture.mjs';

const locales=['de','en','es','it','cs','hu','nl','nl-BE','sv'];
const cologne=places.placeCatalog.cities.find(city=>city.id==='geonames:2886242');
function offer(id,overrides={}){return{id,type:'prop',category:'licht-signal',title:'Fixture camera',description:'Fixture description',price:10,city:'Köln, DE',published:true,created_at:id,
 place_country_code:'DE',place_region_id:cologne.region,place_city_id:cologne.id,place_city_name:'Köln',place_region_name:'North Rhine-Westphalia',place_status:'verified',...overrides};}
function split(text){let depth=0,quoted=false,escaped=false,start=0;const values=[];for(let i=0;i<text.length;i++){
 if(quoted&&text[i]==='\\'&&!escaped){escaped=true;continue;}
 if(text[i]==='"'&&!escaped)quoted=!quoted;escaped=false;
 if(!quoted){if(text[i]==='(')depth++;if(text[i]===')')depth--;if(text[i]===','&&depth===0){values.push(text.slice(start,i));start=i+1;}}
}return[...values,text.slice(start)];}

function matches(row,expression){
 if(expression.startsWith('and('))return split(expression.slice(4,-1)).every(value=>matches(row,value));
 const match=/^(.*?)\.(eq|is|in|ilike)\.(.*)$/.exec(expression);assert.ok(match,`Supported controlled filter: ${expression}`);
 const[,field,op,value]=match,actual=field.startsWith('metadata->>')?row.metadata?.[field.slice(11)]:row[field];
 if(op==='eq')return String(actual)===value;if(op==='is')return actual==null;
 if(op==='in')return split(value.slice(1,-1)).map(item=>item.replace(/^"|"$/g,'')).includes(String(actual));
 const literal=value.startsWith('"')?JSON.parse(value):value;
 return literal.includes('%')?String(actual??'').toLowerCase().includes(literal.replaceAll('%','').toLowerCase()):String(actual??'').toLowerCase()===literal.toLowerCase();
}
function fixture(rows,locale='de',core=placeCore){
 const calls=[],writes=[];
 const db={from(table){assert.equal(table,'listings');const call={table,operations:[]};calls.push(call);const predicates=[],orders=[];let range,count=false,columns='';
  const q={
   select(value,options){columns=value;count=options?.count==='exact';call.operations.push(['select',value,options]);return q;},
   eq(field,value){predicates.push(row=>row[field]===value);call.operations.push(['eq',field,value]);return q;},
   in(field,values){predicates.push(row=>values.includes(row[field]));call.operations.push(['in',field,values]);return q;},
   or(expression){predicates.push(row=>split(expression).some(value=>matches(row,value)));call.operations.push(['or',expression]);return q;},
   order(field,options={ascending:true}){orders.push([field,options.ascending]);call.operations.push(['order',field,options]);return q;},
   range(from,to){range=[from,to];call.operations.push(['range',from,to]);return q;},
   then(resolve,reject){return Promise.resolve().then(()=>{
    let data=rows.filter(row=>predicates.every(predicate=>predicate(row)));
    for(const[field,ascending]of orders.toReversed())data.sort((a,b)=>(a[field]>b[field]?1:a[field]<b[field]?-1:0)*(ascending?1:-1));
    const total=data.length;if(range)data=data.slice(range[0],range[1]+1);
    data=data.map(row=>Object.fromEntries(columns.split(',').map(value=>value.trim()).filter(value=>value&&!value.includes(':')).map(field=>[field,row[field]])));
    return{data,error:null,...(count?{count:total}:{})};
   }).then(resolve,reject);},
  };return q;
 }};
 const mocks={
  'next/server':{NextRequest,NextResponse},'next-intl/server':intlServerFor(locale),
  '@/lib/db':{db},'@/lib/places/catalog':places,'@/lib/places/core':core,'@/lib/marketplaceCategories':catalog,
  '@/lib/auth':{requireAuth:async()=>NextResponse.json({code:'account'},{status:401})},
  '@/lib/marketplace-offer':{},'@/lib/offer-moderation':{OFFER_MODERATION_COLUMNS:'moderation_status'},
  '@/lib/responsible-person':{},'@/lib/responsible-person-server':{},'@/lib/listing-access':{},
  '@/lib/listing-price':{listingPriceLabel:()=> 'Fixture price'},'@/lib/listing-image-gallery':{},
  '@/lib/rateLimit':{rateLimit:()=>{writes.push('rate');throw new Error('GET must not write');}},'next/cache':{},
 };
 const code=ts.transpileModule(readFileSync(new URL('../app/api/listings/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const loaded={exports:{}};new Function('require','module','exports',code)(name=>{assert.ok(Object.hasOwn(mocks,name),`Unexpected dependency ${name}`);return mocks[name];},loaded,loaded.exports);
 return{calls,writes,read:async(values={})=>{
  const response=await loaded.exports.GET(new NextRequest('https://fixture.invalid/api/listings?'+new URLSearchParams(values)));
  assert.match(response.headers.get('cache-control')??'',/no-store/);return{response,body:await response.json()};
 }};
}
for(const locale of locales)test(`cityText ${locale}: native Cologne alias searches public places without guessing/writing a city ID`,async()=>{
 const f=fixture([offer('public'),offer('draft',{published:false})],locale);
 const{response,body}=await f.read({marketplace:'1',cityText:cologne.names[locale]??cologne.name});
 assert.equal(response.status,200);assert.equal(body.count,1);assert.deepEqual(body.data.map(row=>row.id),['public']);
 assert.equal(body.data[0].place_city_id,cologne.id);assert.deepEqual(f.writes,[]);
 const operations=f.calls[0].operations;assert.ok(operations.some(op=>op[0]==='eq'&&op[1]==='published'&&op[2]===true));
 assert.equal(operations.some(op=>op[0]==='eq'&&op[1]==='place_city_id'),false,'free text must not become a canonical-ID predicate');
 const projection=operations.find(op=>op[0]==='select')[1];assert.doesNotMatch(projection,/user_id|responsible_person|blocked_dates|metadata,/);
});
test('cityText is an additional AND filter beside keyword/category and authoritative city/country/region IDs',async()=>{
 const f=fixture([offer('camera'),offer('other',{title:'Other article'}),offer('berlin',{city:'Berlin',place_city_id:'geonames:2950159',place_city_name:'Berlin'})]);
 assert.equal((await f.read({marketplace:'1',cityText:'Cologne',q:'camera'})).body.count,1);
 assert.equal((await f.read({marketplace:'1',cityText:'Cologne',country:'BE'})).body.count,0);
 assert.equal((await f.read({marketplace:'1',cityText:'Cologne',city:'geonames:2950159'})).body.count,0);
 assert.equal((await f.read({marketplace:'1',cityText:'Cologne',city:cologne.id,region:cologne.region})).body.count,2);
});
test('text filtering precedes exact count and every page, including matching rows beyond the initial page',async()=>{
 const rows=[...Array.from({length:55},(_,i)=>offer(String(i).padStart(3,'0'))),...Array.from({length:45},(_,i)=>offer('other-'+i,{city:'Berlin',place_city_id:'geonames:2950159',place_city_name:'Berlin'}))];
 const f=fixture(rows),ids=[];
 for(const page of [1,2,3]){const{body}=await f.read({marketplace:'1',cityText:'Cologne',page:String(page),limit:'24'});assert.equal(body.count,55);assert.equal(body.data.length,page===3?7:24);ids.push(...body.data.map(row=>row.id));}
 assert.equal(new Set(ids).size,55);
 for(const call of f.calls)assert.ok(call.operations.findIndex(op=>op[0]==='or')<call.operations.findIndex(op=>op[0]==='range'));
});
test('same-name cities retain separate identities and an unknown international label keeps its pending record',async()=>{
 const ashfords=places.placeCatalog.cities.filter(city=>city.name==='Ashford').slice(0,2);assert.equal(ashfords.length,2);
 const rows=ashfords.map((city,index)=>offer('ashford-'+index,{city:'Ashford',place_country_code:city.country,place_region_id:city.region,place_city_id:city.id,place_city_name:city.name}));
 rows.push(offer('unknown',{city:'Opaque village, CH',place_country_code:'CH',place_city_id:null,place_city_name:'Opaque village',place_region_id:null,place_region_name:'',place_status:'pending'}));
 const f=fixture(rows);assert.equal((await f.read({marketplace:'1',cityText:'Ashford'})).body.count,2);
 const precise=(await f.read({marketplace:'1',cityText:'Ashford',city:ashfords[1].id})).body;assert.equal(precise.count,1);assert.equal(precise.data[0].place_city_id,ashfords[1].id);
 const pending=(await f.read({marketplace:'1',cityText:'Opaque village'})).body;assert.equal(pending.count,1);assert.equal(pending.data[0].place_status,'pending');assert.equal(pending.data[0].place_city_id,null);
});
test('cityText cannot inject publication conditions and never changes the private mine authentication contract',async()=>{
 const f=fixture([offer('public'),offer('private',{published:false})]);
 const injected=await f.read({marketplace:'1',cityText:'Cologne),published.eq.false,(city.ilike.*'});assert.equal(injected.response.status,200);assert.equal(injected.body.count,0);
 const before=f.calls.length;const mine=await f.read({mine:'true',cityText:'Cologne'});assert.equal(mine.response.status,401);assert.equal(f.calls.length,before);assert.deepEqual(f.writes,[]);
});

test('commas, parentheses and quotes in original place labels stay literal in the public filter',async()=>{
 for(const text of ['Village, District','Town (North)','Town "North"']){
  const f=fixture([offer('literal',{city:text,place_city_id:null,place_city_name:text,place_status:'pending'}),offer('other',{city:'Unrelated',place_city_name:'Unrelated'})]);
  const result=await f.read({marketplace:'1',cityText:text});assert.equal(result.response.status,200);assert.equal(result.body.count,1);assert.equal(result.body.data[0].id,'literal');
 }
});

function pendingMunich(id,overrides={}){return offer(id,{type:'location',city:'München',place_country_code:null,place_region_id:null,place_city_id:null,place_city_name:'München',place_region_name:null,place_status:'pending',...overrides});}
for(const locale of locales)test(`pending Munich ${locale}: three legacy labels alias-match without changing IDs, country or status`,async()=>{
 const rows=[pendingMunich('one'),pendingMunich('two'),pendingMunich('three'),pendingMunich('private',{published:false})];
 const before=structuredClone(rows),f=fixture(rows,locale),munich=places.placeCatalog.cities.find(city=>city.id==='geonames:2867714');
 const native=(await f.read({type:'location',cityText:'München'})).body;
 const translated=(await f.read({type:'location',cityText:munich.names[locale]??munich.name})).body;
 assert.equal(translated.count,3);assert.equal(native.count,3);assert.deepEqual(translated.data.map(row=>row.id).sort(),['one','three','two']);
 for(const row of translated.data){assert.equal(row.place_city_id,null);assert.equal(row.place_country_code,null);assert.equal(row.place_region_id,null);assert.equal(row.place_status,'pending');assert.equal(row.city,'München');}
 assert.deepEqual(rows,before);assert.deepEqual(f.writes,[]);
});
test('legacy alias branches require NULL city IDs and never override country, region or city-ID constraints',async()=>{
 const f=fixture([pendingMunich('pending'),pendingMunich('wrong-canonical',{place_city_id:'geonames:12345'}),pendingMunich('other-town',{city:'Münchenstein',place_city_name:'Münchenstein'})]);
 const result=(await f.read({type:'location',cityText:'Munich'})).body;assert.deepEqual(result.data.map(row=>row.id),['pending']);
 for(const values of [{city:'geonames:2867714'},{country:'DE'},{region:'DE:geonames:2951839'}])assert.equal((await f.read({type:'location',cityText:'Munich',...values})).body.count,0);
 assert.equal((await f.read({type:'location',cityText:'Muni'})).body.count,0);
 assert.equal((await f.read({type:'location',cityText:'Germany'})).body.count,0);
});
test('legacy alias filtering keeps exact counts across all pages and preserves publication filtering',async()=>{
 const f=fixture([...Array.from({length:55},(_,i)=>pendingMunich(String(i).padStart(3,'0'))),pendingMunich('private',{published:false})]);const ids=[];
 for(const page of [1,2,3]){const{body}=await f.read({type:'location',cityText:'Munich',page:String(page),limit:'24'});assert.equal(body.count,55);assert.equal(body.data.length,page===3?7:24);ids.push(...body.data.map(row=>row.id));}
 assert.equal(new Set(ids).size,55);assert.deepEqual(f.writes,[]);
 for(const call of f.calls){const expression=call.operations.find(op=>op[0]==='or')[1];assert.match(expression,/and\(place_city_id\.is\.null,place_city_name\.ilike\."München"\)/);assert.doesNotMatch(expression,/place_city_name\.ilike\."%München%"/);}
});
test('catalog-owned alias punctuation stays literal and cannot alter NULL-ID/publication guards',async()=>{
 const literal='Town "Quoted"),published.eq.false';
 const rows=[pendingMunich('literal',{city:literal,place_city_name:literal}),pendingMunich('private',{city:literal,place_city_name:literal,published:false}),pendingMunich('foreign-id',{city:literal,place_city_name:literal,place_city_id:'geonames:12345'})];
 const f=fixture(rows,'de',{...placeCore,placeCitySearchAliases:()=>[literal]});const result=(await f.read({type:'location',cityText:'Known fixed alias'})).body;
 assert.equal(result.count,1);assert.equal(result.data[0].id,'literal');assert.equal(result.data[0].place_city_id,null);
});
