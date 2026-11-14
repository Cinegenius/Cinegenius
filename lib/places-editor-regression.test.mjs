import * as nativeLocales from './i18n/locales.ts';
import {intlServerFor} from './i18n-test-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
import {placeReadFields,placeWriteFields,placeFieldsForId} from './places/catalog.ts';
import * as core from './places/core.ts';

const require=createRequire(import.meta.url);
const {NextRequest}=require('next/server');
function load(file,deps){
 const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports',source)(name=>deps[name]??require(name),mod,mod.exports);
 return mod.exports;
}

test('place options localize the explicitly selected language and reject unsupported languages',async()=>{
 let reads=0;
 const route=load('../app/api/places/options/route.ts',{
  'next-intl/server':intlServerFor(),'@/lib/i18n/locales':nativeLocales,
  '@/lib/marketplace-facets':{listingFacetRows:async(locale,types)=>{reads++;assert.deepEqual(types,['location']);return [placeReadFields('Florence, IT',placeWriteFields('Florence, IT','geonames:3176959'),locale)];}},
  '@/lib/places/catalog':{localizedPlaceFields:(await import('./places/catalog.ts')).localizedPlaceFields},
 });
 const en=await route.GET(new NextRequest('https://fixture.invalid/api/places/options?scope=locations&locale=en'));
 assert.equal(en.status,200);assert.match(en.headers.get('Cache-Control'),/no-store/);
 assert.match(en.headers.get('Vary'),/Cookie/);
 const english=(await en.json()).rows[0];
 const de=await route.GET(new NextRequest('https://fixture.invalid/api/places/options?scope=locations&locale=de'));
 const german=(await de.json()).rows[0];
 assert.equal(english.place_city_name,'Florence');assert.equal(german.place_city_name,'Florenz');
 assert.notEqual(english.place_region_name,german.place_region_name);
 assert.equal(english.place_city_id,german.place_city_id);
 assert.equal((await route.GET(new NextRequest('https://fixture.invalid/api/places/options?scope=locations&locale=xx'))).status,400);
 assert.equal(reads,2);
});

test('changing language refreshes canonical and legacy filter labels without changing selected identities',async()=>{
 let locale='de';const changes=[];
 const react={useId:()=> 'filter-test',useMemo:fn=>fn()};
 const {intlClientFor}=await import('./i18n-test-fixture.mjs');
 const component=load('../components/PlaceFilters.tsx',{'react':react,'next-intl':{useLocale:()=>locale,useTranslations:namespace=>intlClientFor(locale).useTranslations(namespace)},'@/lib/places/core':core}).default;
 const canonical=placeWriteFields('Florence, IT','geonames:3176959'),legacy=placeWriteFields('München');
 const nodes=(node,predicate)=>!node||typeof node!=='object'?[]:[...(predicate(node)?[node]:[]),...(Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(child=>Array.isArray(child)?child.flatMap(n=>nodes(n,predicate)):nodes(child,predicate))];
 const render=()=>component({rows:[placeReadFields('Florence, IT',canonical,locale),placeReadFields('München',legacy,locale)],value:{country:'IT',region:'',city:'geonames:3176959'},onChange:value=>changes.push(value)});
 for(const language of ['de','en']){
  locale=language;const tree=render(),options=nodes(tree,node=>node.type==='option');
  assert.ok(options.some(o=>o.props.value==='geonames:3176959'&&o.props.children.includes(language==='de'?'Florenz':'Florence')));
  const country=nodes(tree,node=>node.type==='select')[0];country.props.onChange({target:{value:'unassigned'}});
  assert.deepEqual(changes.at(-1),{country:'unassigned',region:'',city:''});
 }
});

test('profile saves preserve reviewed legacy places, round-trip their selected path, and resolve deliberate location edits',async()=>{
 let saved={user_id:'own-profile',display_name:'Own Name',location:'Cologne',positions:[],profile_types:['location'],...placeWriteFields('Köln, DE'),place_original:'Cologne'};
 const writes=[];
 const db=createClient('https://fixture.invalid','fixture-key',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const url=new URL(input);
  if(init.method==='POST'||init.method==='PATCH'){
   if(init.method==='PATCH')assert.equal(url.searchParams.get('user_id'),'eq.own-profile');
   const patch=JSON.parse(init.body);writes.push(patch);saved={...saved,...patch};
   return Response.json(saved);
  }
  assert.equal(url.searchParams.get('user_id'),'eq.own-profile');return Response.json(saved);
 }}});
 const deps={
  '@/lib/db':{db},'@/lib/auth':{requireAuth:async()=>({userId:'own-profile'})},
  '@clerk/nextjs/server':{clerkClient:async()=>({users:{updateUserMetadata:async()=>{}}})},
  'next/cache':{revalidateTag(){}},'next-intl/server':intlServerFor(),
  '@/lib/profile-types':await import('./profile-types.ts'),'@/lib/profile-display':await import('./profile-display.ts'),
  '@/lib/crew-occupations':await import('./crew-occupations.ts'),'@/lib/primary-occupation':await import('./primary-occupation.ts'),
  '@/lib/profile-cover':await import('./profile-cover.ts'),'@/lib/profile-db-compat':await import('./profile-db-compat.ts'),
 };
 const api=load('../app/api/profile/route.ts',deps);
 const request=(method,body)=>new NextRequest('https://fixture.invalid/api/profile',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const originalCity=saved.place_city_id;
 assert.equal((await api.POST(request('POST',{display_name:'Own Name',location:'Cologne',bio:'Edited bio',profile_types:['location']}))).status,200);
 assert.equal(saved.place_city_id,originalCity);assert.equal(saved.place_status,'verified');assert.equal(saved.place_original,'Cologne');
 assert.equal((await api.PATCH(request('PATCH',{location:'Cologne',bio:'Another change'}))).status,200);
 assert.equal(saved.place_city_id,originalCity);assert.equal(saved.place_original,'Cologne');
 const owner=(await(await api.GET()).json()).profile;
 const selectedPath=core.placeInputValue(owner,owner.location);
 assert.match(selectedPath,/DE$/);assert.equal(placeWriteFields(selectedPath).place_city_id,originalCity);
 assert.equal((await api.PATCH(request('PATCH',{location:'Berlin, DE',place_city_id:originalCity}))).status,200);
 assert.equal(saved.place_city_id,placeWriteFields('Berlin, DE').place_city_id);assert.notEqual(saved.place_city_id,originalCity);
 assert.equal(saved.place_original,'Berlin, DE');assert.equal(writes.length,3);
 // Members can explicitly select either of the two Ashfords in England.
 saved={...saved,location:'Ashford',...placeFieldsForId('geonames:2656954','Ashford, GB'),place_original:'Ashford'};
 const ashfordPath=core.placeInputValue(saved,saved.location);
 assert.equal(placeWriteFields(ashfordPath).place_status,'pending');
 assert.equal((await api.PATCH(request('PATCH',{location:ashfordPath,selected_place_city_id:'geonames:2656954'}))).status,200);
 assert.equal(saved.place_city_id,'geonames:2656954');assert.equal(saved.place_status,'verified');
 assert.equal((await api.PATCH(request('PATCH',{location:ashfordPath,selected_place_city_id:'geonames:2656955'}))).status,200);
 assert.equal(saved.place_city_id,'geonames:2656955');
 assert.equal((await api.POST(request('POST',{display_name:'Own Name',location:ashfordPath,profile_types:['location'],selected_place_city_id:'geonames:2656954'}))).status,200);
 assert.equal(saved.place_city_id,'geonames:2656954');
 // A forged cross-country identity never bypasses path validation, even when
 // the location text itself was left unchanged.
 assert.equal((await api.PATCH(request('PATCH',{location:ashfordPath,selected_place_city_id:originalCity}))).status,200);
 assert.notEqual(saved.place_city_id,originalCity);assert.equal(saved.place_status,'pending');
});
