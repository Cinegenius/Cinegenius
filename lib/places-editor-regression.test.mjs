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
  'next-intl/server':{getLocale:async()=> 'de'},
  '@/lib/db':{db:{rpc:async(name,args)=>{reads++;assert.equal(name,'public_place_options');assert.deepEqual(args,{p_scope:'locations'});return{data:[placeWriteFields('Florence, IT','geonames:3176959')],error:null};}}},
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

test('changing language refreshes filter suggestions and ignores an older-language response',async()=>{
 let locale='de',cursor=0;
 const state=[],effects=[],pending=[];
 const react={
  useId:()=> 'filter-test',
  useState:initial=>{const index=cursor++;if(!(index in state))state[index]=initial;return[state[index],value=>{state[index]=value;}];},
  useEffect:(run,deps)=>{const index=cursor++,old=effects[index];if(!old||deps.some((value,i)=>value!==old.deps[i])){old?.cleanup?.();effects[index]={deps,run};}},
 };
 const component=load('../components/PlaceFilters.tsx',{'react':react,'next-intl':{useLocale:()=>locale,useTranslations:()=>key=>key},'@/lib/places/core':core}).default;
 const savedFetch=globalThis.fetch;
 globalThis.fetch=(url,options)=>new Promise(resolve=>pending.push({url,options,resolve}));
 const row=placeWriteFields('Florence, IT','geonames:3176959'), props=()=>({rows:[placeReadFields('Florence, IT',row,locale)],value:{country:'',region:'',city:''},onChange(){},scope:'locations'});
 const render=()=>{cursor=0;const tree=component(props());for(const effect of effects){if(effect?.run){effect.cleanup=effect.run();delete effect.run;}}return tree;};
 const textOf=node=>node==null||typeof node==='boolean'?'':typeof node==='string'?node:Array.isArray(node)?node.map(textOf).join(' '):textOf(node.props?.children);
 const respond=async(index,language)=>{pending[index].resolve({ok:true,json:async()=>({rows:[placeReadFields('Florence, IT',row,language)]})});await Promise.resolve();await Promise.resolve();await Promise.resolve();};
 try{
  render();assert.match(pending[0].url,/locale=de/);
  locale='en';const englishTree=render();assert.match(textOf(englishTree),/Florence/);assert.doesNotMatch(textOf(englishTree),/Florenz/);
  assert.equal(pending[0].options.signal.aborted,true);assert.match(pending[1].url,/locale=en/);
  await respond(1,'en');assert.match(textOf(render()),/Florence/);
  await respond(0,'de');assert.match(textOf(render()),/Florence/);assert.doesNotMatch(textOf(render()),/Florenz/);
 }finally{globalThis.fetch=savedFetch;for(const effect of effects)effect?.cleanup?.();}
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
  'next/cache':{revalidateTag(){}},'next-intl/server':{getTranslations:async()=>key=>key},
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
