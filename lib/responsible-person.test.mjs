import * as marketplaceOffer from "./marketplace-offer.ts";
import * as marketplaceCatalog from "./marketplaceCategories.ts";
import * as offerModeration from './offer-moderation.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {NextRequest,NextResponse} from 'next/server.js';
import * as model from './responsible-person.ts';
import * as animalTaxonomy from './animal-taxonomy.ts';
import * as galleryModel from './listing-image-gallery.ts';
import {hasProfileBasics} from './profile-setup-flow.ts';
const require=createRequire(import.meta.url);
const person={firstName:'Renée',lastName:'van den Berg',function:'rental',customFunction:'',public:false};
function load(file,mocks){
 const source=readFileSync(new URL(file,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',code)(name=>Object.hasOwn(mocks,name)?mocks[name]:name==="@/lib/marketplace-offer"?marketplaceOffer:name==="@/lib/marketplaceCategories"?marketplaceCatalog:require(name),mod,mod.exports);return mod.exports;
}
function server({visible=true,profile=true}={}){
 return load('./responsible-person-server.ts',{'server-only':{},'next/server':{NextResponse},'next-intl/server':{getLocale:async()=>"de",getTranslations:async()=>key=>key},'@/lib/responsible-person':model,'@/lib/profile-setup-flow':{hasProfileBasics},
 '@clerk/nextjs/server':{clerkClient:async()=>({users:{getUser:async()=>({firstName:'Own',lastName:'Example'})}})},
 '@/lib/linked-profile-access':{visibleLinkedProfileIds:async ids=>new Set(visible?ids:[])},
 '@/lib/db':{db:{from(){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:profile?{slug:'own-person',user_id:'own-account'}:null})};return q}}}});
}
test('international first/family names are distinct from titles and functions; no guessed or forged account binding',async()=>{
 assert.deepEqual(model.responsiblePersonErrors(person),{});
 for(const invalid of ['test@example.invalid','user_123','123']) assert.ok(model.responsiblePersonErrors({...person,firstName:invalid}).firstName);
 assert.ok(model.responsiblePersonErrors({...person,lastName:''}).lastName);
 assert.ok(model.responsiblePersonErrors({...person,function:'director'}).function);
 assert.deepEqual(model.responsiblePersonErrors({...person,function:'director'},true),{});
 assert.ok(model.responsiblePersonErrors({...person,function:'other'}).customFunction);
 assert.equal(model.bindResponsiblePerson({...person,userId:'foreign'},'own-account').userId,'own-account');
 const result=await server().validateResponsiblePerson({...person,userId:'foreign'},'own-account');
 assert.equal(result.response.status,403);
});
test('server permits incomplete private drafts but blocks publication and validates account-prefilled structured names',async()=>{
 const s=server();
 assert.equal((await s.validateResponsiblePerson({firstName:'invalid@email'},'own-account',false,true)).response.status,400);
 assert.ok((await s.validateResponsiblePerson({},'own-account',false,false)).person);
 assert.equal((await s.validateResponsiblePerson(undefined,'own-account')).person.firstName,'Own');
});
test('public projection strips account id and all internal data; link exists only for visible actual profiles',async()=>{
 const stored=model.bindResponsiblePerson({...person,public:true,email:'secret@example.invalid'},'own-account');
 assert.equal(await server().publicResponsiblePerson({...stored,public:false},null),null);
 const projection=await server().publicResponsiblePerson(stored,null);
 assert.deepEqual(projection,{name:'Renée van den Berg',function:'rental',customFunction:'',href:'/profile/own-person'});
 assert.equal((await server({profile:false}).publicResponsiblePerson(stored,null)).href,null);
 assert.equal((await server({visible:false}).publicResponsiblePerson(stored,null)).href,null);
 assert.doesNotMatch(JSON.stringify(projection),/userId|email|phone|own-account/);
});
test('migration keeps existing rows and public columns but denies direct reads/writes of internal responsibility',async()=>{
 const pg=new PGlite();
 try{
 await pg.exec(`create role anon; create role authenticated; create table companies(id text, name text); create table listings(id text, title text); insert into companies values ('old','Existing'); grant select,insert,update on companies,listings to anon,authenticated;`);
 await pg.exec(readFileSync(new URL('../supabase/migrations/20261028120000_responsible_person.sql',import.meta.url),'utf8'));
 await pg.query('update companies set responsible_person=$1 where id=$2',[{...person,userId:'own-account'},'old']);
 await pg.exec('set role anon');
 assert.equal((await pg.query('select name from companies')).rows[0].name,'Existing');
 await assert.rejects(pg.query('select responsible_person from companies'),/permission denied/);
 await assert.rejects(pg.query(`update companies set responsible_person='{}'`),/permission denied/);
 await pg.query(`update companies set name='Existing changed'`);
 await pg.exec('reset role');
 assert.equal((await pg.query('select responsible_person from companies')).rows[0].responsible_person.firstName,'Renée');
 // Migration can safely be retried without deleting rows or overwriting snapshots.
 await pg.exec(readFileSync(new URL('../supabase/migrations/20261028120000_responsible_person.sql',import.meta.url),'utf8'));
 assert.equal((await pg.query('select count(*)::int as n from companies')).rows[0].n,1);
 }finally{await pg.close()}
});

test('actual listing create route binds current account, preserves drafts, rejects missing names and ignores selected leadership rights',async()=>{
 let actor='own-account', saved;
 const q={select(){return q},eq(){return q},contains(){return q},maybeSingle:async()=>({data:null,error:null}),single:async()=>({data:{id:'own-offer',...saved},error:null}),insert(value){saved=value;return q}};
 const route=load('../app/api/listings/route.ts',{'@/lib/animal-taxonomy':animalTaxonomy,'@/lib/offer-moderation':offerModeration,'next-intl/server':{getLocale:async()=>"de",getTranslations:async()=>key=>key},'@/lib/responsible-person':model,'@/lib/profile-setup-flow':{hasProfileBasics},'@/lib/responsible-person-server':server(),
 '@/lib/db':{db:{from:()=>q}},'@/lib/auth':{requireAuth:async()=>actor?{userId:actor}:NextResponse.json({}, {status:401})},
 '@/lib/rateLimit':{rateLimit:async()=>({allowed:true})},'next/cache':{revalidatePath(){},revalidateTag(){}},'next/server':{NextRequest,NextResponse},
 '@/lib/listing-price':{listingPriceMetadataError:()=>null},'@/lib/listing-image-gallery':galleryModel,'@/lib/listing-access':{editableCompanyIdsForUser:async()=>[]}});
 const send=body=>route.POST(new Request('http://localhost/api/listings',{method:'POST',body:JSON.stringify({type:'location',title:'Own test room',city:'Own city',...body})}));
 assert.equal((await send({responsible_person:{firstName:'invalid@email'}})).status,400);
 assert.equal((await send({draft:true,responsible_person:{}})).status,200);assert.equal(saved.published,false);
 assert.equal((await send({responsible_person:person})).status,200);assert.equal(saved.responsible_person.userId,'own-account');
 assert.equal(saved.user_id,'own-account');assert.equal(saved.company_id,null);assert.equal(saved.responsible_person.function,'rental');assert.equal(saved.published,false);assert.equal(saved.moderation_status,'pending');
 assert.equal((await send({published:true,responsible_person:person})).status,403);assert.equal((await send({moderation_status:'approved',responsible_person:person})).status,403);
 assert.equal((await send({responsible_person:{...person,userId:'someone-else'}})).status,403);
 const images=Array.from({length:10},(_,i)=>`https://own-tests.invalid/animal-${i}.jpg`);
 const animal={type:'animal',category:'Hunde',responsible_person:person,image_url:images[0],extra_images:images.slice(1),metadata:{special_skills:'Own fictional skills',rental_type:'miete'}};
 assert.equal((await send(animal)).status,200);assert.equal(saved.published,false);assert.equal(saved.moderation_status,'pending');assert.equal(saved.metadata.offer_kind,'animal_portfolio');assert.equal(saved.metadata.rental_type,undefined);assert.deepEqual(saved.extra_images,images.slice(1));
 assert.equal((await send({...animal,draft:true})).status,200);assert.equal(saved.moderation_status,'draft');
 assert.equal((await send({...animal,extra_images:[...images.slice(1),'https://own-tests.invalid/extra.jpg']})).status,400);
 assert.equal((await send({...animal,rental_type:'kauf'})).status,400);
 assert.equal((await send({...animal,category:'Equipment'})).status,400);
 actor=null;assert.equal((await send({responsible_person:person})).status,401);
});

test('actual company create/edit preserves responsibility across authorized editors and refuses takeover or changed titles by others',async()=>{
 let actor='own-account',row=null;const memberWrites=[];
 const db={from(table){const q={select(){return q},eq(){return q},ilike(){return q},insert(value){row={id:'own-company',...value};return q},update(value){if(table==='companies')row={...row,...value};return q},upsert(value){memberWrites.push(value);return q},single:async()=>({data:row,error:null}),maybeSingle:async()=>({data:row,error:null}),then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}};return q}};
 const s=server();
 const route=load('../app/api/companies/route.ts',{'@/lib/animal-taxonomy':animalTaxonomy,'@/lib/db':{db},'@/lib/responsible-person':model,'@/lib/profile-setup-flow':{hasProfileBasics},'@/lib/responsible-person-server':s,
 'next/server':{NextRequest,NextResponse},'next-intl/server':{getLocale:async()=>"de",getTranslations:async()=>key=>key},'next/cache':{revalidateTag(){},revalidatePath(){}},
 '@/lib/auth':{requireAuth:async()=>({userId:actor})},'@/lib/company-access':{getCompanyAccess:async()=>actor==='foreign'?null:{role:actor==='own-account'?'owner':'editor'}},
 '@/lib/company-roles':{canCompanyRole:role=>['owner','editor'].includes(role),normalizeCompanyPublicTitles:()=>[]},
 '@/lib/company-media':{isCompanyImageUrlOwnedByUser:()=>true,canPersistCompanyImages:()=>true},
 '@/lib/catering-taxonomy':{normalizeCateringCompanyDetails:()=>({}),CATERING_COMPANY_CATEGORY:{id:'catering'},isCateringSearchQuery:()=>false}});
 const contact={...person,function:'employee'};
 const send=body=>route.POST(new NextRequest('http://localhost/api/companies',{method:'POST',body:JSON.stringify({name:'Own test company',city:'Own city',...body})}));
 assert.equal((await send({responsible_person:{firstName:'invalid@email'}})).status,400);assert.equal(row,null);
 assert.equal((await send({responsible_person:contact,owner_user_id:'foreign',categories:['filmhundagentur','tiervermittlung'],animal_details:{species:['dogs','horses'],serviceTypes:['dog-training','animal-handling'],otherSpecies:'Own fictional species'}})).status,200);
 assert.deepEqual(row.animal_details.species,['dogs','horses']);const animalSnapshot=structuredClone(row.animal_details);
 assert.equal(row.owner_user_id,'own-account');assert.equal(row.responsible_person.userId,'own-account');assert.equal(row.responsible_person.function,'employee');
 assert.equal(memberWrites[0].role,'owner'); // Only the normal creator ownership rule grants this, not the public function.
 actor='team-editor';const before=structuredClone(row.responsible_person),writes=memberWrites.length;
 // JSONB can return a different object-key order. This is still the same contact.
 row.responsible_person=Object.fromEntries(Object.entries(row.responsible_person).reverse());
 assert.equal((await send({id:'own-company',responsible_person:contact})).status,200);
 assert.deepEqual(row.responsible_person,before);assert.deepEqual(row.animal_details,animalSnapshot);assert.equal(memberWrites.length,writes);
 assert.equal((await send({id:'own-company',responsible_person:{...contact,function:'director'}})).status,403);
 assert.equal(row.responsible_person.function,'employee');
 actor='foreign';assert.equal((await send({id:'own-company',responsible_person:contact})).status,403);
 actor='own-account';row.responsible_person={...contact,userId:'confirmed-delegate',public:false};
 assert.equal((await send({id:'own-company',responsible_person:{...contact,userId:'confirmed-delegate',public:true}})).status,403);
 assert.equal(row.responsible_person.public,false);
});
