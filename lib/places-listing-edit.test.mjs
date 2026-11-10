import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
import * as catalog from './places/catalog.ts';
import {PLACE_COLUMNS, placeInputValue} from './places/core.ts';
import {listingPlaceEditFields} from './listing-place-edit.ts';
import * as marketplace from './marketplace-offer.ts';
import * as moderation from './offer-moderation.ts';
import * as responsibility from './responsible-person.ts';
import * as pricing from './listing-price.ts';
import * as gallery from './listing-image-gallery.ts';

const require=createRequire(import.meta.url);
const {NextRequest}=require('next/server');
const fields=row=>Object.fromEntries([...PLACE_COLUMNS.split(','),'place_original'].map(key=>[key,row[key]]));

function fixture(place={city:'Cologne',...catalog.placeFieldsForId('geonames:2886242','Köln, DE'),place_original:'Cologne'}) {
 let saved={id:'own-location',user_id:'own-member',company_id:null,type:'location',title:'Own fixture location',category:'Studio',description:'Own description',published:true,responsible_person:{userId:'own-member'},...place};
 const writes=[];
 const db=createClient('https://fixture.invalid','fixture-key',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const url=new URL(input);
  assert.equal(url.pathname,'/rest/v1/listings');
  assert.equal(url.searchParams.get('id'),'eq.own-location');
  if(init.method==='PATCH'){
   const patch=JSON.parse(init.body);writes.push(patch);saved={...saved,...patch};
   return Response.json(saved);
  }
  // Honor the real projection so preservation requires fetching the old city
  // and status, rather than accidentally relying on an over-broad test stub.
  return Response.json(Object.fromEntries(url.searchParams.get('select').split(',').map(key=>[key,saved[key]])));
 }}});
 const dependencies={
  '@/lib/places/catalog':catalog,'@/lib/marketplace-offer':marketplace,
  '@/lib/offer-moderation':moderation,'@/lib/responsible-person':responsibility,
  '@/lib/responsible-person-server':{validateResponsiblePerson:async()=>({person:saved.responsible_person})},
  '@/lib/listing-price':pricing,'@/lib/listing-image-gallery':gallery,
  '@/lib/db':{db},'@/lib/auth':{requireAuth:async()=>({userId:'own-member'})},
  '@/lib/listing-access':{canEditListing:async(user,row)=>user===row.user_id},
  'next-intl/server':{getTranslations:async()=>key=>key},
  'next/cache':{revalidatePath(){},revalidateTag(){}},
 };
 const source=ts.transpileModule(readFileSync(new URL('../app/api/listings/[id]/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports',source)(name=>dependencies[name]??require(name),mod,mod.exports);
 return {writes,row:()=>saved,patch:body=>mod.exports.PATCH(new NextRequest('https://fixture.invalid/api/listings/own-location',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({id:'own-location'})})};
}

test('listing edits preserve reviewed legacy places when an old draft resends an unchanged city without its ID',async()=>{
 const f=fixture(),before=fields(f.row());
 assert.equal((await f.patch({description:'Own edited description',city:'  Cologne  '})).status,200);
 assert.deepEqual(fields(f.row()),before);
 assert.equal(f.row().description,'Own edited description');
 assert.equal(Object.keys(f.writes[0]).some(key=>key.startsWith('place_')),false);
 assert.equal((await f.patch({description:'Own second edit'})).status,200);
 assert.deepEqual(fields(f.row()),before);
});

test('unchanged pending listings preserve known countries and regions without inventing a verified city',async()=>{
 for(const place of [
  {city:'Oberösterreich',...catalog.placeWriteFields('Oberösterreich, AT'),place_original:'Oberösterreich'},
  {city:'  Oberösterreich  ',...catalog.placeWriteFields('Oberösterreich, AT'),place_original:'  Oberösterreich  '},
  {city:'Own unknown village',...catalog.placeWriteFields('Own unknown village, AT')},
 ]) {
  const f=fixture(place),before=fields(f.row());
  assert.equal((await f.patch({city:`  ${place.city}  `,description:'Own pending edit'})).status,200);
  assert.deepEqual(fields(f.row()),before);
  assert.equal(f.row().city,place.city);
  assert.equal(f.writes[0].city,place.city,'Preserve exact raw text for the database change trigger');
  assert.equal(f.row().place_status,'pending');
  assert.equal(f.row().place_city_id,null);
  assert.equal(f.row().description,'Own pending edit');
  assert.equal(Object.keys(f.writes[0]).some(key=>key.startsWith('place_')),false);
  const displayed=catalog.placeReadFields(f.row().city,f.row(),'de');
  assert.equal(displayed.place_country_code,'AT');
  assert.equal(displayed.place_region_id,before.place_region_id);
 }
});

test('dashboard description edits preserve pending regions and selected cities across the formatted editor path',async()=>{
 for(const place of [
  {city:'  Oberösterreich  ',...catalog.placeWriteFields('Oberösterreich, AT'),place_original:'  Oberösterreich  '},
  {city:'Own unknown village',...catalog.placeWriteFields('Own unknown village, AT')},
  {city:'Ashford',...catalog.placeFieldsForId('geonames:2656954','Ashford, England, GB')},
 ]) {
  const f=fixture(place),before=fields(f.row());
  const editorPath=placeInputValue(f.row(),f.row().city);
  assert.notEqual(editorPath,place.city);
  const patch=listingPlaceEditFields(f.row(),editorPath,f.row().place_city_id || '');
  assert.deepEqual(patch,{});
  assert.equal((await f.patch({...patch,description:'Own description edited in dashboard'})).status,200);
  assert.deepEqual(fields(f.row()),before);
  assert.equal(f.row().city,place.city);
  assert.equal(f.row().description,'Own description edited in dashboard');
  assert.equal('city' in f.writes[0],false);
 }
 const source=readFileSync(new URL('../app/dashboard/page.tsx',import.meta.url),'utf8');
 assert.match(source,/const placeEdit = listingPlaceEditFields\(editingListing, editForm\.city, editForm\.selected_place_city_id\)/);
 assert.match(source,/body: JSON\.stringify\(\{[\s\S]*?\.\.\.placeEdit,/);
 assert.match(source,/city: savedListing\?\.city \?\? placeEdit\.city \?\? l\.city/);
});

test('dashboard place edits still submit a changed city, explicit selection, or clearing',async()=>{
 const region=fixture({city:'Oberösterreich',...catalog.placeWriteFields('Oberösterreich, AT'),place_original:'Oberösterreich'});
 const patch=listingPlaceEditFields(region.row(),'Berlin, DE','geonames:2950159');
 assert.deepEqual(patch,{city:'Berlin, DE',selected_place_city_id:'geonames:2950159'});
 assert.equal((await region.patch(patch)).status,200);
 assert.equal(region.row().place_city_id,'geonames:2950159');
 const selected=fixture({city:'Ashford',...catalog.placeFieldsForId('geonames:2656954','Ashford, England, GB')});
 assert.equal((await selected.patch(listingPlaceEditFields(selected.row(),placeInputValue(selected.row(),selected.row().city),'geonames:2656955'))).status,200);
 assert.equal(selected.row().place_city_id,'geonames:2656955');
 assert.equal((await selected.patch(listingPlaceEditFields(selected.row(),'  '))).status,200);
 assert.equal(selected.row().city,'');
 assert.equal(selected.row().place_status,'empty');
});

test('deliberate changes to a pending region replace its old mapping through the regular resolver',async()=>{
 const region={city:'Oberösterreich',...catalog.placeWriteFields('Oberösterreich, AT'),place_original:'Oberösterreich'};
 const selected=fixture(region);
 assert.equal((await selected.patch({city:'Berlin, DE',selected_place_city_id:'geonames:2950159'})).status,200);
 assert.equal(selected.row().place_country_code,'DE');
 assert.equal(selected.row().place_region_id,'DE:geonames:2950157');
 assert.equal(selected.row().place_city_id,'geonames:2950159');
 assert.equal(selected.row().place_status,'verified');
 const manual=fixture(region);
 assert.equal((await manual.patch({city:'Own different village'})).status,200);
 assert.equal(manual.row().city,'Own different village');
 assert.equal(manual.row().place_country_code,null);
 assert.equal(manual.row().place_region_id,null);
 assert.equal(manual.row().place_city_id,null);
 assert.equal(manual.row().place_status,'pending');
});

test('explicitly clearing a verified or pending place removes its previous canonical fields',async()=>{
 const region={city:'Oberösterreich',...catalog.placeWriteFields('Oberösterreich, AT'),place_original:'Oberösterreich'};
 for(const f of [fixture(),fixture(region),fixture({...region,city:''})]) {
  assert.equal((await f.patch({city:'  '})).status,200);
  assert.equal(f.row().city,'');
  assert.equal(f.row().place_country_code,null);
  assert.equal(f.row().place_region_id,null);
  assert.equal(f.row().place_city_id,null);
  assert.equal(f.row().place_status,'empty');
 }
});

test('listing edits preserve a selected ambiguous place and allow a deliberate different selection',async()=>{
 const f=fixture({city:'Ashford',...catalog.placeFieldsForId('geonames:2656954','Ashford, England, GB')});
 const path=placeInputValue(f.row(),f.row().city);
 assert.equal((await f.patch({city:path,selected_place_city_id:'geonames:2656954'})).status,200);
 assert.equal(f.row().place_city_id,'geonames:2656954');
 assert.equal(f.row().place_status,'verified');
 assert.equal((await f.patch({city:path,selected_place_city_id:'geonames:2656955'})).status,200);
 assert.equal(f.row().place_city_id,'geonames:2656955');
 assert.equal(f.row().place_status,'verified');
});

test('listing place preservation never trusts a mismatched selected ID or unchanged client canonical fields',async()=>{
 const f=fixture({city:'Ashford, England, GB',...catalog.placeFieldsForId('geonames:2656954','Ashford, England, GB')});
 assert.equal((await f.patch({city:'Ashford, England, GB',selected_place_city_id:'geonames:2886242',place_country_code:'DE',place_city_id:'geonames:2886242'})).status,200);
 assert.equal(f.row().place_city_id,null);
 assert.equal(f.row().place_country_code,'GB');
 assert.equal(f.row().place_status,'pending');
});

test('changed listing cities clear stale verified identities and pending legacy cities never gain an inferred country',async()=>{
 const f=fixture();
 assert.equal((await f.patch({city:'Own unknown village',place_city_id:'geonames:2886242'})).status,200);
 assert.equal(f.row().city,'Own unknown village');
 assert.equal(f.row().place_city_id,null);
 assert.equal(f.row().place_country_code,null);
 assert.equal(f.row().place_status,'pending');
 const pending=fixture({city:'Berlin',...catalog.placeWriteFields('Berlin')});
 assert.equal((await pending.patch({city:'Berlin',description:'Own pending edit'})).status,200);
 assert.equal(pending.row().place_country_code,null);
 assert.equal(pending.row().place_status,'pending');
});
