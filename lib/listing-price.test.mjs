import * as offerModeration from './offer-moderation.ts';
import * as responsibility from './responsible-person.ts';
import test from 'node:test';import assert from 'node:assert/strict';
import * as pricing from './listing-price.ts';
import {createRequire} from 'node:module';import {readFileSync} from 'node:fs';import ts from 'typescript';
import {listingPriceLabel,listingPriceMetadataError} from './listing-price.ts';
import * as gallery from './listing-image-gallery.ts';
const require=createRequire(import.meta.url);
test('VB with and without an amount stays distinct from request prices and fixed prices',()=>{
 assert.equal(listingPriceLabel(0,{price_negotiable:true}),'VB');assert.equal(listingPriceLabel(null,{price_negotiable:true}),'VB');
 assert.equal(listingPriceLabel(150,{price_negotiable:true}),'150 €/Tag VB');
 assert.equal(listingPriceLabel(1200,{price_negotiable:true,rental_type:'kauf'}),'1.200 € VB');
 assert.equal(listingPriceLabel(0),'Preis auf Anfrage');assert.equal(listingPriceLabel(100,{price_on_request:true}),'Preis auf Anfrage');assert.equal(listingPriceLabel(100),'100 €/Tag');
 assert.equal(listingPriceLabel(12.5,{price_negotiable:true}),'12,5 €/Tag VB');
});
test('invalid price modes and incompatible selections are rejected',()=>{
 for(const data of [{price_negotiable:'true'},{price_on_request:1},{price_on_request:true,price_negotiable:true}])assert.ok(listingPriceMetadataError(data));
 for(const data of [{price_negotiable:true},{price_negotiable:false,price_on_request:true},{}])assert.equal(listingPriceMetadataError(data),null);
});
function fixture(type){
 let userId='owner',row=null;const writes=[];
 const q={select:()=>q,eq:()=>q,order:()=>q,range:()=>q,limit:async()=>({data:row?[row]:[],error:null}),insert:value=>{row={id:'test-offer',...value};writes.push(value);return q;},update:value=>{row={...row,...value};writes.push(value);return q;},maybeSingle:async()=>({data:row,error:null}),single:async()=>({data:row,error:null})};
 const dependencies={'@/lib/offer-moderation':offerModeration,'@/lib/responsible-person':responsibility,'@/lib/responsible-person-server':{accountResponsiblePerson:async()=>({...responsibility.EMPTY_RESPONSIBLE_PERSON,firstName:'Own',lastName:'Example'}),validateMarketplaceResponsiblePerson:async(value,userId)=>({person:responsibility.bindResponsiblePerson(value??responsibility.EMPTY_RESPONSIBLE_PERSON,userId)}),validateResponsiblePerson:async(value,userId)=>({person:responsibility.bindResponsiblePerson(value??responsibility.EMPTY_RESPONSIBLE_PERSON,userId)})},'next-intl/server':{getTranslations:async()=>key=>key},'@/lib/listing-price':pricing,'@/lib/db':{db:{from:()=>q}},'@/lib/auth':{requireAuth:async()=>userId?{userId}:require('next/server').NextResponse.json({error:'unauthorized'},{status:401})},'@/lib/rateLimit':{rateLimit:async()=>({allowed:true})},'next/cache':{revalidatePath:()=>{},revalidateTag:()=>{}},'@/lib/listing-image-gallery':gallery,'@/lib/listing-access':{canEditListing:async(id,current)=>id===current.user_id,editableCompanyIdsForUser:async()=>[]}};
 const load=file=>{const mod={exports:{}};const output=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',output)(n=>dependencies[n]??require(n),mod,mod.exports);return mod.exports;};
 const create=load('../app/api/listings/route.ts'),edit=load('../app/api/listings/[id]/route.ts');
 const request=(method,body)=>new(require('next/server').NextRequest)('https://fixture.invalid/api/listings/test-offer',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 return {writes,row:()=>row,setUser:id=>userId=id,create:metadata=>create.POST(request('POST',{type,title:'Eigenes VB-Testangebot',city:'Teststadt',price:0,draft:true,metadata})),edit:(metadata,price=0)=>edit.PATCH(request('PATCH',{metadata,price}),{params:Promise.resolve({id:'test-offer'})}),read:()=>create.GET(new(require('next/server').NextRequest)('https://fixture.invalid/api/listings?mine=true'))};
}
for(const type of ['location','prop','vehicle'])test(`${type}: create, reload and edit VB safely without changing ownership or unrelated metadata`,async()=>{
 const f=fixture(type);assert.equal((await f.create({price_negotiable:true,description_hint:'preserve'})).status,200);
 assert.equal(f.row().published,false);assert.equal(f.row().user_id,'owner');assert.equal(listingPriceLabel(f.row().price,f.row().metadata),'VB');
 // Read the actual owner endpoint after persistence.
 const read=await f.read();assert.equal(read.status,200);assert.equal((await read.json()).data[0].metadata.price_negotiable,true);
 assert.equal((await f.edit({price_negotiable:true,price_on_request:false},150)).status,200);
 assert.equal(listingPriceLabel(f.row().price,f.row().metadata),'150 €/Tag VB');assert.equal(f.row().metadata.description_hint,'preserve');
 assert.equal((await f.edit({price_negotiable:false,price_on_request:true})).status,200);assert.equal(listingPriceLabel(f.row().price,f.row().metadata),'Preis auf Anfrage');
 const count=f.writes.length;f.setUser('foreign');assert.equal((await f.edit({price_negotiable:true})).status,404);assert.equal(f.writes.length,count);
 f.setUser(null);assert.equal((await f.edit({price_negotiable:true})).status,401);assert.equal((await f.create({price_negotiable:true})).status,401);
});
