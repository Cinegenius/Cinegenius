import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {intlServerFor,translatorFor,notificationCopy} from './i18n-test-fixture.mjs';
import * as routes from './listing-routes.ts';

const require=createRequire(import.meta.url),{NextRequest,NextResponse}=require('next/server');
const code=ts.transpileModule(readFileSync(new URL('../app/api/listing-ratings/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const publicListing={id:'public-offer',user_id:'private-provider-account',company_id:null,title:'Member “Camera als Company” <XML> & č',type:'prop',published:true};
const companyListing={...publicListing,id:'company-offer',user_id:'private-technical-editor',company_id:'company-one',type:'vehicle'};
const contact={id:'contact-one',sender_id:'own-reviewer',receiver_id:publicListing.user_id,listing_id:publicListing.id};
const booked={id:'booking-one',user_id:'own-reviewer',listing_id:publicListing.id,status:'confirmed'};

/** Execute the real route against isolated relational rows; no app/DB/provider I/O. */
function fixture({userId='own-reviewer',locale='de',listings=[publicListing],companies=[],contacts=[contact],bookings=[],quick=[],reviews=[],fail,notificationFails=false}={}){
 const data={listings:structuredClone(listings),companies:structuredClone(companies),conversations:structuredClone(contacts),bookings:structuredClone(bookings),listing_ratings:structuredClone(quick),reviews:structuredClone(reviews),profiles:[{user_id:'own-reviewer',display_name:'Member als Name “quoted” <XML> & Čeština'}],notifications:[]};
 const calls=[],mutations=[],summaryCalls=[],revalidations=[];
 const db={from(table){if(table==='privacy_visible_listings')table='listings';assert.ok(Object.hasOwn(data,table),`Unexpected table ${table}`);const filters=[];let operation='read',payload,columns='',single=false;
  const q={select(value){columns=value;return q;},eq(key,value){filters.push(row=>row[key]===value);return q;},in(key,values){filters.push(row=>values.includes(row[key]));return q;},limit(){return q;},maybeSingle(){single=true;return q;},
   upsert(value){operation='upsert';payload=value;return q;},insert(value){operation='insert';payload=value;return q;},delete(){operation='delete';return q;},
   then(resolve,reject){return Promise.resolve().then(()=>{calls.push({table,operation,columns});
    if(fail?.table===table&&(!fail.operation||fail.operation===operation))return {data:null,error:{message:'Own fixture lookup failure'}};
    if(table==='notifications'&&notificationFails)throw Error('Own fixture notification failure');
    if(operation==='upsert'){mutations.push({table,operation,payload:structuredClone(payload)});const previous=data[table].find(row=>row.liker_id===payload.liker_id&&row.listing_id===payload.listing_id);if(previous)Object.assign(previous,payload);else data[table].push({id:'own-rating',...payload});return {data:null,error:null};}
    if(operation==='insert'){mutations.push({table,operation,payload:structuredClone(payload)});data[table].push(structuredClone(payload));return {data:null,error:null};}
    if(operation==='delete'){mutations.push({table,operation});data[table]=data[table].filter(row=>!filters.every(filter=>filter(row)));return {data:null,error:null};}
    const rows=data[table].filter(row=>filters.every(filter=>filter(row)));return {data:single?(rows[0]??null):rows,error:null};
   }).then(resolve,reject);},};return q;
 }};
 const mocks={'@/lib/db':{db},'@clerk/nextjs/server':{auth:async()=>({userId})},'next/server':{NextRequest,NextResponse},'next/cache':{revalidateTag:(...args)=>revalidations.push(args)},'@/lib/ratings':{fetchRatingSummaries:async ids=>{summaryCalls.push(ids);return Object.fromEntries(ids.map(id=>[id,{rating:4,reviews:2,ratingOnly:1}]))}},'@/lib/listing-routes':routes,'@/lib/i18n/notification-copy':notificationCopy,'next-intl/server':intlServerFor(locale)};
 const mod={exports:{}};new Function('require','module','exports',code)(name=>{assert.ok(Object.hasOwn(mocks,name),`Unexpected import ${name}`);return mocks[name];},mod,mod.exports);
 return {data,calls,mutations,summaryCalls,revalidations,
  post:body=>mod.exports.POST(new NextRequest('https://cinegenius.test/api/listing-ratings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})),
  get:ids=>mod.exports.GET(new NextRequest('https://cinegenius.test/api/listing-ratings?'+new URLSearchParams({ids:ids.join(',')}))),
 };
}
function noWrites(f){assert.deepEqual(f.mutations,[]);assert.deepEqual(f.revalidations,[]);}

for(const owner_id of [undefined,'spoofed-recipient','own-reviewer',null,{id:'spoofed-recipient'}])test(`new rating without a trusted client owner notifies the actual provider (${JSON.stringify(owner_id)})`,async()=>{
 const f=fixture(),response=await f.post({listing_id:publicListing.id,rating:4,owner_id});assert.equal(response.status,200);assert.deepEqual(await response.json(),{success:true});assert.match(response.headers.get('cache-control'),/no-store/);
 assert.equal(f.data.listing_ratings[0].liker_id,'own-reviewer');assert.equal(f.data.listing_ratings[0].rating,4);assert.equal(f.data.notifications.length,1);
 const notification=f.data.notifications[0];assert.equal(notification.user_id,publicListing.user_id);assert.equal(notification.href,'/props/public-offer');assert.equal(notification.localization.body.values.value0,f.data.profiles[0].display_name);assert.equal(notification.localization.body.values.value1,publicListing.title);assert.equal(notification.localization.body.values.value2,4);
});

test('changing an existing quick rating updates its value without sending another first-rating notification',async()=>{
 const f=fixture({quick:[{id:'previous-rating',liker_id:'own-reviewer',listing_id:publicListing.id,rating:2}]});const response=await f.post({listing_id:publicListing.id,rating:5});assert.equal(response.status,200);assert.equal(f.data.listing_ratings.length,1);assert.equal(f.data.listing_ratings[0].rating,5);assert.deepEqual(f.data.notifications,[]);
});

for(const owner_id of [undefined,'not-the-real-provider'])test('self-rating uses the actual listing owner even when client owner_id is omitted or false',async()=>{
 const f=fixture({userId:publicListing.user_id,contacts:[{...contact,sender_id:publicListing.user_id}],bookings:[{...booked,user_id:publicListing.user_id}]});const response=await f.post({listing_id:publicListing.id,rating:5,owner_id});assert.equal(response.status,403);noWrites(f);
});

test('company contact and notifications use the current company owner, never a technical creator or supplied recipient',async()=>{
 const company={id:'company-one',owner_user_id:'private-company-owner',published:true},f=fixture({listings:[companyListing],companies:[company],contacts:[{...contact,listing_id:companyListing.id,receiver_id:company.owner_user_id}]});
 const response=await f.post({listing_id:companyListing.id,rating:3,owner_id:'spoofed-recipient'});assert.equal(response.status,200);assert.equal(f.data.notifications[0].user_id,company.owner_user_id);assert.equal(f.data.notifications[0].href,'/vehicles/company-offer');
});

for(const userId of ['private-company-owner',companyListing.user_id])test(`company self-rating is blocked for ${userId}`,async()=>{
 const f=fixture({userId,listings:[companyListing],companies:[{id:'company-one',owner_user_id:'private-company-owner',published:true}],bookings:[{...booked,user_id:userId,listing_id:companyListing.id}]});const response=await f.post({listing_id:companyListing.id,rating:5,owner_id:'someone-else'});assert.equal(response.status,403);noWrites(f);
});

for(const contacts of [[],[{...contact,receiver_id:'unrelated-person'}],[{...contact,sender_id:'another-reviewer'}],[{...contact,listing_id:'another-offer'}]])test('only an actual contact with this listing provider qualifies the legacy contact path',async()=>{
 const f=fixture({contacts}),response=await f.post({listing_id:publicListing.id,rating:5});assert.equal(response.status,403);noWrites(f);
});

test('multiple genuine contacts do not fail eligibility or duplicate the provider notification',async()=>{
 const f=fixture({contacts:[contact,{...contact,id:'contact-two'}]}),response=await f.post({listing_id:publicListing.id,rating:4});assert.equal(response.status,200);assert.equal(f.data.notifications.length,1);
});

for(const status of ['pending','cancelled','rejected'])test(`${status} booking is not proof, but does not remove an existing valid contact`,async()=>{
 const noContact=fixture({contacts:[],bookings:[{...booked,status}]}),denied=await noContact.post({listing_id:publicListing.id,rating:4});assert.equal(denied.status,403);noWrites(noContact);
 const contacted=fixture({bookings:[{...booked,status}]}),allowed=await contacted.post({listing_id:publicListing.id,rating:4});assert.equal(allowed.status,200);
});

test('a confirmed booking qualifies its actual customer for the matching public listing without a prior conversation',async()=>{
 const f=fixture({contacts:[],bookings:[booked]}),response=await f.post({listing_id:publicListing.id,rating:4});assert.equal(response.status,200);assert.equal(f.data.notifications[0].user_id,publicListing.user_id);
 for(const booking of [{...booked,user_id:'someone-else'},{...booked,listing_id:'another-offer'}]){const wrong=fixture({contacts:[],bookings:[booking]});assert.equal((await wrong.post({listing_id:publicListing.id,rating:4})).status,403);noWrites(wrong);}
});

for(const configuration of [
 {listings:[]},
 {listings:[{...publicListing,published:false}]},
 {listings:[{...publicListing,user_id:null}]},
 {listings:[companyListing],companies:[]},
 {listings:[companyListing],companies:[{id:'company-one',owner_user_id:'private-company-owner',published:false}]},
])test('missing, private or unresolved providers cannot be rated or exposed through summaries, even with booking history',async()=>{
 const ids=configuration.listings.map(row=>row.id),target=ids[0]??publicListing.id;
 const f=fixture({...configuration,bookings:[{...booked,listing_id:target}],contacts:[{...contact,listing_id:target}],quick:[{id:'hidden-rating',listing_id:target,liker_id:'own-reviewer',rating:4}]});
 const response=await f.post({listing_id:target,rating:5,owner_id:'spoofed-recipient'});assert.equal(response.status,404);assert.match(response.headers.get('cache-control'),/no-store/);noWrites(f);
 const read=await f.get([target]);assert.equal(read.status,200);assert.deepEqual(await read.json(),{ratings:{},myRatings:{},eligible:[]});assert.deepEqual(f.summaryCalls,[]);
});

test('guest writes are denied before any database access and public reads never reveal provider or reviewer account IDs',async()=>{
 const f=fixture({userId:null,quick:[{id:'foreign-rating',listing_id:publicListing.id,liker_id:'private-foreign-reviewer',rating:5}]});
 const rejected=await f.post({listing_id:publicListing.id,rating:5});assert.equal(rejected.status,401);assert.deepEqual(f.calls,[]);noWrites(f);
 const response=await f.get([publicListing.id]);assert.equal(response.status,200);const body=await response.json();assert.deepEqual(body.myRatings,{});assert.deepEqual(body.eligible,[]);assert.equal(body.ratings[publicListing.id].avg,4);
 for(const id of [publicListing.user_id,'private-foreign-reviewer','private-company-owner'])assert.ok(!JSON.stringify(body).includes(id));
 assert.equal(f.calls.some(call=>call.table==='bookings'||call.table==='conversations'),false);
});

test('GET eligibility matches write rules and only the active reviewer sees their own ratings',async()=>{
 const privateListing={...publicListing,id:'private-offer',published:false},ownListing={...publicListing,id:'own-offer',user_id:'own-reviewer'};
 const f=fixture({listings:[publicListing,privateListing,ownListing,companyListing],companies:[{id:'company-one',owner_user_id:'private-company-owner',published:true}],
  contacts:[contact,{...contact,id:'fake-company-contact',listing_id:companyListing.id,receiver_id:'private-technical-editor'},{...contact,id:'fake-own-contact',listing_id:ownListing.id}],
  bookings:[{...booked,listing_id:companyListing.id}],
  quick:[{id:'my-rating',listing_id:publicListing.id,liker_id:'own-reviewer',rating:3},{id:'private-rating',listing_id:privateListing.id,liker_id:'own-reviewer',rating:1},{id:'other-rating',listing_id:companyListing.id,liker_id:'private-other-reviewer',rating:5}],
  reviews:[{id:'written',target_type:'listing',target_id:companyListing.id,reviewer_id:'own-reviewer',rating:4}],
 });
 const response=await f.get([publicListing.id,privateListing.id,ownListing.id,companyListing.id,publicListing.id]),body=await response.json();
 assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.deepEqual(new Set(body.eligible),new Set([publicListing.id,companyListing.id]));assert.deepEqual(body.myRatings,{[publicListing.id]:3,[companyListing.id]:4});
 assert.deepEqual(f.summaryCalls,[[publicListing.id,ownListing.id,companyListing.id]]);assert.equal(privateListing.id in body.ratings,false);
 for(const id of [publicListing.user_id,companyListing.user_id,'private-company-owner','private-other-reviewer'])assert.ok(!JSON.stringify(body).includes(id));noWrites(f);
});

for(const table of ['listings','conversations','listing_ratings'])test(`${table} failure cannot authorize a write or send a notification`,async()=>{
 const f=fixture({fail:{table,operation:'read'}}),response=await f.post({listing_id:publicListing.id,rating:4});assert.equal(response.status,500);noWrites(f);
});

test('an optional booking lookup failure preserves a genuinely proved contact and cannot authorize an unproved request',async()=>{
 const contacted=fixture({fail:{table:'bookings'}});assert.equal((await contacted.post({listing_id:publicListing.id,rating:4})).status,200);
 const unknown=fixture({contacts:[],fail:{table:'bookings'}});assert.equal((await unknown.post({listing_id:publicListing.id,rating:4})).status,500);noWrites(unknown);
});

test('a confirmed booking remains sufficient during a contact lookup outage',async()=>{
 const f=fixture({contacts:[],bookings:[booked],fail:{table:'conversations'}});assert.equal((await f.post({listing_id:publicListing.id,rating:4})).status,200);assert.equal(f.data.notifications[0].user_id,publicListing.user_id);
});

test('company lookup failure closes both write and read without falling back to a technical creator',async()=>{
 const f=fixture({listings:[companyListing],companies:[{id:'company-one',owner_user_id:'private-company-owner',published:true}],fail:{table:'companies'}});
 assert.equal((await f.post({listing_id:companyListing.id,rating:4})).status,500);assert.equal((await f.get([companyListing.id])).status,500);noWrites(f);
});

test('failed upsert cannot send a notification, while failed best-effort notification does not undo a saved rating',async()=>{
 const failed=fixture({fail:{table:'listing_ratings',operation:'upsert'}});assert.equal((await failed.post({listing_id:publicListing.id,rating:4})).status,500);noWrites(failed);
 const delivered=fixture({notificationFails:true});assert.equal((await delivered.post({listing_id:publicListing.id,rating:4})).status,200);assert.equal(delivered.data.listing_ratings.length,1);assert.deepEqual(delivered.revalidations,[['listings','max']]);
});

for(const listing_id of [undefined,null,{},[],42,'',' ','x'.repeat(129)])test(`malformed listing IDs are refused before lookup (${JSON.stringify(listing_id)})`,async()=>{
 const f=fixture(),response=await f.post({listing_id,rating:4,owner_id:'spoofed-recipient'});assert.equal(response.status,400);assert.deepEqual(f.calls,[]);noWrites(f);
});

for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv'])test(`${locale}: server-owned self-rating denial remains native and contains no account IDs`,async()=>{
 const f=fixture({locale,userId:publicListing.user_id}),response=await f.post({listing_id:publicListing.id,rating:4,owner_id:'someone-else'});assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:translatorFor(locale)('System.m_3455646e5edd')});noWrites(f);
});
