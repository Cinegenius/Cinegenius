import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
import {createTranslator} from 'next-intl';
import * as flow from './profile-setup-flow.ts';
import {adminAccountRow} from './admin-account-status.ts';
import * as templates from './support-setup-template.ts';
import {fillSupportTemplate} from './support-message-templates.ts';
import * as messageTemplates from './support-message-templates.ts';
import * as startedOffers from './admin-started-offers.ts';
import * as moderation from './offer-moderation.ts';
const require=createRequire(import.meta.url);
const {NextRequest,NextResponse}=require('next/server');
const messages=locale=>JSON.parse(readFileSync(new URL('../messages/'+locale+'.json',import.meta.url),'utf8'));
const translate=locale=>createTranslator({locale,messages:messages(locale),namespace:'AdminAccounts'});
const user=(id='userAccount',saved={})=>({id,firstName:'Own',lastName:'Test',primaryEmailAddressId:'primary',emailAddresses:[{id:'other',emailAddress:'other@example.invalid'},{id:'primary',emailAddress:'own@example.invalid'}],createdAt:123456,lastSignInAt:null,privateMetadata:{cinegeniusOnboarding:saved,privateSecret:'must-not-leak'}});
const profile={user_id:'userAccount',display_name:'Own profile',slug:'own-profile',avatar_url:null,location:'Own city',positions:['Gaffer'],role:null,profile_type:null,profile_types:[]};
function load(file,mocks){
 const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',code)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);return mod.exports;
}
function fixture({admin=true,users=[user()],profiles=[],settings=[],companies=[],listings=[],drafts=[],clerkError=false,databaseError=false,contentError=false,total=100}={}){
 const calls=[],clerkCalls=[];
 const db=createClient('https://fixture.invalid','fixture-only-key',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const url=new URL(input);calls.push({url,method:init?.method});
  const table=url.pathname.split('/').at(-1);
  let data=({profiles,user_settings:settings,companies,listings})[table]??[];
  if(['companies','listings'].includes(table))data=data.slice(Number(url.searchParams.get('offset')??0),Number(url.searchParams.get('offset')??0)+Number(url.searchParams.get('limit')??1000));
  const failed=databaseError||(contentError&&['companies','listings'].includes(table));
  return new Response(JSON.stringify(failed?{message:'unavailable'}:data),{status:failed?503:200,headers:{'content-type':'application/json'}});
 }}});
 const clerk={users:{getUserList:async args=>{clerkCalls.push(args);if(clerkError)throw new Error('secret details');return {data:users,totalCount:total}},getUser:async id=>{clerkCalls.push(id);if(clerkError)throw Object.assign(new Error('secret details'),{status:404});return users.find(u=>u.id===id)??user(id)}}};
 const mocks={'server-only':{},'@/lib/db':{db},'@/lib/requireAdmin':{requireAdmin:async()=>admin?{userId:'userAdmin'}:NextResponse.json({error:'Forbidden'},{status:403})},'@clerk/nextjs/server':{clerkClient:async()=>clerk},'next-intl/server':{getTranslations:async()=>translate('de')},'@/lib/admin-account-status':{adminAccountRow},'@/lib/profile-setup-flow':flow,'@/lib/support-message-templates':messageTemplates};
 mocks['@/lib/admin-started-offers']=startedOffers;
 mocks['@/lib/admin-started-offers-server']={loadStartedOffers:async()=>drafts};
 mocks['@/lib/offer-moderation']=moderation;
 mocks['@/lib/admin-account-content']=load('./admin-account-content.ts',mocks);
 return {load:file=>load(file,mocks),calls,clerkCalls};
}
const request=path=>new NextRequest('https://fixture.invalid'+path);
test('all registered accounts use Clerk pagination, join profiles without dropping account-only records, and expose no metadata',async()=>{
 const app=fixture({users:[user(),user('userNoProfile')],profiles:[profile],settings:[{user_id:'userAccount',profile_visibility:'private'}]});
 const response=await app.load('../app/api/admin/accounts/route.ts').GET(request('/api/admin/accounts?page=2'));
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
 const data=await response.json();assert.equal(data.total,100);assert.equal(data.accounts.length,2);
 assert.deepEqual(app.clerkCalls,[{limit:50,offset:50,orderBy:'-created_at'}]);
 assert.equal(data.accounts[0].profileStatus,'private');assert.equal(data.accounts[1].profileStatus,'missing');
 assert.equal(data.accounts[1].needsSetup,true);assert.equal(data.accounts[1].profileUrl,null);
 assert.equal(data.accounts[1].email,'own@example.invalid');
 assert.doesNotMatch(JSON.stringify(data),/privateSecret|privateMetadata|cinegeniusOnboarding|must-not-leak/);
 assert.ok(app.calls.every(call=>call.method==='GET'));
});
test('search and exact account IDs are resolved by Clerk; invalid page cannot produce an unbounded query',async()=>{
 for(const [search,expected]of[['user_exact',{userId:['user_exact']}],['Own',{query:'Own'}]]){
  const app=fixture();await app.load('../app/api/admin/accounts/route.ts').GET(request('/api/admin/accounts?page=NaN&search='+search));
  assert.deepEqual(app.clerkCalls[0],{limit:50,offset:0,orderBy:'-created_at',...expected});
 }
 const exact=fixture();await exact.load('../app/api/admin/accounts/route.ts').GET(request('/api/admin/accounts?search=user_exact'));
 assert.deepEqual(exact.clerkCalls[0].userId,['user_exact']);
});
test('support inbox resolves the registered account name without creating a fake public profile',async()=>{
 const app=fixture({users:[user('userNoProfile')]});
 const participants=await app.load('./admin-support-participants.ts').adminSupportParticipants(['userNoProfile'],[]);
 assert.equal(participants.get('userNoProfile').display_name,'Own Test');
 assert.equal(participants.get('userNoProfile').slug,null);
 assert.doesNotMatch(JSON.stringify([...participants.values()]),/email|privateMetadata|privateSecret/);
});
test('normal members cannot list accounts; external failures never become an apparently empty successful result',async()=>{
 const denied=fixture({admin:false});assert.equal((await denied.load('../app/api/admin/accounts/route.ts').GET(request('/api/admin/accounts'))).status,403);assert.equal(denied.clerkCalls.length,0);assert.equal(denied.calls.length,0);
 for(const options of [{clerkError:true},{databaseError:true},{contentError:true}]){
  const app=fixture(options);const response=await app.load('../app/api/admin/accounts/route.ts').GET(request('/api/admin/accounts'));
  assert.equal(response.status,503);assert.doesNotMatch(JSON.stringify(await response.json()),/secret details|accounts/);
 }
});
test('completed company-only accounts show their real private company and its review target without publication or invented personal profiles',async()=>{
 const app=fixture({users:[user('userCompany',{setupComplete:true,intent:'company'})],companies:[{id:'company1',owner_user_id:'userCompany',name:'Own test company',published:false,privateSecret:'not-projected'}]});
 const response=await app.load('../app/api/admin/accounts/route.ts').GET(request('/api/admin/accounts'));
 const {accounts}=await response.json();assert.equal(response.status,200);
 assert.equal(accounts[0].profileStatus,'missing');assert.equal(accounts[0].needsSetup,false);
 assert.deepEqual(accounts[0].content,{companies:[{id:'company1',title:'Own test company',published:false}],listings:[],drafts:[]});
 assert.doesNotMatch(JSON.stringify(accounts),/not-projected|privateSecret|privateMetadata/);
 assert.ok(app.calls.every(call=>call.method==='GET'));
});
test('account content keeps public/private listings, exact moderation and form-only drafts separate, without mixing accounts or changing provider attribution',async()=>{
 const app=fixture({users:[user('userA'),user('userB')],companies:[{id:'firmB',owner_user_id:'userB',name:'Firm B',published:true}],listings:[{id:'locA',user_id:'userA',title:'Own location',type:'location',published:false,moderation_status:'pending'},{id:'propA',user_id:'userA',title:'Own prop',type:'prop',published:true,moderation_status:'owner_published'},{id:'foreign',user_id:'not-on-page',title:'Not on page',type:'vehicle',published:true}],drafts:[{id:'userB~company:new',userId:'userB',kind:'company',title:'Private draft',editUrl:'/company-setup',privateSecret:'no'}]});
 const {accounts}=await (await app.load('../app/api/admin/accounts/route.ts').GET(request('/api/admin/accounts'))).json();
 assert.deepEqual(accounts[0].content.listings.map(l=>[l.id,l.status,l.published]),[['locA','pending',false],['propA','owner_published',true]]);
 assert.equal(accounts[0].content.companies.length,0);assert.equal(accounts[0].content.drafts.length,0);
 assert.equal(accounts[1].content.listings.length,0);assert.equal(accounts[1].content.companies.length,1);
 assert.deepEqual(accounts[1].content.drafts,[{id:'userB~company:new',title:'Private draft',kind:'company'}]);
 assert.doesNotMatch(JSON.stringify(accounts),/Not on page|editUrl|privateSecret/);
 assert.ok(app.calls.filter(c=>['companies','listings'].some(t=>c.url.pathname.endsWith('/'+t))).every(c=>c.url.searchParams.get(c.url.pathname.endsWith('/companies')?'owner_user_id':'user_id')==='in.(userA,userB)'));
 const source=readFileSync(new URL('../components/admin/AdminAccounts.tsx',import.meta.url),'utf8');
 assert.match(source,/reviewPath\("company", company.id\)/);assert.match(source,/reviewPath\("listing", listing.id\)/);
 assert.match(source,/targetType="started_offer"/);assert.match(source,/t\("creatorNotice"\)/);
 assert.doesNotMatch(source,/method:\s*["'](?:POST|PATCH|DELETE)/);
});
test('account reconciliation follows the database row limit instead of silently omitting later owned companies',async()=>{
 const companies=Array.from({length:1001},(_,i)=>({id:'company'+i,owner_user_id:'userAccount',name:'Own firm '+i,published:i%2===0}));
 const app=fixture({companies});const response=await app.load('../app/api/admin/accounts/route.ts').GET(request('/api/admin/accounts'));
 const {accounts}=await response.json();assert.equal(response.status,200);assert.equal(accounts[0].content.companies.length,1001);
 assert.equal(app.calls.filter(c=>c.url.pathname.endsWith('/companies')).length,2);
 const empty=fixture({users:[],total:0});assert.deepEqual((await (await empty.load('../app/api/admin/accounts/route.ts').GET(request('/api/admin/accounts'))).json()).accounts,[]);assert.equal(empty.calls.length,0);
});
test('new reconciliation labels are nonempty and renderable in all supported languages',()=>{
 for(const locale of ['de','en','es','it','cs','hu'])for(const key of ['contentEmpty','ownedCompanies','createdListings','creatorNotice','privateDrafts','draftNotice','contentPublic','contentPrivate','manageContent','reviewAndPublish','nonPersonalSetupNotice','contentKinds.location','contentKinds.prop','contentKinds.vehicle','contentKinds.job','contentKinds.creator','contentKinds.service','contentKinds.animal','contentKinds.other']){
  assert.ok(translate(locale)(key).length>0);assert.notEqual(translate(locale)(key),'AdminAccounts.'+key);
 }
});
test('completed searchers/company-only accounts do not get classified as unfinished; incomplete and private profiles stay distinct',()=>{
 for(const intent of ['search','company','location','equipment'])assert.equal(adminAccountRow(user('userAccount',{setupComplete:true,intent}),null,null).needsSetup,false);
 assert.equal(adminAccountRow(user(),{...profile,location:''},null).profileStatus,'incomplete');
 assert.equal(adminAccountRow(user(),profile,'private').needsSetup,false);
 assert.equal(adminAccountRow(user(),profile,'private').profileStatus,'private');
 assert.equal(adminAccountRow(user(),profile,'private').profileUrl,null);
});
test('support safely resolves a real account without creating a public profile, resumes its existing wizard and blocks self-send',async()=>{
 const app=fixture({users:[user('userAccount',{quickStart:{step:3}})],profiles:null});
 const api=app.load('./admin-support.ts');
 const target=await api.resolveAdminSupportTarget('profile','userAccount','userAdmin');
 assert.equal(target.recipientUserId,'userAccount');assert.equal(target.recipientProfileUrl,null);
 assert.equal(target.setupIncomplete,true);assert.equal(target.editUrl,'/profile-setup?resume=1');
 assert.deepEqual(target.missingFields,[],'do not invent mandatory crew fields for an unclassified account');
 await assert.rejects(api.resolveAdminSupportTarget('profile','userAccount','userAccount'),/dich selbst/);
 assert.ok(app.calls.every(call=>call.method==='GET'));
 const done=fixture({users:[user('userAccount',{setupComplete:true,intent:'search'})],profiles:null});
 assert.equal((await done.load('./admin-support.ts').resolveAdminSupportTarget('profile','userAccount','userAdmin')).setupIncomplete,false);
 const deleted=fixture({clerkError:true,profiles:null});await assert.rejects(deleted.load('./admin-support.ts').resolveAdminSupportTarget('profile','userMissing','userAdmin'),error=>error.status===404&&!error.message.includes('secret'));
});
test('setup reminder is usable in all six languages, contains a valid resumable link and no invented personal details',()=>{
 for(const locale of ['de','en','es','it','cs','hu']){
  const template=templates.setupSupportTemplate(translate(locale));
  const text=fillSupportTemplate(template.body,{editUrl:'/profile-setup?resume=1',firstName:null,missingFields:[],listingTitle:null,targetLabel:'Own test account',companyName:null},'https://www.cinegenius.co');
  assert.match(text,/https:\/\/www.cinegenius.co\/profile-setup\?resume=1/);assert.doesNotMatch(text,/\{\{|example|undefined/);
 }
});
