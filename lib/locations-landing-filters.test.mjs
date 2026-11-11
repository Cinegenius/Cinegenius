import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTranslator} from 'next-intl';
import {
 DEFAULT_LOCATION_LANDING_FILTERS as defaults,readLocationLandingFilters as read,
 locationLandingParams as params,filterLandingLocations as filter,locationLandingCategoryOptions as options,
} from './locations-landing-filters.ts';
import {locationCategoryLabel} from './location-category-labels.ts';

function translatorFor(locale,namespace){
 const messages=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'));
 return createTranslator({locale,messages,namespace,onError(error){throw error;}});
}

const base={title:'Own location',city:'München',type:'Studio',price:100,priceOnRequest:false,rating:4};
const place={place_country_code:'DE',place_region_id:'DE.BY',place_city_id:'geonames:2867714',place_city_name:'München',place_status:'verified'};
const rows=[
 {...base,...place,id:'munich-studio',title:'Helles Loft & Tageslicht',price:300,rating:4.5},
 {...base,...place,id:'munich-filmstudio',type:'Filmstudio',price:150},
 {...base,...place,id:'munich-photo',type:'Fotostudio',price:75},
 {...base,id:'vienna',title:'Own Vienna interior',city:'Wien',place_country_code:'AT',place_region_id:'AT.09',place_city_id:'geonames:2761369',place_city_name:'Wien',place_status:'verified',price:200},
 {...base,id:'pending-munich',type:'Villa',city:'München',place_country_code:null,place_region_id:null,place_city_id:null,place_city_name:'München',place_status:'pending',price:250},
 {...base,id:'munchenstein',type:'Schloss',city:'Münchenstein',place_country_code:'CH',place_region_id:'CH.BL',place_city_id:'own:munchenstein',place_city_name:'Münchenstein',place_status:'verified'},
 {...base,id:'frankfurt',type:'Garten',city:'Frankfurt am Main',place_country_code:'DE',place_region_id:'DE.HE',place_city_id:'geonames:2925533',place_city_name:'Frankfurt am Main',place_status:'verified'},
];
const ids=values=>values.map(row=>row.id);
const apply=(input,data=rows,label=value=>value)=>filter(data,read(input),label);

test('empty and old all-type parameters normalize to one immutable default without inventing place IDs',()=>{
 assert.deepEqual(read({}),{q:'',cityText:'',country:'',region:'',city:'',type:'',min:'',max:'',sort:'featured'});
 assert.deepEqual(read({type:'All Types',sort:'unrecognized'}),defaults);
 assert.equal(read({type:' Filmstudio '}).type,'Studio');assert.equal(read({type:'Fotostudio'}).type,'Fotostudio');
 assert.equal(read({city:'Munich'}).city,'Munich');assert.equal(read({cityText:'Munich'}).city,'');assert.equal(read({country:'Germany'}).country,'Germany');
 assert.equal(Object.isFrozen(defaults),true);assert.equal(params(defaults).toString(),'');
});

test('query arrays use their first item and public input lengths are bounded without truncating an ID into another one',()=>{
 const parsed=read({q:[' first <member text> ','second'],type:['Filmstudio','Fotostudio'],cityText:'x'.repeat(121),city:'g'.repeat(101),region:'valid-region',country:'DE',sort:['rating','price-asc']});
 assert.equal(parsed.q,'first <member text>');assert.equal(parsed.type,'Studio');assert.equal(parsed.cityText.length,120);assert.equal(parsed.city,'');assert.equal(parsed.region,'valid-region');assert.equal(parsed.sort,'rating');
 assert.equal(read({q:'q'.repeat(201)}).q.length,200);assert.equal(read({q:'a\u0000b\n'}).q,'a b');assert.equal(read({city:'own\u0000id'}).city,'');
 assert.deepEqual(read({q:[],min:[],type:[]}),defaults);
});

test('price input accepts explicit nonnegative decimal bounds and drops malformed or excessive amounts',()=>{
 assert.equal(read({min:'0012,50',max:'1000000.00'}).min,'12.5');assert.equal(read({max:'1000000.00'}).max,'1000000');assert.equal(read({min:'0'}).min,'0');
 for(const value of ['-1','NaN','Infinity','1e3','0x10','12 euros','1.234','1,2,3','1000000.01','1'.repeat(21)])assert.equal(read({min:value,max:value}).min,'',value);
 assert.equal(read({sort:'price-asc'}).sort,'price-asc');assert.equal(read({sort:'price-desc'}).sort,'price-desc');
});

test('URL roundtrips preserve compatible parameter names and literal text while omitting defaults and unknown keys',()=>{
 const input={q:' A & B + <member text> ',cityText:'München',country:'DE',region:'DE.BY',city:'geonames:2867714',type:'Filmstudio',min:'12,50',max:'500',sort:'price-desc',irrelevant:'ignored'};
 const normalized=read(input),url=params(normalized);
 assert.deepEqual([...url.keys()],['q','cityText','country','region','city','type','min','max','sort']);assert.equal(url.get('q'),'A & B + <member text>');assert.equal(url.get('type'),'Studio');
 assert.deepEqual(read(Object.fromEntries(new URLSearchParams(url.toString()))),normalized);
 assert.equal(params(read({sort:'featured'})).has('sort'),false);assert.equal(url.has('irrelevant'),false);
});

test('canonical country, region and city filters combine as exact IDs; free text never becomes a canonical selection',()=>{
 assert.deepEqual(ids(apply({country:'DE',region:'DE.BY',city:'geonames:2867714'})),['munich-studio','munich-filmstudio','munich-photo']);
 assert.deepEqual(ids(apply({country:'AT',city:'geonames:2867714'})),[]);assert.deepEqual(ids(apply({city:'Munich'})),[]);
 assert.deepEqual(ids(apply({country:'DE',cityText:'Munich'})),['munich-studio','munich-filmstudio','munich-photo']);
 assert.deepEqual(ids(apply({cityText:'Munich'})),['munich-studio','munich-filmstudio','munich-photo','pending-munich']);
 assert.deepEqual(ids(apply({country:'DE',cityText:'Vienna'})),[]);
 assert.deepEqual(ids(apply({cityText:'Frankfurt a.M.'})),['frankfurt']);
});

test('Studio and Filmstudio are one exact category while Fotostudio and unknown valid types remain distinct',()=>{
 assert.deepEqual(ids(apply({type:'Studio'})),['munich-studio','munich-filmstudio','vienna']);
 assert.deepEqual(ids(apply({type:'Filmstudio'})),['munich-studio','munich-filmstudio','vienna']);
 assert.deepEqual(ids(apply({type:'Fotostudio'})),['munich-photo']);assert.deepEqual(ids(apply({type:'Schloss'})),['munchenstein']);
 assert.deepEqual(ids(apply({type:'Studio',cityText:'Munich',min:'150',max:'250'})),['munich-filmstudio']);
});

test('search covers member titles, city aliases and original type names across fields without punctuation matching every place',()=>{
 assert.deepEqual(ids(apply({q:'Helles Loft'})),['munich-studio']);assert.deepEqual(ids(apply({q:'LOFT Munich'})),['munich-studio']);
 assert.deepEqual(ids(apply({q:'Frankfurt a.M.'})),['frankfurt']);assert.deepEqual(ids(apply({q:'Filmstudio'})),['munich-studio','munich-filmstudio','vienna']);
 assert.deepEqual(ids(apply({q:'!!!'})),[]);assert.deepEqual(ids(apply({cityText:'!!!'})),[]);
 assert.deepEqual(ids(apply({q:'nonexistent word'})),[]);assert.deepEqual(ids(apply({cityText:'Munich'})).includes('munchenstein'),false);
});

const priceRows=[
 {...base,id:'request-zero',price:0,priceOnRequest:true,rating:5},
 {...base,id:'hundred-a',price:100},
 {...base,id:'not-a-number',price:NaN},
 {...base,id:'fifty',price:50,rating:4.9},
 {...base,id:'request-with-amount',price:500,priceOnRequest:true},
 {...base,id:'negative',price:-1},
 {...base,id:'hundred-b',price:100},
 {...base,id:'infinite',price:Infinity},
 {...base,id:'legacy-zero',price:0},
];

test('price ranges are inclusive and never treat on-request, legacy-zero or invalid amounts as priced offers',()=>{
 assert.deepEqual(ids(apply({min:'0'},priceRows)),['hundred-a','fifty','hundred-b']);
 assert.deepEqual(ids(apply({max:'100'},priceRows)),['hundred-a','fifty','hundred-b']);
 assert.deepEqual(ids(apply({min:'100',max:'100'},priceRows)),['hundred-a','hundred-b']);
 assert.deepEqual(ids(apply({max:'0'},priceRows)),[]);assert.deepEqual(ids(apply({min:'500',max:'100'},priceRows)),[]);
 assert.deepEqual(ids(apply({min:'invalid'},priceRows)),ids(priceRows),'an invalid bound normalizes to no bound, not a fabricated zero price');
});

test('both price orders put unknown amounts last and retain source order within tied and unknown prices',()=>{
 const unknown=['request-zero','not-a-number','request-with-amount','negative','infinite','legacy-zero'];
 assert.deepEqual(ids(apply({sort:'price-asc'},priceRows)),['fifty','hundred-a','hundred-b',...unknown]);
 assert.deepEqual(ids(apply({sort:'price-desc'},priceRows)),['hundred-a','hundred-b','fifty',...unknown]);
});

test('featured keeps exact source order and rating sort uses actual rating independently of missing prices',()=>{
 assert.deepEqual(ids(apply({},priceRows)),ids(priceRows));assert.deepEqual(ids(apply({sort:'invalid'},priceRows)),ids(priceRows));
 const ranked=apply({sort:'rating'},priceRows);assert.deepEqual(ids(ranked).slice(0,2),['request-zero','fifty']);
 assert.deepEqual(ids(ranked).slice(2),ids(priceRows).filter(id=>!['request-zero','fifty'].includes(id)));
});

test('combining filters and every sort leaves frozen source objects and their order untouched',()=>{
 const frozen=Object.freeze(rows.map(row=>Object.freeze({...row}))),before=structuredClone(frozen);
 for(const sort of ['featured','price-asc','price-desc','rating']){
  const result=apply({country:'DE',cityText:'Munich',type:'Filmstudio',min:'100',max:'500',sort},frozen);
  assert.notEqual(result,frozen);assert.ok(result.every(row=>frozen.includes(row)));assert.deepEqual(frozen,before);
 }
});

test('category options deduplicate aliases and casing, keep unknown valid member types and preserve an absent selection',()=>{
 const source=[{type:'Filmstudio'},{type:'Studio'},{type:'Fotostudio'},{type:'Schloss'},{type:'schloss'},{type:'Gärten'},{type:'Garten'},{type:'All Types'},{type:''},{type:'x'.repeat(101)}];
 const before=structuredClone(source),result=options(source,value=>value,'de');
 assert.deepEqual(new Set(result.map(option=>option.value)),new Set(['Studio','Fotostudio','Schloss','Gärten','Garten']));
 assert.deepEqual(source,before);assert.deepEqual(options([],value=>value,'de','Dachterrasse'),[{value:'Dachterrasse',label:'Dachterrasse'}]);
 assert.deepEqual(options([{type:'Schloss'}],value=>value,'de','schloss'),[{value:'schloss',label:'Schloss'}]);
 assert.deepEqual(options([{type:'Filmstudio'}],value=>value,'de','Studio'),[{value:'Studio',label:'Studio'}]);
});

for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv'])test(`${locale}: native category labels search correctly and options follow current-language alphabetical order`,()=>{
 const t=translatorFor(locale,'menu'),label=value=>locationCategoryLabel(value,t);
 assert.deepEqual(ids(apply({q:label('Studio')},rows,label)),['munich-studio','munich-filmstudio','vienna']);
 assert.deepEqual(ids(apply({q:label('Fotostudio')},rows,label)),['munich-photo']);
 const result=options([{type:'Studio'},{type:'Filmstudio'},{type:'Fotostudio'},{type:'Wohnen'},{type:'Natur'},{type:'Büro'},{type:'Member’s <XML> & Č place'}],label,locale);
 assert.equal(result.length,6);assert.equal(result.find(option=>option.value==='Studio').label,t('locFilmStudio'));
 assert.equal(result.find(option=>option.value==='Fotostudio').label,t('locPhotoStudio'));
 assert.equal(result.find(option=>option.value==='Member’s <XML> & Č place').label,'Member’s <XML> & Č place');
 const collator=new Intl.Collator(locale,{sensitivity:'base',numeric:true});
 for(let index=1;index<result.length;index++)assert.ok(collator.compare(result[index-1].label,result[index].label)<=0,locale);
 assert.equal(params(read({type:'Studio'})).get('type'),'Studio','stored category values never become translated labels');
});
