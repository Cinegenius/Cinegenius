import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pushFixture,pushInstall,pushRevision,pushProof,pushToken} from './native-push-test-fixture.mjs';
import {readPushRegistration,isPushInstallationProof,isPushDeviceToken,NATIVE_PUSH_CONTRACT} from './native-push.ts';
import {messagesFor,translatorFor} from './i18n-test-fixture.mjs';
import {SUPPORTED_LOCALES} from './i18n/locales.ts';
const body=()=>({expectedRevision:null,deviceToken:pushToken,authorization:'authorized',environment:'sandbox',locale:'en',preferences:{messages:true,notices:false}});
const enabled={NATIVE_PUSH_ENABLED:'true',APNS_ENVIRONMENT:'sandbox',APNS_TEAM_ID:'ABCDEFGHIJ',APNS_KEY_ID:'KLMNOPQRST',APNS_PRIVATE_KEY:'synthetic-key',APNS_BUNDLE_ID:'co.cinegenius.app'};
const noPrivate=value=>assert.doesNotMatch(JSON.stringify(value),new RegExp(pushToken+'|'+pushProof+'|synthetic-key|session-a'));

test('wire requires explicit OS authorization, canonical proof and exact preference/body shape',()=>{
 assert.equal(isPushInstallationProof(pushProof),true);assert.equal(isPushInstallationProof('x'.repeat(43)),false);assert.equal(isPushDeviceToken('ab'.repeat(200)),true);assert.equal(readPushRegistration(body()).deviceToken,pushToken);
 for(const change of [{authorization:'provisional'},{authorization:'denied'},{userId:'victim'},{expectedRevision:undefined},{deviceToken:'<svg>'},{preferences:{messages:true}},{locale:'unsupported'}])assert.equal(readPushRegistration({...body(),...change}),null);
});

test('capabilities remain disabled without explicit configuration and invalid keys fail closed',async()=>{
 for(const options of [{},{env:enabled,invalidKey:true}]){const f=pushFixture(options),api=f.load('lib/native-push-server.ts'),r=await api.nativePushRoute(f.request(),'capabilities');assert.equal(r.status,200);const j=await r.json();assert.deepEqual(j.capabilities,{register:false,dispatch:false});assert.equal(j.server,null);noPrivate(j);}
});

test('registration binds current Clerk user/session and stores proof hash, never proof/token in an ACK',async()=>{
 const f=pushFixture({env:enabled}),api=f.load('lib/native-push-server.ts'),r=await api.nativePushRoute(f.request(body()),'register',pushInstall);assert.equal(r.status,200);const j=await r.json();assert.equal(j.contract,NATIVE_PUSH_CONTRACT);assert.equal(j.accountId,'account-a');assert.equal(j.revision,pushRevision);assert.equal(j.binding,'own');noPrivate(j);
 const call=f.calls.find(x=>x.p_action==='register');assert.equal(call.p_actor,'account-a');assert.equal(call.p_session,'session-a');assert.equal(call.p.proofHash,createHash('sha256').update(pushProof).digest('hex'));assert.equal(call.p.deviceToken,pushToken);assert.equal(f.sessions.length,1);assert.match(r.headers.get('cache-control'),/no-store/);
});

test('revoked/mismatched Clerk sessions and wrong account/origin/proof cannot register',async()=>{
 for(const [options,overrides,status]of [[{actor:null},{},401],[{sessionStatus:'revoked'},{},401],[{session:{userId:'other'}},{},401],[{sessionError:{status:503}},{},503],[{},{headers:{'X-Push-Account':'other'}},409],[{},{headers:{Origin:'https://hostile.invalid'}},403],[{},{headers:{'X-Push-Installation-Proof':'not-proof'}},400]]){
  const f=pushFixture({env:enabled,...options}),api=f.load('lib/native-push-server.ts'),original=f.request(body()),headers=new Headers(original.headers);for(const[k,v]of Object.entries(overrides.headers??{}))headers.set(k,v);
  const r=await api.nativePushRoute(new Request(original,{headers}),'register',pushInstall);assert.equal(r.status,status);assert.equal(f.calls.filter(x=>x.p_action==='register').length,0);noPrivate(await r.json());
 }
});

test('foreign binding returns only opaque revision; wrong proof is a closed404',async()=>{
 const f=pushFixture({env:enabled,rpc:async action=>action==='capabilities'?{status:'ok',register:true,dispatch:true}:{status:'ok',installationId:pushInstall,revision:pushRevision,binding:'different-account',preferences:{messages:true,notices:true},locale:'de',deviceToken:pushToken,proof:pushProof,userId:'FOREIGN_OWNER_CANARY'}}),api=f.load('lib/native-push-server.ts');const j=await(await api.nativePushRoute(f.request(),'view',pushInstall)).json();assert.equal(j.binding,'different-account');assert.equal(j.preferences,undefined);assert.equal(j.locale,undefined);assert.doesNotMatch(JSON.stringify(j),/FOREIGN_OWNER|deviceToken/);noPrivate(j);
 const bad=pushFixture({rpc:async action=>action==='capabilities'?{status:'ok',register:false,dispatch:false}:{status:'missing'}}),closed=await bad.load('lib/native-push-server.ts').nativePushRoute(bad.request(),'view',pushInstall);assert.equal(closed.status,404);assert.equal((await closed.json()).revision,undefined);
});

test('revoke remains usable with provider disabled; oversized bodies never reach mutation RPC',async()=>{
 const f=pushFixture(),api=f.load('lib/native-push-server.ts');let r=await api.nativePushRoute(f.request({expectedRevision:pushRevision},{method:'DELETE'}),'revoke',pushInstall);assert.equal(r.status,200);assert.equal((await r.json()).revoked,true);
 r=await api.nativePushRoute(f.request({...body(),deviceToken:'ab'.repeat(3000)}),'register',pushInstall);assert.equal(r.status,400);assert.equal(f.calls.filter(x=>x.p_action==='register').length,0);
});

for(const locale of SUPPORTED_LOCALES)test(`generic push copy is complete and has no private-template placeholders: ${locale}`,()=>{
 const copy=messagesFor(locale).PushNotifications;assert.equal(Object.keys(copy).length,22);const t=translatorFor(locale,'PushNotifications');for(const key of Object.keys(copy))assert.ok(t(key).trim());for(const key of ['messageBody','noticeBody']){assert.ok(copy[key].length<=512);assert.doesNotMatch(copy[key],/[{}]|https?:|\/messages|\/notifications/);}
});

test('register ACK must match exact own preferences; CAS conflict never discloses a fresh revision',async()=>{
 for(const mode of ['wrong-preferences','conflict']){
  const f=pushFixture({env:enabled,rpc:async action=>action==='capabilities'?{status:'ok',register:true,dispatch:true}:mode==='conflict'?{status:'conflict',revision:pushRevision,deviceToken:pushToken}:{status:'ok',installationId:pushInstall,revision:pushRevision,binding:'own',preferences:{messages:false,notices:false},locale:'en'}}),api=f.load('lib/native-push-server.ts');
  const r=await api.nativePushRoute(f.request(body()),'register',pushInstall);assert.equal(r.status,mode==='conflict'?409:503);const j=await r.json();assert.equal(j.revision,undefined);noPrivate(j);
 }
});
