import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {NextResponse} from 'next/server.js';
import {PGlite} from '@electric-sql/pglite';
import * as responsible from './responsible-person.ts';
import {hasProfileBasics} from './profile-setup-flow.ts';
import {isMarketplaceOffer} from './marketplace-publication.ts';
const require=createRequire(import.meta.url);
function load(file,mocks){const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};new Function('require','module','exports',code)(n=>Object.hasOwn(mocks,n)?mocks[n]:require(n),m,m.exports);return m.exports;}
const migration=name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
test('marketplace scope excludes Locations, people, companies, jobs and animal portfolios',()=>{
 for(const type of ['prop','vehicle'])assert.equal(isMarketplaceOffer(type),true);
 for(const type of ['location','animal','creator','job','company',null])assert.equal(isMarketplaceOffer(type),false);
});
test('an established profile supplies the real account name; arbitrary browser names never replace it or confer rights',async()=>{
 let profile={display_name:'Own Test Person',location:'Test city',profile_type:'crew'},fail=false;
 const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:profile,error:fail?{}:null})};
 const server=load('./responsible-person-server.ts',{'server-only':{},'next/server':{NextResponse},'@/lib/db':{db:{from:()=>q}},'@/lib/profile-setup-flow':{hasProfileBasics},'@/lib/responsible-person':responsible,
  '@clerk/nextjs/server':{clerkClient:async()=>({users:{getUser:async()=>({firstName:'',lastName:''})}})},'@/lib/linked-profile-access':{visibleLinkedProfileIds:async()=>new Set()},'next-intl/server':{getTranslations:async()=>key=>key}});
 const input={...responsible.EMPTY_RESPONSIBLE_PERSON,profileName:'Forged name',public:false};
 let result=await server.validateMarketplaceResponsiblePerson(input,'own-account');assert.equal(result.person.profileName,'Own Test Person');assert.equal(result.person.userId,'own-account');assert.equal(result.person.public,false);
 assert.deepEqual(responsible.marketplaceResponsibleErrors(result.person),{});
 assert.equal((await server.accountResponsiblePerson('own-account')).profileName,'Own Test Person');
 assert.equal((await server.validateMarketplaceResponsiblePerson({...input,userId:'foreign'},'own-account')).response.status,403);
 assert.equal((await server.validateResponsiblePerson(input,'own-account')).response.status,400,'generic company/location validation cannot trust the browser marker');
 assert.equal(responsible.bindResponsiblePerson(input,'own-account').profileName,undefined);
 profile=null;assert.equal((await server.validateMarketplaceResponsiblePerson(input,'own-account')).response.status,400);
 profile={display_name:'address@example.invalid',location:'Test',profile_type:'crew'};assert.equal((await server.validateMarketplaceResponsiblePerson(input,'own-account')).response.status,400);
 fail=true;assert.equal((await server.validateMarketplaceResponsiblePerson(input,'own-account')).response.status,503);
});
test('actual SQL publishes only explicit complete owner marketplace actions, preserves drafts, review gates and admin restrictions',async()=>{
 const pg=new PGlite();try{
 await pg.exec(`create role anon;create role authenticated;create role service_role;
 create table profiles(user_id text primary key,display_name text,location text,profile_type text,positions text[]);
 create table companies(id uuid primary key,owner_user_id text,name text,published boolean,slug text);
 create table company_members(company_id uuid,user_id text,role text,status text);
 create table listings(id uuid primary key default gen_random_uuid(),user_id text,company_id uuid,type text,category text,title text,description text,price numeric,city text,image_url text,extra_images jsonb,metadata jsonb,published boolean default true);
 create table company_equipment(id uuid primary key default gen_random_uuid(),company_id uuid,name text,published boolean default true);
 create table admin_audit_log(actor_user_id text,action text,entity_type text,entity_id text,reason text,outcome text,metadata jsonb);
 create table notifications(user_id text,type text,title text,body text,href text);
 insert into profiles values('own-member','Own Member','Test City','crew','{}'),('other','Other Member','Test City','crew','{}'),('placeholder',null,null,null,'{}');`);
 await pg.exec(migration('20261028200000_offer_moderation.sql'));
 await pg.exec(migration('20261028210000_marketplace_profile_publication.sql'));
 const row=async id=>(await pg.query('select to_jsonb(l) r from listings l where id=$1',[id])).rows[0].r;
 const create=async(type='prop',owner='own-member')=>(await pg.query("insert into listings(type,user_id,title,description,city,category,image_url,last_editor_id) values($1,$2,'Own test offer','Test description','Test city','Test category','/api/media/own-member/test.webp',$2) returning id",[type,owner])).rows[0].id;
 const publish=async(id,actor='own-member',expected)=> (await pg.query('select marketplace_publish_transition($1,$2,$3) result',[id,expected??await row(id),actor])).rows[0].result;
 const review=async(id,action)=>{const r=await row(id),p=(await pg.query('select to_jsonb(p) p from profiles p where user_id=$1',[r.user_id])).rows[0].p;return(await pg.query("select offer_review_transition('listing',$1,$2,null,$3,$4,'own-admin','Own test admin decision',null) result",[id,r,p,action])).rows[0].result;};
 for(const type of ['prop','vehicle']){
  const id=await create(type);assert.equal((await row(id)).published,false);assert.equal(await publish(id),'saved');let r=await row(id);assert.equal(r.published,true);assert.equal(r.moderation_status,'owner_published');assert.equal(r.reviewed_by,null);assert.equal(r.reviewed_revision,null);
  assert.equal(await publish(id),'unchanged');assert.equal(await publish(id,'other'),'forbidden');
  const old=r;await pg.query("update listings set title='Changed own test offer',last_editor_id='own-member' where id=$1",[id]);assert.equal((await row(id)).published,false);assert.equal(await publish(id,'own-member',old),'stale');assert.equal(await publish(id),'saved');
  await pg.query('update listings set published=false where id=$1',[id]);assert.equal(await publish(id),'saved','owner withdrawal can be reversed');
  assert.equal(await review(id,'hide'),'saved');assert.equal(await publish(id),'restricted');
  await pg.query("update listings set description='Own revised description' where id=$1",[id]);assert.equal(await publish(id),'restricted','editing cannot erase an explicit admin restriction');
  assert.equal(await review(id,'submit'),'saved');assert.equal(await publish(id),'restricted','resubmission cannot erase an admin restriction');assert.equal(await review(id,'approve'),'saved');assert.equal(await publish(id),'saved');
 }
 for(const type of ['location','animal','job']){const id=await create(type);assert.equal(await publish(id),'not_marketplace');assert.equal((await row(id)).published,false);}
 const missing=await create('prop','placeholder');assert.equal(await publish(missing,'placeholder'),'profile_required');
 const incomplete=await create();await pg.query('update listings set image_url=null where id=$1',[incomplete]);assert.equal(await publish(incomplete),'incomplete');
 const company='20000000-0000-4000-8000-000000000001';await pg.query("insert into companies values($1,'other','Own company',true,'own-test-company')",[company]);const delegated=await create();await pg.query('update listings set company_id=$1 where id=$2',[company,delegated]);assert.equal(await publish(delegated),'forbidden','technical creator has no company rights');
 await pg.query("insert into company_members values($1,'own-member','editor','pending')",[company]);assert.equal(await publish(delegated),'forbidden');await pg.query("update company_members set status='accepted'");assert.equal(await publish(delegated),'saved');await pg.query('delete from company_members');assert.equal(await publish(delegated),'forbidden');
 for(const role of ['anon','authenticated']){assert.equal((await pg.query("select has_function_privilege($1,'marketplace_publish_transition(uuid,jsonb,text)','execute') ok",[role])).rows[0].ok,false);assert.equal((await pg.query("select has_table_privilege($1,'listings','update') ok",[role])).rows[0].ok,false);}
 assert.ok((await pg.query("select count(*)::int n from offer_moderation_events where event='owner_publish'")).rows[0].n>=2);
 }finally{await pg.close();}
});

test('actual create and publish handlers distinguish public success from a recoverable publication failure',async()=>{
 let row=null,outcome='published',actor='own-account';
 const query={select(){return query},eq(){return query},insert(value){row={id:'own-offer',...value};return query},single:async()=>({data:row,error:null}),maybeSingle:async()=>({data:row,error:null})};
 const dependencies={
 'next-intl/server':{getTranslations:async()=>key=>key},'next/cache':{revalidatePath(){},revalidateTag(){}},'@/lib/db':{db:{from:()=>query}},
 '@/lib/auth':{requireAuth:async()=>actor?{userId:actor}:NextResponse.json({}, {status:401})},'@/lib/rateLimit':{rateLimit:async()=>({allowed:true})},
 '@/lib/offer-moderation':{attemptedApproval:body=>body.published===true||body.moderation_status!==undefined,OFFER_MODERATION_COLUMNS:''},
 '@/lib/responsible-person':responsible,'@/lib/responsible-person-server':{validateResponsiblePerson:async()=>({person:{userId:actor}}),validateMarketplaceResponsiblePerson:async()=>({person:{userId:actor,profileName:'Own Test Person'}})},
 '@/lib/listing-price':{listingPriceMetadataError:()=>null},'@/lib/listing-image-gallery':{maxImagesForListingType:()=>10,normalizeListingImageGallery:(main,extra)=>({ok:true,gallery:{imageUrl:main,extraImages:extra??[]}})},
 '@/lib/listing-access':{editableCompanyIdsForUser:async()=>[],canEditListing:async id=>id===row.user_id},
 '@/lib/marketplace-publication-server':{publishMarketplaceOffer:async value=>outcome==='published'?{outcome,row:{...value,published:true,moderation_status:'owner_published'}}:{outcome,row:value,error:'saveError'}},
 '@/lib/protected-media-server':{},'@/lib/uploadGuard':{},'@/lib/listing-provider':{},'@/lib/listing-routes':{},'@/lib/listing-publication':{},
 };
 const create=load('../app/api/listings/route.ts',dependencies),publish=load('../app/api/listings/[id]/publish/route.ts',dependencies);
 const send=body=>create.POST(new Request('https://own-test.invalid/api/listings',{method:'POST',body:JSON.stringify({type:'prop',title:'Own controlled test',city:'Test city',category:'Kostüme',image_url:'/api/media/own-account/own.webp',...body})}));
 const created=await(await send({})).json();assert.equal(created.data.published,true);assert.equal(created.data.moderation_status,'owner_published');assert.equal(created.submitted,false);assert.equal(row.published,false,'initial insert remains private before the guarded transition');
 const draft=await(await send({draft:true})).json();assert.equal(draft.data.published,false);assert.equal(draft.data.moderation_status,'draft');
 outcome='error';const failure=await(await send({})).json();assert.equal(failure.data.id,'own-offer');assert.equal(failure.data.published,false);assert.equal(failure.publicationError,'saveError','the saved draft can be resumed instead of creating a duplicate');
 assert.equal((await send({published:true})).status,403);assert.equal((await send({moderation_status:'owner_published'})).status,403);
 outcome='published';const result=await publish.POST(new Request('https://own-test.invalid/publish',{method:'POST'}),{params:Promise.resolve({id:'own-offer'})});assert.equal(result.status,200);assert.equal((await result.json()).published,true);
 actor='foreign';assert.equal((await publish.POST(new Request('https://own-test.invalid/publish',{method:'POST'}),{params:Promise.resolve({id:'own-offer'})})).status,404);
 actor=null;assert.equal((await send({})).status,401);
});
