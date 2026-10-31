import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator} from 'next-intl';
import ts from 'typescript';
import {bookingDateKey, bookingDays, submitBookingRequest} from './booking-request.ts';
const require=createRequire(import.meta.url);
const root=new URL('../',import.meta.url);
function load(file,mocks={}){
 const code=ts.transpileModule(readFileSync(new URL(file,root),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',code)(name=>mocks[name]??require(name),mod,mod.exports);return mod.exports;
}
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
test('server rejection cannot become a fabricated booking reference',async()=>{
 for(const status of [400,401,403,404,409,500,503])await assert.rejects(submitBookingRequest({listingId:'own-fixture'},async()=>response({error:'test'},status)));
});
test('only a valid saved receipt is accepted; malformed JSON, empty and missing refs fail',async()=>{
 for(const value of [{},null,{ref:''},{ref:123},{ref:'javascript:fake'},{ref:'CG-'}])await assert.rejects(submitBookingRequest({},async()=>response(value)));
 await assert.rejects(submitBookingRequest({},async()=>new Response('not-json')));
 await assert.rejects(submitBookingRequest({},async()=>{throw new Error('offline')}));
 let sent;assert.equal(await submitBookingRequest({listingId:'fixture',notes:'kept'},async(url,options)=>{sent={url,...options};return response({id:'own-fixture',ref:'CG-ABC123'})}),'CG-ABC123');
 assert.equal(sent.url,'/api/bookings');assert.equal(sent.method,'POST');assert.deepEqual(JSON.parse(sent.body),{listingId:'fixture',notes:'kept'});
});
test('local calendar keys preserve the selected day in Berlin and across DST',()=>{
 const result=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',`import {bookingDateKey} from ${JSON.stringify(new URL('./booking-request.ts',import.meta.url).href)};console.log(JSON.stringify([new Date(2026,9,25),new Date(2026,2,29),new Date(2026,10,6)].map(bookingDateKey)));`],{encoding:'utf8',env:{...process.env,TZ:'Europe/Berlin'}});
 assert.equal(result.status,0);assert.deepEqual(JSON.parse(result.stdout),['2026-10-25','2026-03-29','2026-11-06']);
 assert.equal(bookingDays('2026-10-24','2026-10-26'),2);assert.equal(bookingDays('2026-03-28','2026-03-30'),2);assert.equal(bookingDays('2026-11-06','2026-11-06'),1);assert.equal(bookingDays('2026-11-08','2026-11-06'),0);
});
const locales=['de','en','es','it','cs','hu'];
for(const locale of locales){
 const messages=JSON.parse(readFileSync(new URL(`messages/${locale}.json`,root),'utf8'));
 const intl={useLocale:()=>locale,useTranslations:namespace=>createTranslator({locale,messages,namespace})};
 test(`calendar days and month arrows expose native keyboard controls in ${locale}`,()=>{
  const Calendar=load('components/AvailabilityCalendar.tsx',{'next-intl':intl,'@/lib/booking-request':{bookingDateKey,bookingDays}}).default;
  const date=new Date();const html=renderToStaticMarkup(React.createElement(Calendar,{dailyRate:10,onSelect:()=>{},blockedDates:[bookingDateKey(date)]}));
  assert.match(html,/<button type="button" aria-label=/);assert.ok(html.includes(messages.AvailabilityCalendar.nextMonth));assert.ok(html.includes(messages.AvailabilityCalendar.prevMonth));
  assert.match(html,/disabled="" aria-label="[^"]+" aria-pressed="false"/);assert.match(html,/role="status"/);assert.ok(!html.includes('onClick='));
 });
 for(const legalRequired of [false,true])test(`registration always exposes legal links without mandatory privacy consent: ${locale}, Clerk legal=${legalRequired}`,()=>{
  const mocks={
   'next-intl':intl,
   '@clerk/nextjs':{useAuth:()=>({isLoaded:true,isSignedIn:false}),useClerk:()=>({}),useSignUp:()=>({signUp:{requiredFields:legalRequired?['legal_accepted']:[]},errors:{fields:{}},fetchStatus:'idle'})},
   'next/navigation':{useRouter:()=>({})},'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
   '@/lib/i18n/auth-messages':{},'@/lib/sign-in-flow':{},'@/lib/password-reset-flow':{},
  };
  const Form=load('components/AuthForm.tsx',mocks).default;
  const html=renderToStaticMarkup(React.createElement(Form,{mode:'sign-up',destination:'/profile-setup'}));
  assert.match(html,/href="\/agb"/);assert.match(html,/href="\/datenschutz"/);assert.ok(html.indexOf('href="/datenschutz"')<html.indexOf('type="submit"'));
  assert.equal((html.match(/type="checkbox"/g)??[]).length,Number(legalRequired));assert.ok(!html.includes('registrationLegalNotice'));
 });
}
test('prepared Sentry init contains no replay recorder and both rates are zero',()=>{
 let init;let replay=0;load('sentry.client.config.ts',{'@sentry/nextjs':{init:options=>{init=options},replayIntegration:()=>{replay++;return {}}}});
 assert.equal(init.replaysOnErrorSampleRate,0);assert.equal(init.replaysSessionSampleRate,0);assert.equal(replay,0);assert.equal(init.integrations,undefined);
});

function apiFixture({signedIn=true,saveFails=false,clerkFails=false,owner='provider'}={}){
 const messages=JSON.parse(readFileSync(new URL('messages/de.json',root),'utf8'));
 const notices=[],saved=[],emails=[];
 class JsonResponse extends Response {static json(value,options={}){return new JsonResponse(JSON.stringify(value),options)}}
 const db={from(table){
  if(table==='listings'){const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{id:'fixture',title:'Own test location',price:100,type:'location',user_id:owner,published:true}})};return q;}
  if(table==='profiles'){const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{display_name:'Test member'}})};return q;}
  if(table==='notifications')return {insert:async item=>{notices.push(item);return {error:null}}};
  if(table==='bookings')return {insert:item=>{saved.push(item);return {select:()=>({single:async()=>({data:saveFails?null:{id:'saved',ref:item.ref},error:saveFails?{code:'TEST'}:null})})}}};
  throw new Error('Unexpected table '+table);
 }};
 const mocks={
  '@/lib/db':{db},'@/lib/auth':{requireAuth:async()=>signedIn?{userId:'member'}:JsonResponse.json({error:'unauthorized'},{status:401})},
  '@/lib/i18n/locales':{resolveLocale:()=> 'de'},'@/lib/booking-request':{bookingDays},
  'next/server':{NextResponse:JsonResponse},'next-intl/server':{getTranslations:async()=>createTranslator({locale:'de',messages,namespace:'BookingRequest'})},
  '@/lib/email':{sendNewBookingEmail:async(...args)=>emails.push(args)},
  '@clerk/nextjs/server':{clerkClient:async()=>{if(clerkFails)throw new Error('unavailable');return {users:{getUser:async()=>({emailAddresses:[{emailAddress:'own-test@example.invalid'}]})}}}},
 };
 return {post:load('app/api/bookings/route.ts',mocks).POST,notices,saved,emails};
}
const apiRequest=()=>new Request('http://test.invalid/api/bookings',{method:'POST',body:JSON.stringify({listingId:'fixture',startDate:'2026-11-06',endDate:'2026-11-08',dailyRate:1,listingTitle:'forged',notes:'own fixture'})});
test('request API persists pending status and trusted listing price, then sends request notices',async()=>{
 const f=apiFixture();const res=await f.post(apiRequest());assert.equal(res.status,200);assert.match((await res.json()).ref,/^CG-/);
 assert.equal(f.saved.length,1);assert.equal(f.saved[0].status,'pending');assert.equal(f.saved[0].total,200);assert.equal(f.saved[0].listing_title,'Own test location');
 assert.deepEqual(f.notices.map(n=>n.user_id),['member','provider']);assert.match(f.notices[1].body,/noch nicht bestätigt/);assert.equal(f.emails.length,1);
});
test('email account lookup failure does not suppress the provider in-app request notice',async()=>{
 const f=apiFixture({clerkFails:true});assert.equal((await f.post(apiRequest())).status,200);assert.equal(f.notices.length,2);assert.equal(f.emails.length,0);
});
test('failed persistence never issues a receipt or notification',async()=>{
 const f=apiFixture({saveFails:true});const res=await f.post(apiRequest());assert.equal(res.status,500);assert.equal((await res.json()).ref,undefined);assert.equal(f.notices.length,0);assert.equal(f.emails.length,0);
});
test('signed-out requests and requests for an own listing remain rejected',async()=>{
 for(const options of [{signedIn:false},{owner:'member'}]){const f=apiFixture(options);assert.ok([400,401].includes((await f.post(apiRequest())).status));assert.equal(f.saved.length,0);assert.equal(f.notices.length,0);}
});

test('request email uses translated request wording and escapes member-controlled text',async()=>{
 const previous=process.env.RESEND_API_KEY;process.env.RESEND_API_KEY='local-test-only';
 const sent=[];
 try{
  const mail=load('lib/email.ts',{
   'resend':{Resend:class {emails={send:async value=>{sent.push(value);return {}}}}},
   '@/lib/i18n/locales':{DEFAULT_LOCALE:'de'},
   'next-intl/server':{getTranslations:async({locale,namespace})=>createTranslator({locale,namespace,messages:JSON.parse(readFileSync(new URL(`messages/${locale}.json`,root),'utf8'))})},
  });
  for(const locale of locales)await mail.sendNewBookingEmail('own-test@example.invalid','<script>title</script>','<b>member</b>',locale);
  assert.equal(sent.length,6);
  for(const item of sent){assert.ok(item.html.includes('&lt;script&gt;title&lt;/script&gt;'));assert.ok(!item.html.includes('<script>'));assert.ok(item.html.includes('/dashboard?tab=bookings'));}
  assert.match(sent[0].subject,/Neue Anfrage/);assert.match(sent[1].subject,/New request/);
 }finally{if(previous===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=previous;}
});
