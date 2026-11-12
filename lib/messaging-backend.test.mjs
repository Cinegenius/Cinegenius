import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
import {NextRequest,NextResponse} from 'next/server.js';
import {intlServerFor,translatorFor} from './i18n-test-fixture.mjs';
import * as backend from './messaging-backend.ts';
import * as conversationLogic from './conversation-logic.ts';
import * as support from './support-identity.ts';
import {validFormDraftKey} from './form-draft.ts';
import {prepareMessageSend,restoredSendAttempt} from './message-send-attempt.ts';

const require=createRequire(import.meta.url),chat='10000000-0000-4000-8000-000000000001',message='20000000-0000-4000-8000-000000000001';
function load(file,mocks){const code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const mod={exports:{}};new Function('require','module','exports',code)(id=>Object.hasOwn(mocks,id)?mocks[id]:require(id),mod,mod.exports);return mod.exports;}
function fixture(file,{actor='actor',locale='en',allowed=true,rpcData,rpcError,results={},errors={}}={}){
 const calls=[],mails=[];
 const db=createClient('https://fixture.invalid','inert-fixture-key',{auth:{persistSession:false},global:{fetch:async(input,init={})=>{
  init.signal?.throwIfAborted();const url=new URL(input),table=url.pathname.split('/').at(-1),body=init.body?JSON.parse(init.body):undefined;calls.push({url,body});
  const rpc=url.pathname.includes('/rpc/');const error=rpc?rpcError:errors[table];
  const data=rpc?(typeof rpcData==='function'?rpcData(table,body):rpcData??{conversationId:chat,message:{id:message,conversation_id:chat,sender_id:actor,content:'Own text'},created:true}):(typeof results[table]==='function'?results[table](url):results[table]??(table==='profiles'?{display_name:'Own person'}:table==='user_settings'?{email_new_message:true}:null));
  return new Response(JSON.stringify(error??data),{status:error?400:200,headers:{'Content-Type':'application/json'}});
 }}});
 const api=load(file,{'@/lib/db':{db},'@/lib/auth':{requireAuth:async()=>actor?{userId:actor}:NextResponse.json({error:'denied'},{status:401})},'@/lib/rateLimit':{rateLimit:async()=>({allowed})},'@/lib/messaging-backend':backend,'@/lib/conversation-logic':conversationLogic,'@/lib/support-identity':support,'@/lib/message-read-state':{applyParticipantReadReceipts:x=>x},'@/lib/unread-message-counts':{getUnreadMessageCounts:async()=>({count:0,byConversation:{}})},'next-intl/server':intlServerFor(locale),'@clerk/nextjs/server':{clerkClient:async()=>({users:{getUser:async()=>({emailAddresses:[{emailAddress:'own-recipient@example.invalid'}]})}})},'@/lib/email':{sendNewMessageEmail:async(...args)=>mails.push(args)}});
 return{api,calls,mails};
}
const request=(body,path='/api/conversations',signal)=>new NextRequest('https://fixture.invalid'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
const params={params:Promise.resolve({id:chat})};
const directBody={accountId:'actor',receiver_id:'peer',content:'Own text',idempotencyKey:'own-request-key'};

test('all sending and group mutations reject another account before any database call',async()=>{
 for(const [file,method,body]of[
  ['app/api/conversations/route.ts','POST',directBody],['app/api/conversations/[id]/route.ts','POST',directBody],
  ['app/api/conversations/groups/route.ts','POST',{name:'Own group',member_ids:['peer'],idempotencyKey:'own-group-key'}],
  ['app/api/conversations/[id]/members/route.ts','POST',{action:'promote',user_id:'peer'}],['app/api/conversations/[id]/group/route.ts','PATCH',{name:'Own group'}],
  ['app/api/blocks/route.ts','POST',{blocked_id:'peer',blocked:true}],
 ]){
  const f=fixture(file);assert.equal((await f.api[method](request({...body,accountId:'old-account'}),params)).status,403,file);assert.equal(f.calls.length,0);assert.equal(f.mails.length,0);
 }
});
test('a stable send replay returns the persisted message and sends email once for both send endpoints',async()=>{
 for(const file of ['app/api/conversations/route.ts','app/api/conversations/[id]/route.ts']){
  let sent=false;const f=fixture(file,{rpcData:()=>{const created=!sent;sent=true;return{conversationId:chat,message:{id:message,sender_id:'actor',content:'Own text'},created}},results:{conversations:{kind:'direct',sender_id:'actor',receiver_id:'peer'},profiles:{display_name:'Own person'}}});
  const first=await f.api.POST(request(directBody),params),again=await f.api.POST(request(directBody),params);
  assert.equal(first.status,200);assert.equal(again.status,200);assert.equal((await again.json()).message.id,message);assert.equal(f.mails.length,1,file);
  const rpcs=f.calls.filter(call=>call.url.pathname.includes('/rpc/'));assert.equal(rpcs.length,2);assert.deepEqual(rpcs[0].body,rpcs[1].body);assert.equal(rpcs[0].body.p_idempotency_key,'own-request-key');
  assert.equal(f.calls.some(call=>call.body&&!call.url.pathname.includes('/rpc/')),false);
  assert.match(first.headers.get('cache-control'),/private, no-store/);
 }
});
test('missing keys, fabricated recipients and unknown database acknowledgements cannot send mail',async()=>{
 for(const patch of [{idempotencyKey:undefined},{idempotencyKey:'short'},{receiver_id:'bad),id.eq.secret'},{receiver_id:support.SUPPORT_ACTOR_ID}]){
  const f=fixture('app/api/conversations/route.ts');assert.equal((await f.api.POST(request({...directBody,...patch}))).status,400);assert.equal(f.calls.length,0);
 }
 const missing=fixture('app/api/conversations/route.ts',{rpcData:{conversationId:chat,created:true}});assert.equal((await missing.api.POST(request(directBody))).status,503);assert.equal(missing.mails.length,0);
 const denied=fixture('app/api/conversations/route.ts',{rpcError:{code:'42501',message:'PRIVATE block reason'}});const result=await denied.api.POST(request(directBody));assert.equal(result.status,403);assert.doesNotMatch(JSON.stringify(await result.json()),/PRIVATE/);assert.equal(denied.mails.length,0);
});
test('group creation and explicit admin promotion use the verified actor and exact request key',async()=>{
 const g=fixture('app/api/conversations/groups/route.ts',{rpcData:{conversationId:chat,created:false}});
 const response=await g.api.POST(request({accountId:'actor',name:' Own group ',member_ids:['peer','peer','actor'],idempotencyKey:'own-group-key',creator_id:'forged'}));
 assert.equal(response.status,200);assert.deepEqual(g.calls[0].body,{p_creator_id:'actor',p_name:'Own group',p_member_ids:['peer'],p_idempotency_key:'own-group-key'});
 const m=fixture('app/api/conversations/[id]/members/route.ts',{rpcData:null});assert.equal((await m.api.POST(request({accountId:'actor',action:'promote',user_id:'peer',actor_id:'forged'}),params)).status,200);assert.equal(m.calls[0].body.p_actor_id,'actor');assert.equal(m.calls[0].body.p_action,'promote');
});
test('private, blocked and friends-only search targets are excluded and failed lookups remain retryable errors',async()=>{
 const profiles=['allowed','private','blocked','friends-only'].map(user_id=>({user_id,display_name:user_id}));
 const f=fixture('app/api/conversations/users/route.ts',{results:{profiles,user_settings:[{user_id:'private',profile_visibility:'private'}]},rpcData:[{user_id:'allowed'}]});
 const response=await f.api.GET(new NextRequest('https://fixture.invalid/api/conversations/users?q=own'));
 assert.equal(response.status,200);assert.deepEqual((await response.json()).users.map(x=>x.id),['allowed']);
 const rpc=f.calls.find(call=>call.url.pathname.includes('/rpc/'));assert.deepEqual(rpc.body.p_recipients,['allowed','blocked','friends-only']);assert.ok(f.calls.every(call=>!call.url.href.includes('clerk')));
 for(const errorTable of ['profiles','user_settings']){const failed=fixture('app/api/conversations/users/route.ts',{results:{profiles},errors:{[errorTable]:{message:'PRIVATE database detail'}}});const r=await failed.api.GET(new NextRequest('https://fixture.invalid/api/conversations/users?q=own'));assert.equal(r.status,503);assert.equal('users' in await r.json(),false);}
 const controller=new AbortController();controller.abort();const cancelled=fixture('app/api/conversations/users/route.ts');assert.equal((await cancelled.api.GET(new NextRequest('https://fixture.invalid/api/conversations/users?q=own',{signal:controller.signal}))).status,503);
});
test('block requests set a desired state; toggles and ambiguous acknowledgements cannot silently unblock',async()=>{
 const f=fixture('app/api/blocks/route.ts',{rpcData:{blocked:true,changed:false}});const body={accountId:'actor',blocked_id:'peer',blocked:true};
 assert.equal((await f.api.POST(request(body))).status,200);assert.equal((await f.api.POST(request(body))).status,200);assert.ok(f.calls.every(c=>c.body.p_blocked===true&&c.body.p_actor==='actor'));
 const legacy=fixture('app/api/blocks/route.ts');assert.equal((await legacy.api.POST(request({accountId:'actor',blocked_id:'peer'}))).status,400);assert.equal(legacy.calls.length,0);
 const busy=fixture('app/api/blocks/route.ts',{rpcError:{code:'PT409',message:'PRIVATE'}});assert.equal((await busy.api.POST(request(body))).status,409);
 const failed=fixture('app/api/blocks/route.ts',{rpcData:{blocked:false}});assert.equal((await failed.api.POST(request(body))).status,503);
});

function draftAccess({kind='group',role='member',active=true,receiver='actor',available=true,error=false}={}){
 const reads=[];const db={from(table){const q={select(){return q},eq(...args){reads.push({table,args});return q},is(){return q},maybeSingle:async()=>({data:table==='conversations'?{kind,receiver_id:receiver}:active?{role}:null,error:error?{code:'42P01'}:null})};return q},rpc:async(name,args)=>{reads.push({name,args});return{data:available,error:error?{code:'42P01'}:null}}};
 const actual=load('lib/form-draft-access.ts',{'server-only':{},'@/lib/db':{db},'@/lib/organization-access':{canManageOrganization:async()=>false},'@/lib/listing-access':{canEditListing:async()=>false},'@/lib/company-access':{hasCompanyCapability:async()=>false}});
 return{...actual,reads};
}
test('the real draft authorizer checks current memberships, group admin roles and the exact support recipient',async()=>{
 assert.equal(await draftAccess().canUseFormDraft('actor','message:conversation:'+chat),true);
 assert.equal(await draftAccess({active:false}).canUseFormDraft('actor','message:conversation:'+chat),false);
 assert.equal(await draftAccess().canUseFormDraft('actor','message:group:'+chat),false);
 assert.equal(await draftAccess({role:'admin'}).canUseFormDraft('actor','message:group:'+chat),true);
 assert.equal(await draftAccess({kind:'direct',role:'admin'}).canUseFormDraft('actor','message:group:'+chat),false);
 assert.equal(await draftAccess({kind:'support',receiver:'other-member'}).canUseFormDraft('actor','message:conversation:'+chat),false);
 assert.equal(await draftAccess({kind:'support'}).canUseFormDraft('actor','message:conversation:'+chat),true);
 await assert.rejects(()=>draftAccess({error:true}).canUseFormDraft('actor','message:conversation:'+chat),/unavailable/);
});
test('recipient draft access fails closed for blocks, friends-only denials and service errors, including full-length IDs',async()=>{
 const target='a'.repeat(128),key='message:recipient:'+target;assert.equal(validFormDraftKey(key),true);
 const f=draftAccess();assert.equal(await f.canUseFormDraft('actor',key),true);assert.equal(f.reads[0].args.p_recipient,target);
 assert.equal(await draftAccess({available:false}).canUseFormDraft('actor',key),false);
 await assert.rejects(()=>draftAccess({error:true}).canUseFormDraft('actor',key),/unavailable/);
 for(const k of ['messages:new','booking:'+target,'inquiry:'+chat+':'+target,'message:group:'+chat])assert.equal(validFormDraftKey(k),true,k);
 for(const k of ['message:conversation:foreign','message:recipient:bad.id','message:group:other','message:recipient:'+target+'a'])assert.equal(validFormDraftKey(k),false,k);
});
test('prepared inquiry retries retain exact content and key across locale changes, and new input receives a new key',()=>{
 const first=prepareMessageSend(null,'own-target-and-fields','Own prepared German message');
 assert.deepEqual(prepareMessageSend(restoredSendAttempt(first),'own-target-and-fields','Different translated labels'),first);
 assert.notEqual(prepareMessageSend(first,'different-recipient','Own text').key,first.key);
 assert.notEqual(prepareMessageSend(first,'changed-fields','Changed text').key,first.key);
 assert.equal(restoredSendAttempt({...first,key:'bad'}),null);
});
for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv'])test(locale+': backend privacy and retry failures use the active catalogue',()=>{
 const t=translatorFor(locale,'MessagingBackend');for(const [error,key,status]of[[{code:'42501',message:'PRIVATE'},'contactUnavailable',403],[{code:'PT409',message:'messaging_key_reused'},'keyConflict',409],[{code:'55P03'},'busy',409],[{code:'PT404'},'unavailable',404]]){const mapped=backend.messagingRpcFailure(error);assert.equal(mapped.key,key);assert.equal(mapped.status,status);assert.ok(t(key));}
});
