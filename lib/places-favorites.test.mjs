import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
import {placeWriteFields} from './places/catalog.ts';
const require=createRequire(import.meta.url);
const {NextRequest}=require('next/server');

test('favorites display the current canonical place in the chosen language without rewriting snapshots or exposing private offers',async()=>{
 let locale='de';const requests=[];
 const snapshots=[{id:'favorite-public',listing_id:'public-offer',listing_city:'Cologne'},{id:'favorite-private',listing_id:'private-offer',listing_city:'Secret place'},{id:'favorite-missing',listing_id:'missing-offer',listing_city:'Old place'}];
 const listing={id:'public-offer',type:'prop',title:'Own fixture offer',city:'Cologne',price:0,image_url:null,...placeWriteFields('Köln, DE')};
 const db=createClient('https://fixture.invalid','fixture-key',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const url=new URL(input);assert.equal(init.method,'GET');requests.push(url);
  if(url.pathname.endsWith('/favorites')){assert.equal(url.searchParams.get('user_id'),'eq.own-member');return Response.json(snapshots);}
  assert.ok(url.pathname.endsWith('/listings'));assert.equal(url.searchParams.get('published'),'eq.true');assert.match(url.searchParams.get('select'),/place_city_id/);
  return Response.json([listing]);
 }}});
 const mocks={'@/lib/db':{db},'@/lib/auth':{getCurrentUser:async()=>({userId:'own-member'})},'@/lib/rateLimit':{rateLimit:async()=>({allowed:true})},'@/lib/listing-price':{listingPriceLabel:()=> 'fixture-price'},'next-intl/server':{getLocale:async()=>locale,getTranslations:async()=>key=>key}};
 const code=ts.transpileModule(readFileSync(new URL('../app/api/favorites/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};new Function('require','module','exports',code)(name=>mocks[name]??require(name),module,module.exports);
 const read=()=>module.exports.GET(new NextRequest('https://fixture.invalid/api/favorites'));
 const de=await read();assert.match(de.headers.get('Cache-Control'),/private.*no-store/);assert.deepEqual((await de.json()).favorites.map(row=>[row.listing_id,row.listing_city]),[['public-offer','Köln, Deutschland']]);
 locale='en';const en=await read();assert.equal((await en.json()).favorites[0].listing_city,'Cologne, Germany');
 assert.equal(snapshots[0].listing_city,'Cologne');assert.equal(requests.length,4);
});
