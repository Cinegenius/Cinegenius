import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {NextRequest,NextResponse} from 'next/server.js';
import * as price from './listing-price.ts';
import * as moderation from './offer-moderation.ts';
const require=createRequire(import.meta.url);
function fixture(concurrent=false){
 let current={id:'synthetic-id',user_id:'owner',company_id:null,type:'location',category:'Studio',city:'Berlin',responsible_person:{userId:'owner'},metadata:{sqm:20},published:false,content_revision:12};
 const operations=[];
 const db={from(table){assert.equal(table,'listings');let patch=null,filters=[];const query={select(){return this;},eq(key,value){filters.push([key,value]);return this;},maybeSingle:async()=>({data:structuredClone(current),error:null}),update(value){patch=value;operations.push({patch,filters});if(concurrent)current={...current,content_revision:13,metadata:{...current.metadata,location_area:{lat:52,lng:13,radius_meters:500},location_area_revision:1}};return this;},single:async()=>{
  if(filters.some(([key,value])=>current[key]!==value))return {data:null,error:{code:'PGRST116'}};
  current={...current,...patch,content_revision:current.content_revision+1};return {data:current,error:null};
 }};return query;}};
 const mocks={'next/server':{NextResponse,NextRequest},'next/cache':{revalidatePath(){},revalidateTag(){}},'next-intl/server':{getTranslations:async()=>key=>key},'@/lib/auth':{requireAuth:async()=>({userId:'owner'})},'@/lib/db':{db},'@/lib/places/catalog':{},'@/lib/marketplace-offer':{},'@/lib/offer-moderation':moderation,'@/lib/responsible-person':{},'@/lib/responsible-person-server':{validateResponsiblePerson:async()=>({person:{userId:'owner'}})},'@/lib/listing-price':price,'@/lib/listing-image-gallery':{},'@/lib/listing-access':{canEditListing:async()=>true}};
 const code=ts.transpileModule(readFileSync(new URL('../app/api/listings/[id]/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const mod={exports:{}};
 new Function('require','module','exports',code)(name=>mocks[name]??require(name),mod,mod.exports);
 return {call:()=>mod.exports.PATCH(new NextRequest('https://fixture.invalid/api/listings/synthetic-id',{method:'PATCH',body:JSON.stringify({metadata:{sqm:30}})}),{params:Promise.resolve({id:'synthetic-id'})}),get row(){return current;},operations};
}
test('a normal location edit saves against the revision that was actually read',async()=>{
 const h=fixture();const response=await h.call();assert.equal(response.status,200);assert.equal(h.row.metadata.sqm,30);assert.ok(h.operations[0].filters.some(([key,value])=>key==='content_revision'&&value===12));
});
test('a concurrent private-position save cannot be overwritten by an older ordinary location edit',async()=>{
 const h=fixture(true);const response=await h.call();assert.equal(response.status,409);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal((await response.json()).error,'locationPrivacy.conflict');
 assert.equal(h.row.metadata.sqm,20);assert.deepEqual(h.row.metadata.location_area,{lat:52,lng:13,radius_meters:500});assert.equal(h.row.metadata.location_area_revision,1);assert.equal(h.row.content_revision,13);
});
