import * as marketplaceOffer from "./marketplace-offer.ts";
import * as marketplaceCatalog from "./marketplaceCategories.ts";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {NextRequest,NextResponse} from 'next/server.js';
import ts from 'typescript';
import * as moderation from './offer-moderation.ts';
import {validateListingPublication} from './listing-publication.ts';
const require=createRequire(import.meta.url);
function load(file,mocks){const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const mod={exports:{}};new Function('require','module','exports',source)(name=>mocks[name]??(name==="@/lib/marketplace-offer"?marketplaceOffer:name==="@/lib/marketplaceCategories"?marketplaceCatalog:require(name)),mod,mod.exports);return mod.exports;}
const json=(url,method='POST',body)=>new NextRequest('http://localhost'+url,{method,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
const id='10000000-0000-4000-8000-000000000001';
test('only explicit stable statuses classify new offers; old public entries are never invented approvals',()=>{
 assert.equal(moderation.offerStatus({published:true}),'legacy_review_required');assert.equal(moderation.offerStatus({published:false}),'draft');
 for(const value of ['approved','pending','draft'])assert.equal(moderation.offerStatus({moderation_status:value}),value);
 for(const body of [{published:true},{moderation_status:'approved'},{reviewed_by:'self'},{reviewed_revision:1}])assert.equal(moderation.attemptedApproval(body),true);
 assert.equal(moderation.attemptedApproval({draft:false,title:'Own title',published:false}),false);
});
function submitFixture(){
 let actor='own-member';const calls=[];const record={id,user_id:'own-member',type:'job',title:'Own controlled job',city:'Test city',description:'Rolle: Test\nDrehtage: Test',responsible_person:{userId:'own-member',firstName:'Own',lastName:'Example'},published:false,moderation_status:'draft',content_revision:1};
 const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:record,error:null})};
 const route=load('../app/api/listings/[id]/publish/route.ts',{
  'next-intl/server':{getLocale:async()=>"de",getTranslations:async()=>key=>key},'next/cache':{revalidatePath(){},revalidateTag(){}},'@/lib/auth':{requireAuth:async()=>actor?{userId:actor}:NextResponse.json({}, {status:401})},
  '@/lib/db':{db:{from(){calls.push('read');return q},rpc:async(name,args)=>{calls.push({name,args});return{data:'saved',error:null}}}},
  '@/lib/listing-access':{canEditListing:async(user,row)=>user===row.user_id},'@/lib/listing-provider':{getListingProvider:async()=>({kind:'person',contactUserId:'own-member'})},'@/lib/listing-routes':{listingDetailPath:()=>'/jobs/'+id},
  '@/lib/responsible-person-server':{validateResponsiblePerson:async()=>({person:record.responsible_person})},'@/lib/listing-publication':{validateListingPublication},
  '@/lib/protected-media-server':{storeProtectedMedia(){throw Error('no upload in this case')},removeUnusedProtectedMedia(){}},'@/lib/uploadGuard':{buildStoragePath(){},validateUpload(){}},'@/lib/rateLimit':{rateLimit:async()=>({allowed:true})},
 });return{route,calls,record,setActor:value=>actor=value};
}
test('the former owner publish endpoint only submits, regardless of forged request data',async()=>{
 const f=submitFixture();const res=await f.route.POST(json('/api/listings/'+id+'/publish','POST',{published:true,action:'approve',p_actor:'admin'}),{params:Promise.resolve({id})});assert.equal(res.status,200);const result=await res.json();assert.equal(result.published,false);assert.equal(result.moderation_status,'pending');
 const write=f.calls.find(c=>typeof c==='object');assert.equal(write.name,'offer_review_transition');assert.equal(write.args.p_action,'submit');assert.equal(write.args.p_actor,'own-member');assert.deepEqual(write.args.p_expected,f.record);
});
test('foreign accounts and guests cannot submit someone else’s offer; retries do not duplicate pending submissions',async()=>{
 const f=submitFixture();f.setActor(null);assert.equal((await f.route.POST(json('/submit'),{params:Promise.resolve({id})})).status,401);assert.equal(f.calls.length,0);
 f.setActor('foreign-member');assert.equal((await f.route.POST(json('/submit'),{params:Promise.resolve({id})})).status,404);assert.equal(f.calls.filter(c=>typeof c==='object').length,0);
 f.setActor('own-member');f.record.moderation_status='pending';const response=await f.route.POST(json('/submit'),{params:Promise.resolve({id})});assert.equal(response.status,200);assert.equal((await response.json()).published,false);assert.equal(f.calls.filter(c=>typeof c==='object').length,0);
});
test('actual admin transition route refuses ordinary members before any release or content read',async()=>{
 let releases=0;const route=load('../app/api/admin/reviews/[kind]/[id]/route.ts',{'next-intl/server':{getLocale:async()=>"de",getTranslations:async()=>key=>key},'@/lib/auth':{requireAdmin:async()=>NextResponse.json({error:'Forbidden'},{status:403})},'@/lib/admin-review-server':{},'@/lib/admin-review-release':{releaseReviewedListing:()=>{releases++;throw Error('must not execute')}},'@/lib/admin-company-publication':{publishReviewedCompany:()=>{throw Error('must not execute')}}});
 const response=await route.POST(json('/admin','POST',{action:'approve',revision:'a'.repeat(64)}),{params:Promise.resolve({kind:'listing',id})});assert.equal(response.status,403);assert.equal(releases,0);
});
test('a former technical creator loses company-offer edit access without a current accepted permission',async()=>{
 let membership=null;const query={select(){return query},eq(){return query},maybeSingle:async()=>({data:membership,error:null})};
 const access=load('./listing-access.ts',{'server-only':{},'@/lib/db':{db:{from:table=>table==='companies'?{select(){return this},eq(){return this},maybeSingle:async()=>({data:{owner_user_id:'company-owner'},error:null})}:query}},'@/lib/company-roles':{canCompanyRole:(role,capability)=>role==='editor'&&capability==='edit_offers'}});
 const offer={user_id:'former-creator',company_id:'own-company'};
 assert.equal(await access.canEditListing('former-creator',offer),false);
 assert.equal(await access.canEditListing('company-owner',offer),true);
 membership={role:'member'};assert.equal(await access.canEditListing('former-creator',offer),false);
 membership={role:'editor'};assert.equal(await access.canEditListing('accepted-editor',offer),true);
 assert.equal(await access.canEditListing('own-member',{user_id:'own-member',company_id:null}),true);
});
test('the owner list omits company offers when only an obsolete technical creator ID matches',async()=>{
 const rows=[{id:'personal',user_id:'own-member',company_id:null,responsible_person:{userId:'own-member'},created_at:'2026-10-28'}, {id:'former-company-offer',user_id:'own-member',company_id:'former-company',responsible_person:{userId:'someone-else'},created_at:'2026-10-28'}];
 const query={select(){return query},eq(){return query},order(){return query},limit(){return query},then(resolve){return Promise.resolve({data:rows,error:null}).then(resolve)}};
 const route=load('../app/api/listings/route.ts',{'next/cache':{revalidatePath(){},revalidateTag(){}},'@/lib/db':{db:{from:()=>query}},'@/lib/auth':{requireAuth:async()=>({userId:'own-member'})},'@/lib/listing-access':{editableCompanyIdsForUser:async()=>[]},'@/lib/offer-moderation':moderation,'next-intl/server':{},'@/lib/responsible-person':{},'@/lib/responsible-person-server':{},'@/lib/listing-price':{},'@/lib/rateLimit':{},'@/lib/listing-image-gallery':{}});
 const response=await route.GET(json('/api/listings?mine=true','GET'));assert.equal(response.status,200);assert.deepEqual((await response.json()).data.map(row=>row.id),['personal']);assert.match(response.headers.get('Cache-Control'),/no-store/);
});

test('the actual submission endpoint accepts a complete location or animal portfolio without photos and keeps it private for review',async()=>{
 for(const type of ['location','animal']) {
  const f=submitFixture();Object.assign(f.record,{type,category:type==='location'?'studio':'dog',image_url:null,extra_images:[]});
  const response=await f.route.POST(json('/submit'),{params:Promise.resolve({id})});
  assert.equal(response.status,200);const data=await response.json();assert.equal(data.submitted,true);assert.equal(data.published,false);
  const transition=f.calls.find(call=>typeof call==='object');assert.equal(transition.args.p_action,'submit');assert.equal(transition.args.p_expected.image_url,null);
 }
});
