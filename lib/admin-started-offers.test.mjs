import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
import {createTranslator} from 'next-intl';
import * as offers from './admin-started-offers.ts';
import * as template from './support-started-offer-template.ts';
import * as setupTemplate from './support-setup-template.ts';
import * as messageTemplates from './support-message-templates.ts';
import * as flow from './profile-setup-flow.ts';
import * as participants from './support-identity.ts';
const require=createRequire(import.meta.url);
const {NextRequest,NextResponse}=require('next/server');
const own='user_OwnTest';
const stamp='2026-10-30T08:30:00Z';
const member=(id=own,progress={})=>({id,firstName:'Own',lastName:'Test',privateMetadata:{cinegeniusOnboarding:progress,secret:'never-expose'},emailAddresses:[]});
const row=(key,data,user=own)=>({user_id:user,form_key:key,draft_data:data,updated_at:stamp});
const listing={categoryId:'loc_wohnen',form:{title:'Own studio',city:'Own city',description:'private description'},responsible:{email:'secret@example.invalid'},imageUrl:'/api/media/private-test'};
const translate=(ns,locale='de')=>createTranslator({locale,messages:JSON.parse(readFileSync(new URL('../messages/'+locale+'.json',import.meta.url),'utf8')),namespace:ns});
function load(file,mocks){
 const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',code)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);return mod.exports;
}
function fixture({admin=true,users=[member()],drafts=[row('listing:new',listing)],companies=[],listings=[],databaseError=false,total=users.length}={}){
 const calls=[],clerkCalls=[],sends=new Map();
 const db=createClient('https://fixture.invalid','test-only-key',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const url=new URL(input);const method=init?.method??'GET';calls.push({url,method});
  let data=url.pathname.endsWith('/private_form_drafts')?drafts:url.pathname.endsWith('/companies')?companies:url.pathname.endsWith('/listings')?listings:url.pathname.endsWith('/support_message_templates')?[]:url.pathname.endsWith('/user_settings')?[{email_new_message:false}]:[];
  if(url.pathname.endsWith('/rpc/create_support_conversation')){
   const body=JSON.parse(init.body);const prior=sends.get(body.p_idempotency_key);
   data={conversation_id:'00000000-0000-4000-8000-000000000001',message_id:'00000000-0000-4000-8000-000000000002',created:!prior};sends.set(body.p_idempotency_key,body);
  }
  return new Response(JSON.stringify(databaseError?{message:'private diagnostic must not escape'}:data),{status:databaseError?503:200,headers:{'content-type':'application/json'}});
 }}});
 const clerk={users:{getUserList:async args=>{clerkCalls.push(args);return {data:users.slice(args.offset,args.offset+args.limit),totalCount:total}},getUser:async id=>{const found=users.find(u=>u.id===id);if(!found)throw new Error('missing account');return found}}};
 const mocks={'server-only':{},'@/lib/db':{db},'@/lib/requireAdmin':{requireAdmin:async()=>admin?{userId:'user_AdminTest'}:NextResponse.json({error:'Forbidden'},{status:403})},'@clerk/nextjs/server':{clerkClient:async()=>clerk},'next-intl/server':{getTranslations:async ns=>translate(ns)},'@/lib/admin-started-offers':offers,'@/lib/support-started-offer-template':template,'@/lib/profile-setup-flow':flow,'@/lib/support-message-templates':messageTemplates,'@/lib/support-setup-template':setupTemplate,'@/lib/admin-support-participants':{},'@/lib/support-identity':participants,'@/lib/email':{sendNewMessageEmail:()=>{throw new Error('no test email allowed')}},'@/lib/rateLimit':{rateLimit:async()=>({allowed:true})}};
 mocks['@/lib/admin-started-offers-server']=load('./admin-started-offers-server.ts',mocks);
 mocks['@/lib/admin-support']=load('./admin-support.ts',mocks);
 return {load:file=>load(file,mocks),calls,clerkCalls,sends,mocks,drafts};
}
const req=(path,body)=>new NextRequest('https://fixture.invalid'+path,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:undefined);

test('only offer recovery sources are projected, never profile, post, message or existing-edit snapshots',()=>{
 const rows=[row('listing:new',listing),row('profile:edit',{form:{title:'PRIVATE'}}),row('board:compose',{title:'PRIVATE'}),row('listing:11111111-1111-4111-8111-111111111111',listing),row('company:new',{name:'Other owner'},'user_Other')];
 const summaries=offers.startedOffersForAccount(own,{},rows);
 assert.equal(summaries.length,1);assert.equal(summaries[0].kind,'location');assert.equal(summaries[0].editUrl,'/inserat');
 assert.doesNotMatch(JSON.stringify(summaries),/PRIVATE|secret|description|imageUrl|private-test|Other owner|responsible/);
});
test('locations, marketplace vehicles, companies, animals and jobs have correct summaries without requiring photos',()=>{
 for(const [category,kind]of[['loc_wohnen','location'],['mk_fahrzeuge','marketplace'],['tier_hunde','animal'],['job_projekt','job']]){
  const result=offers.startedOffersForAccount(own,{},[row('listing:new',{categoryId:category,form:{title:'Own'}})]);
  assert.equal(result[0].kind,kind);
 }
 assert.equal(offers.startedOffersForAccount(own,{},[row('company:new',{name:'Own company'})])[0].editUrl,'/company-setup?onboarding=1');
 assert.equal(offers.startedOffersForAccount(own,{},[row('listing:new',{activeGroup:'marktplatz',form:{}})]).length,0);
 assert.equal(offers.startedOffersForAccount(own,{},[row('listing:new',{categoryId:'crew_regie',form:{title:'Own'}})]).length,0);
});
test('completion/discard tombstones suppress older mirrored drafts and empty forms are not reminders',()=>{
 const metadata={cinegeniusOnboarding:{companyDraft:{name:'Old'},locationFormDraft:{version:1,categoryId:'loc_wohnen',form:{title:'Old'}}}};
 assert.deepEqual(offers.startedOffersForAccount(own,metadata,[row('company:new',null),row('listing:new',null)]),[]);
 assert.deepEqual(offers.startedOffersForAccount(own,{},[row('company:new',{}),row('listing:new',null)]),[]);
});
test('modern and legacy onboarding offers resume the actual existing assistant; finished sections are excluded',()=>{
 const progress={quickStart:{version:3,step:'details',intents:['location','equipment','company'],sections:{location:{title:'Own house'},equipment:{title:'Own light'},company:{title:'Own company'}},completed:{listings:{equipment:'saved-id'}}},listingDrafts:{location:{type:'location',title:'Own house'}},companyDraft:{name:'Own old company'}};
 const result=offers.startedOffersForAccount(own,{cinegeniusOnboarding:progress},[]);
 assert.deepEqual(result.map(o=>o.kind),['location','company','company']);assert.equal(result[0].editUrl,'/profile-setup?resume=1');
 const old=offers.startedOffersForAccount(own,{cinegeniusOnboarding:{quickStart:{intent:'equipment',title:'Legacy light',category:'Lichttechnik'}}},[]);
 assert.equal(old[0].kind,'marketplace');assert.equal(old[0].title,'Legacy light');
});
test('draft target IDs require a valid account ID and an explicitly allowed source',()=>{
 assert.deepEqual(offers.parseStartedOfferId(own+'~listing:new'),{userId:own,source:'listing:new'});
 for(const id of [own+'~profile:edit',own+'~listing:new~extra','someone@example.invalid~company:new','../~company:new'])assert.equal(offers.parseStartedOfferId(id),null);
});
test('admin list is read-only, private, bounded and omits all raw metadata; saved listings are not duplicated',async()=>{
 const app=fixture();const response=await app.load('../app/api/admin/started-offers/route.ts').GET(req('/api/admin/started-offers'));
 assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);
 const body=await response.json();assert.equal(body.offers[0].accountName,'Own Test');assert.equal(body.nextOffset,null);
 assert.doesNotMatch(JSON.stringify(body),/privateMetadata|description|responsible|secret|draft_data|media/);
 assert.ok(app.calls.every(c=>c.method==='GET'));assert.equal(app.clerkCalls[0].limit,25);
 const saved=fixture({listings:[{user_id:own,title:'Own studio',type:'location'}]});assert.deepEqual(await saved.mocks['@/lib/admin-started-offers-server'].loadStartedOffers([member()]),[]);
});
test('pagination scans at most 100 accounts, preserves continuation and combines search with kind',async()=>{
 const users=Array.from({length:125},(_,i)=>member('user_Test'+i));const app=fixture({users,drafts:[]});
 const result=await app.load('../app/api/admin/started-offers/route.ts').GET(req('/api/admin/started-offers?kind=location&search=Own'));
 const body=await result.json();assert.equal(body.nextOffset,100);assert.equal(body.scanned,100);assert.equal(app.clerkCalls.length,4);assert.ok(app.clerkCalls.every(c=>c.query==='Own'&&c.limit===25));
});
test('guest/member cannot list, resolve or send, with no underlying data access',async()=>{
 const app=fixture({admin:false});
 for(const [file,method,path,body] of [['../app/api/admin/started-offers/route.ts','GET','/api/admin/started-offers'],['../app/api/admin/support/resolve/route.ts','GET','/api/admin/support/resolve?type=started_offer&id='+encodeURIComponent(own+'~listing:new')],['../app/api/admin/support/threads/route.ts','POST','/api/admin/support/threads',{}]]){
  assert.equal((await app.load(file)[method](req(path,body))).status,403);
 }
 assert.equal(app.calls.length,0);assert.equal(app.clerkCalls.length,0);
});
test('manual reminder resolves the actual draft account, has no invented public profile, checks again at send and stays idempotent',async()=>{
 const app=fixture();const targetId=own+'~listing:new';const target=await app.mocks['@/lib/admin-support'].resolveAdminSupportTarget('started_offer',targetId,'user_AdminTest');
 assert.equal(target.recipientUserId,own);assert.equal(target.recipientProfileUrl,null);assert.equal(target.startedOffer,true);assert.deepEqual(target.missingFields,[]);
 const body={targetType:'started_offer',targetId,templateKey:template.STARTED_OFFER_TEMPLATE_KEY,content:messageTemplates.fillSupportTemplate(template.startedOfferTemplate(translate('AdminStartedOffers')).body,target,'https://fixture.invalid'),idempotencyKey:'00000000-0000-4000-8000-000000000003'};
 const api=app.load('../app/api/admin/support/threads/route.ts');
 assert.equal((await api.POST(req('/api/admin/support/threads',body))).status,200);
 assert.equal((await (await api.POST(req('/api/admin/support/threads',body))).json()).duplicate,true);
 assert.equal(app.sends.size,1);assert.equal([...app.sends.values()][0].p_recipient_user_id,own);assert.equal([...app.sends.values()][0].p_edit_url,'/inserat');
 app.drafts[0].draft_data=null;
 const stale=await api.POST(req('/api/admin/support/threads',{...body,idempotencyKey:'00000000-0000-4000-8000-000000000004'}));assert.equal(stale.status,409);assert.equal(app.sends.size,1);
});
test('missing/deleted accounts, self reminders, unresolved placeholders and altered links cannot send',async()=>{
 const app=fixture();const resolver=app.mocks['@/lib/admin-support'];
 await assert.rejects(resolver.resolveAdminSupportTarget('started_offer',own+'~listing:new',own),error=>error.status===409);
 await assert.rejects(resolver.resolveAdminSupportTarget('started_offer','user_Deleted~listing:new','user_AdminTest'),error=>error.status===404);
 const api=app.load('../app/api/admin/support/threads/route.ts');
 for(const content of ['Hallo {{Vorname}}','Hallo Own, falscher Link https://example.invalid']){
  const response=await api.POST(req('/api/admin/support/threads',{targetType:'started_offer',targetId:own+'~listing:new',templateKey:template.STARTED_OFFER_TEMPLATE_KEY,content,idempotencyKey:'00000000-0000-4000-8000-000000000005'}));assert.equal(response.status,400);
 }
 assert.equal(app.sends.size,0);
});
test('read failures do not produce a misleading empty successful list or leak diagnostic data',async()=>{
 const app=fixture({databaseError:true});const result=await app.load('../app/api/admin/started-offers/route.ts').GET(req('/api/admin/started-offers'));
 assert.equal(result.status,503);assert.doesNotMatch(await result.text(),/diagnostic|secret/);
});
test('new reminder templates have valid links, neutral greetings and complete text in every locale',()=>{
 for(const locale of ['de','en','es','it','cs','hu']){
  const text=messageTemplates.fillSupportTemplate(template.startedOfferTemplate(translate('AdminStartedOffers',locale)).body,{editUrl:'/inserat',firstName:null,missingFields:[],listingTitle:'Own offer',targetLabel:'Own offer',companyName:null},'https://fixture.invalid');
  assert.match(text,/https:\/\/fixture.invalid\/inserat/);assert.doesNotMatch(text,/\{\{|undefined|\s+,/);
 }
});
