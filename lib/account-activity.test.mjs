import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {NextRequest,NextResponse} from 'next/server.js';
import {accountActivityEnabled,activityMonthDate} from './account-activity.ts';
import {trustedMutationOrigin} from './request-origin.ts';
import {authorizedListingFreshnessCron} from './listing-freshness-cron-auth.ts';
import * as locales from './i18n/locales.ts';
function load(file,deps){const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};new Function('require','module','exports',source)(id=>{assert.ok(Object.hasOwn(deps,id),`unmocked ${id}`);return deps[id];},module,module.exports);return module.exports;}
const headers={'Cache-Control':'private, no-store, max-age=0'};
function endpoint(actor='own-account'){
 const calls=[];const deps={'next/server':{NextRequest,NextResponse},'@/lib/auth':{getCurrentUser:async()=>actor?{userId:actor}:null},'@/lib/request-origin':{trustedMutationOrigin},'@/lib/account-activity-server':{ACCOUNT_ACTIVITY_HEADERS:headers,getAccountActivity:async id=>{calls.push(['read',id]);return {enabled:true,state:null};},recordAccountActivity:async id=>{calls.push(['write',id]);return {reactivated:true};}}};
 return {...load('../app/api/account/activity/route.ts',deps),calls};
}
const req=(body={},origin='https://cinegenius.co')=>new NextRequest('https://cinegenius.co/api/account/activity',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
test('month dates clamp leap years and month ends, do not silently use 365-day years',()=>{
 assert.equal(activityMonthDate('2024-02-29T10:00:00Z',12),'2025-02-28T10:00:00.000Z');
 assert.equal(activityMonthDate('2025-08-31T00:00:00Z',18),'2027-02-28T00:00:00.000Z');
 assert.equal(activityMonthDate('2026-01-31T00:00:00Z',15),'2027-04-30T00:00:00.000Z');
 assert.throws(()=>activityMonthDate('bad',12));
});
test('worker requires both explicit activation and production, never preview',()=>{
 for(const env of [{},{VERCEL_ENV:'production'},{VERCEL_ENV:'preview',ACCOUNT_INACTIVITY_ENABLED:'true'},{VERCEL_ENV:'production',ACCOUNT_INACTIVITY_ENABLED:'false'}])assert.equal(accountActivityEnabled(env),false);
 assert.equal(accountActivityEnabled({VERCEL_ENV:'production',ACCOUNT_INACTIVITY_ENABLED:'true'}),true);
});
test('activity requires authentication and trusted origin, ignores forged account/date and GET never reactivates',async()=>{
 const guest=endpoint(null);for(const method of ['GET','POST'])assert.equal((await guest[method](req())).status,401);assert.equal(guest.calls.length,0);
 const f=endpoint();assert.equal((await f.POST(req({},'https://hostile.invalid'))).status,403);assert.equal(f.calls.length,0);
 const response=await f.POST(req({userId:'victim',at:'2999-01-01'}));assert.equal(response.status,200);assert.equal((await response.json()).reactivated,true);assert.deepEqual(f.calls,[['write','own-account'],['read','own-account']]);
 assert.match(response.headers.get('cache-control'),/no-store/);f.calls.length=0;await f.GET();assert.deepEqual(f.calls,[['read','own-account']]);
});
test('cron rejects missing and forged secret and cannot be triggered by HEAD',async()=>{
 let calls=0;const old=process.env.CRON_SECRET;process.env.CRON_SECRET='own-strong-test-secret';try{
 const route=load('../app/api/cron/account-inactivity/route.ts',{'next/server':{NextRequest,NextResponse},'@/lib/listing-freshness-cron-auth':{authorizedListingFreshnessCron},'@/lib/account-activity-server':{ACCOUNT_ACTIVITY_HEADERS:headers,runAccountActivityWorker:async()=>{calls++;return {status:'completed'};}}});
 for(const value of ['', 'Bearer undefined','Bearer wrong'])assert.equal((await route.GET(new NextRequest('https://cinegenius.co/api/cron/account-inactivity',{headers:{authorization:value}}))).status,401);
 assert.equal(route.HEAD().status,405);assert.equal(calls,0);assert.equal((await route.GET(new NextRequest('https://cinegenius.co/api/cron/account-inactivity',{headers:{authorization:'Bearer own-strong-test-secret'}}))).status,200);assert.equal(calls,1);
 }finally{if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;}
});
function worker(options={}){
 const events=[];const now=Date.now();let enabled=options.enabled!==false;
 const candidate={user_id:'own-account',cycle:1,stage:options.stage??'warning',last_activity_at:new Date(now-800*86400000).toISOString()};
 const notice={id:'11111111-1111-4111-8111-111111111111',stage:options.stage==='active'?'policy':'warning',cycle:1,payload:options.changedRecipient?{to:'old@example.invalid'}:null};
 const email={to:'own@example.invalid',locale:'de'};
 const db={from(table){const q={select:()=>q,eq:()=>q,is:()=>q,lte:()=>q,lt:()=>q,in:()=>q,order:()=>q,limit:()=>q,delete:()=>{events.push('delete:'+table);return q;},update:()=>{events.push('update:'+table);return q;},single:async()=>({data:{cycle:options.stale?2:1,exempt:false},error:null}),then(resolve){const data=table==='account_activity'?[candidate]:table==='account_activity_outbox'?options.notices?[notice]:[{...notice,status:'sent',provider_id:'test-id',payload:email}]:[];return Promise.resolve({data,error:null}).then(resolve);}};return q;},async rpc(name,args){events.push(name);if(name==='claim_account_activity_worker')return {data:options.busy?null:0,error:null};if(name==='bind_account_activity_mail')return {data:options.cancelBinding?null:{payload:email},error:null};return {data:{changed:false},error:null};}};
 const member={id:'own-account',createdAt:now,lastSignInAt:options.recentLogin?now:0,lastActiveAt:0,primaryEmailAddressId:'primary',emailAddresses:[{id:'primary',emailAddress:'own@example.invalid',verification:{status:options.unverified?'unverified':'verified'}}],privateMetadata:{}};
 const deps={'server-only':{},'node:crypto':{randomUUID:()=> 'test-lease'},'@clerk/nextjs/server':{clerkClient:async()=>({users:{getUserList:async()=>({data:[],totalCount:0}),getUser:async()=>{if(options.accountError)throw {status:options.accountError};return member;}}})},'next/cache':{revalidatePath(){},revalidateTag(){}},'@/lib/db':{db},'@/lib/admin-policy':{isConfiguredAdmin:()=>!!options.admin},'@/lib/i18n/locales':locales,'@/lib/i18n/notification-copy':{localizedNotification:()=>({title:'Own',body:'Own'})},'@/lib/account-activity':{accountActivityEnabled:()=>enabled,activityMonthDate},'@/lib/account-activity-email':{buildAccountActivityEmail:async()=>email},'@/lib/listing-freshness-email':{getListingReminderDeliveryStatus:async()=>options.delivery??'delivered',isFrozenListingReminderEmail:()=>true,sendListingReminderEmail:async()=>{events.push('send');return {ok:true,id:'test-id'};}}};
 return {...load('./account-activity-server.ts',deps),events};
}
async function run(options){const saved=process.env.RESEND_API_KEY;process.env.RESEND_API_KEY='not-a-real-key';try{const f=worker(options);const result=await f.runAccountActivityWorker();return {...f,result};}finally{if(saved===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=saved;}}
test('disabled or overlapping worker does no work',async()=>{for(const options of [{enabled:false},{busy:true}]){const f=await run(options);assert.ok(['disabled','busy'].includes(f.result.status));assert.ok(!f.events.includes('advance_account_activity'));assert.ok(!f.events.includes('send'));}});
test('confirmed provider delivery permits transition but timeout/bounce cannot trigger restriction or deletion review',async()=>{
 for(const stage of ['reminder','warning','deletion_pending'])for(const delivery of ['unavailable','bounced','pending']){const f=await run({stage,delivery});assert.ok(!f.events.includes('advance_account_activity'),stage+delivery);}
 assert.ok((await run({delivery:'delivered'})).events.includes('advance_account_activity'));
});
test('unverified email, recent login, admin exemption, stale cycle and changed recipient never send stale mail',async()=>{
 for(const options of [{unverified:true},{recentLogin:true},{admin:true},{stale:true},{changedRecipient:true},{cancelBinding:true}]){const f=await run({...options,notices:true});assert.ok(!f.events.includes('send'),JSON.stringify(options));}
});
test('successful send is durable and worker releases lock; cleanup touches only canceled outbox',async()=>{
 const f=await run({notices:true});assert.ok(f.events.includes('send'));assert.ok(f.events.includes('finish_account_activity_mail'));assert.equal(f.events.at(-1),'finish_account_activity_worker');assert.deepEqual(f.events.filter(e=>e.startsWith('delete:')),['delete:account_activity_outbox']);
});

test('every supported locale renders complete service emails and the canonical notification matches its catalog',async()=>{
 const {createTranslator}=await import('next-intl');
 const {localizedNotification,localizeNotification}=await import('./i18n/notification-copy.ts');
 const seen=new Set();
 const email=load('./account-activity-email.ts',{'server-only':{},'next-intl/server':{getTranslations:async({locale,namespace})=>{const catalog=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url)));return createTranslator({locale,messages:catalog,namespace,onError:error=>{throw error;}});}},'@/lib/listing-freshness-email':{isFrozenListingReminderEmail:value=>value.to==='own@example.invalid'&&value.text.includes('https://cinegenius.co/dashboard?tab=settings')}});
 for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv']){
  const catalog=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url)));const t=createTranslator({locale,messages:catalog.NotificationCopy,onError:error=>{throw error;}});
  for(const stage of ['policy','reminder','warning','paused','deletion_pending','review','reactivated']){
   const body=await email.buildAccountActivityEmail('own@example.invalid',locale,stage);assert.match(body.html,new RegExp(`lang="${locale}"`));assert.ok(body.text.includes(catalog.AccountActivity.notices[stage].body));assert.ok(!/[\r\n]/.test(body.subject));
   const source=localizedNotification({title:{key:`activity_${stage}_title`},body:{key:`activity_${stage}_body`}});const projected=localizeNotification({type:'account_inactivity',...source},t);assert.equal(projected.title,catalog.AccountActivity.notices[stage].title);assert.equal(projected.body,catalog.AccountActivity.notices[stage].body);
  }
  seen.add(catalog.AccountActivity.title);
 }
 assert.equal(seen.size,8,'Dutch and Belgian Dutch intentionally share reviewed interface wording');
});

test('recent provider activity does not starve the initial policy mail for already-active members',async()=>{
 const f=await run({stage:'active',recentLogin:true,notices:true});assert.ok(f.events.includes('record_account_activity'));assert.ok(f.events.includes('send'));
});

test('completed informational notices do not need retained recipients or masquerade as delivery failures',async()=>{
 for(const stage of ['active','paused','review']) {const f=await run({stage});assert.ok(!f.events.includes('confirm_account_activity_delivery'));}
});

test('only confirmed missing provider accounts erase inactivity records; temporary errors preserve them',async()=>{
 for(const status of [404,401,429,503]){const f=await run({accountError:status});assert.equal(f.events.includes('delete:account_activity'),status===404);assert.ok(!f.events.includes('send'));assert.ok(!f.events.includes('advance_account_activity'));}
 const disabled=worker({enabled:false});await disabled.removeAccountActivity('own-account');assert.ok(disabled.events.includes('delete:account_activity'));
});
