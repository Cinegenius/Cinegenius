import test from 'node:test';
import assert from 'node:assert/strict';
import {pushFixture,pushInstall,pushRevision,pushLease,pushToken} from './native-push-test-fixture.mjs';
const configuration={teamId:'ABCDEFGHIJ',keyId:'KLMNOPQRST',privateKey:'synthetic-key',bundleId:'co.cinegenius.app',environment:'sandbox'};
const ready=()=>({status:'ready',id:pushInstall,lease:pushLease,revision:pushRevision,accountId:'account-a',sessionId:'session-a',deviceToken:pushToken,locale:'en',destination:'messages',expiresAt:new Date(Date.now()+600_000).toISOString(),...{bundleId:configuration.bundleId,environment:configuration.environment},messageText:'PRIVATE_MESSAGE_CANARY',senderName:'PRIVATE_NAME_CANARY'});
function driver({verify='active',second='ready',result={kind:'accepted'}}={}){
 const calls=[],sent=[],order=[];let prepares=0;
 const rpc=async(action,_actor,_session,input)=>{calls.push({action,input});order.push(action);if(action==='claim')return{status:'ok',jobs:[{id:pushInstall,lease:pushLease}]};if(action==='prepare'){prepares++;return prepares===2&&second!=='ready'?{status:second}:ready();}return{status:'ok'};};
 return{calls,sent,order,dependencies:{configuration,rpc,verifySession:async(user,session)=>{assert.equal(user,'account-a');assert.equal(session,'session-a');order.push('verify');return verify;},body:async()=>{order.push('copy');return'You have a new message.';},send:async delivery=>{sent.push(delivery);order.push('send');return result;}}};
}

test('default-disabled worker cannot touch database, identity provider or APNs',async()=>{
 const f=pushFixture(),worker=f.load('lib/native-push-worker.ts');const result=await worker.runNativePushWorker({configuration:null,rpc:()=>assert.fail('no database'),send:()=>assert.fail('no provider')});assert.equal(result.status,'disabled');assert.equal(result.accepted,0);
});

test('worker rechecks live session then current membership/read/registration immediately before generic APNs send',async()=>{
 const f=pushFixture(),worker=f.load('lib/native-push-worker.ts'),d=driver(),result=await worker.runNativePushWorker(d.dependencies);assert.equal(result.accepted,1);assert.deepEqual(d.order.slice(0,8),['worker_heartbeat','claim','prepare','verify','copy','prepare','send','finish']);
 assert.equal(d.sent.length,1);assert.equal(d.sent[0].id,pushInstall);assert.equal(d.sent[0].destination,'messages');assert.equal(d.sent[0].body,'You have a new message.');assert.doesNotMatch(JSON.stringify(d.sent),/PRIVATE_MESSAGE|PRIVATE_NAME|\/messages\?/);
 assert.equal(d.calls.find(call=>call.action==='finish').input.outcome,'accepted');assert.equal('delivered'in result,false);
});

test('revoked or temporarily unverifiable Clerk sessions never send; only revoked may deactivate',async()=>{
 const worker=pushFixture().load('lib/native-push-worker.ts');for(const verify of ['revoked','unavailable']){const d=driver({verify});await worker.runNativePushWorker(d.dependencies);assert.equal(d.sent.length,0);assert.equal(d.calls.find(call=>call.action==='finish').input.outcome,verify==='revoked'?'revoked':'retry');}
});

test('read/membership/revision changes at the last check cancel before provider contact',async()=>{
 const worker=pushFixture().load('lib/native-push-worker.ts'),d=driver({second:'cancelled'});const result=await worker.runNativePushWorker(d.dependencies);assert.equal(result.cancelled,1);assert.equal(d.sent.length,0);
});

for(const checkpoint of [1,2])test(`temporary readiness loss at prepare ${checkpoint} counts as retry without provider contact or false cancellation`,async()=>{
 const worker=pushFixture().load('lib/native-push-worker.ts'),d=driver();let prepares=0;const original=d.dependencies.rpc;
 d.dependencies.rpc=async(...args)=>{const value=await original(...args);return args[0]==='prepare'&&++prepares===checkpoint?{status:'deferred'}:value;};
 const result=await worker.runNativePushWorker(d.dependencies);
 assert.equal(result.retry,1);assert.equal(result.cancelled,0);assert.equal(result.accepted,0);assert.equal(d.sent.length,0);
 assert.equal(d.calls.some(call=>call.action==='finish'),false,'SQL has already released the lease for recovery');
});

test('provider retry/invalid-device outcomes are forwarded with bounded technical values only',async()=>{
 const worker=pushFixture().load('lib/native-push-worker.ts');for(const result of [{kind:'retry',retryAfterMs:900_000},{kind:'invalid-device',invalidSince:Date.now()-1000},{kind:'configuration'}]){const d=driver({result});await worker.runNativePushWorker(d.dependencies);const input=d.calls.find(call=>call.action==='finish').input;assert.equal(input.outcome,result.kind);assert.equal(input.deviceToken,undefined);assert.equal(input.messageText,undefined);}
});

test('after scheduling returns immediately and push failures cannot roll back the confirmed message',async()=>{
 const f=pushFixture(),worker=f.load('lib/native-push-worker.ts');let runs=0;
 worker.scheduleNativePushAfterCommit(()=>assert.fail('disabled has no callback'),async()=>{runs++;},false);assert.equal(runs,0);
 worker.scheduleNativePushAfterCommit(callback=>f.scheduled.push(callback),async()=>{runs++;throw Error('PRIVATE_PROVIDER_CANARY');},true);assert.equal(runs,0);assert.equal(f.scheduled.length,1);await assert.doesNotReject(f.scheduled[0]());assert.equal(runs,1);
 assert.doesNotThrow(()=>worker.scheduleNativePushAfterCommit(()=>{throw Error('no after context');},async()=>{},true));
});

test('internal worker is POST-only and timing-safe secret-gated, without error leaks',async()=>{
 const f=pushFixture(),route=f.load('app/api/internal/push-worker/route.ts');assert.equal(route.GET().status,405);assert.equal(route.HEAD().status,405);
 assert.equal((await route.POST(new Request('https://own.invalid/api/internal/push-worker',{method:'POST',headers:{authorization:'Bearer wrong'}}))).status,401);assert.equal(f.calls.length,0);
 const result=await route.POST(new Request('https://own.invalid/api/internal/push-worker',{method:'POST',headers:{authorization:'Bearer own-worker-secret'}}));assert.equal(result.status,200);const j=await result.json();assert.equal(j.status,'disabled');assert.doesNotMatch(JSON.stringify(j),/Token|Proof|session-a|account-a/);
});
