import test from 'node:test';
import assert from 'node:assert/strict';
import {createInboxPolling} from './inbox-polling.ts';

const identity={userId:'own-test-a',sessionId:'own-session-a'};
const notification={id:'own-notification',type:'friend_request',title:'Own test',body:'Test',href:'/dashboard',read:false,created_at:'2026-10-30T12:00:00Z'};
const json=(body,status=200)=>Response.json(body,{status});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return {promise,resolve}};
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
function fixture(overrides={}){
 const calls=[];let tokenCalls=0;let clock=0;
 const poll=createInboxPolling(identity,async()=>{tokenCalls++;return 'own-synthetic-token'}, {
  now:()=>clock,
  fetch:async(url,init)=>{calls.push({url,init});return json({count:3,notifications:[notification]})},
  ...overrides,
 });
 return {poll,calls,get tokenCalls(){return tokenCalls},advance(ms){clock+=ms}};
}

test('guests make no protected requests and unknown counts are not zero',async()=>{
 let requests=0,tokens=0;const poll=createInboxPolling(null,async()=>{tokens++;return null},{fetch:async()=>{requests++;return json({})}});
 await poll.refresh();assert.equal(poll.getSnapshot().status,'idle');assert.equal(poll.getSnapshot().count,null);assert.equal(requests,0);assert.equal(tokens,0);poll.stop();
});
test('all consumers share one in-flight snapshot request, gated behind the SDK token',async()=>{
 const token=deferred();const calls=[];const poll=createInboxPolling(identity,()=>token.promise,{fetch:async(url,init)=>{calls.push({url,init});return json({count:3,notifications:[notification]})}});
 const first=poll.refresh();assert.equal(poll.refresh(),first);assert.deepEqual(calls,[]);
 token.resolve('own-synthetic-token');await first;
 assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/inbox');assert.equal(poll.getSnapshot().status,'ready');assert.equal(poll.getSnapshot().count,3);
 for(const {init} of calls){assert.equal(init.cache,'no-store');assert.equal(init.credentials,'same-origin');assert.ok(init.headers.Authorization);assert.ok(init.signal)}
 poll.stop();
});
test('401 clears private data and stops every automatic retry until explicit retry',async()=>{
 let rejected=false;const calls=[];let tokenOptions=[];
 const poll=createInboxPolling(identity,async options=>{tokenOptions.push(options);return 'own-synthetic-token'},{fetch:async(url,init)=>{calls.push({url,init});return rejected?json({code:'account'},401):json({count:3,notifications:[notification]})}});
 await poll.refresh();rejected=true;await poll.refresh();assert.equal(poll.getSnapshot().status,'expired');assert.equal(poll.getSnapshot().count,null);assert.deepEqual(poll.getSnapshot().notifications,[]);
 const attempts=calls.length;for(let i=0;i<100;i++)await poll.refresh();assert.equal(calls.length,attempts);assert.equal(await poll.markRead(),false);
 rejected=false;await poll.refresh(true);assert.deepEqual(tokenOptions.at(-1),{skipCache:true});assert.equal(poll.getSnapshot().status,'ready');poll.stop();
});
test('a missing token triggers no HTTP requests and leaves a recoverable expired state',async()=>{
 let requests=0;const poll=createInboxPolling(identity,async()=>null,{fetch:async()=>{requests++;return json({})}});
 await poll.refresh();await poll.refresh();assert.equal(requests,0);assert.equal(poll.getSnapshot().status,'expired');poll.stop();
});
test('network failure is an error, never an empty inbox or a forced logout; retries back off',async()=>{
 let calls=0;let clock=0;let offline=false;
 const poll=createInboxPolling(identity,async()=>{if(offline)throw Error('offline');return 'own-synthetic-token'},{now:()=>clock,fetch:async url=>{calls++;return json({count:4,notifications:[notification]})}});
 await poll.refresh();offline=true;await poll.refresh();assert.equal(poll.getSnapshot().status,'error');assert.equal(poll.getSnapshot().count,4);
 await poll.refresh();assert.equal(calls,1);clock=10_000;offline=false;await poll.refresh();assert.equal(poll.getSnapshot().status,'ready');assert.equal(calls,2);poll.stop();
});
test('timeouts include token retrieval, and never leave the spinner running forever',async()=>{
 const poll=createInboxPolling(identity,()=>new Promise(()=>{}),{timeoutMs:5});await poll.refresh();assert.equal(poll.getSnapshot().status,'error');assert.equal(poll.getSnapshot().count,null);poll.stop();
});
test('logout cancels outstanding requests and a late old-account response cannot return',async()=>{
 const response=deferred();const signals=[];
 const a=createInboxPolling(identity,async()=>'own-synthetic-token',{fetch:async(url,init)=>{signals.push(init.signal);await response.promise;return json({count:8,notifications:[notification]})}});
 const pending=a.refresh();await tick();a.stop();assert.ok(signals.every(signal=>signal.aborted));response.resolve();await pending;
 assert.equal(a.getSnapshot().count,null);assert.deepEqual(a.getSnapshot().notifications,[]);
 const b=fixture();await b.poll.refresh();assert.equal(b.poll.getSnapshot().count,3);assert.equal(a.getSnapshot().status,'idle');b.poll.stop();
});
test('a slow refresh never overlaps with later timer ticks',async()=>{
 const waiting=deferred();const f=fixture({fetch:async url=>{await waiting.promise;return json({count:2,notifications:[]})}});
 const task=f.poll.refresh();for(let i=0;i<30;i++)assert.equal(f.poll.refresh(),task);waiting.resolve();await task;assert.equal(f.tokenCalls,1);f.poll.stop();
});
test('server failure and malformed responses cannot be represented as successful zero',async()=>{
 for(const response of [json({code:'database'},500),json({notifications:[]}),json({count:0,notifications:null})]){
  const f=fixture({fetch:async()=>response.clone()});await f.poll.refresh();assert.equal(f.poll.getSnapshot().status,'error');assert.equal(f.poll.getSnapshot().count,null);f.poll.stop();
 }
 const f=fixture({fetch:async url=>json({count:0,notifications:[]})});await f.poll.refresh();assert.equal(f.poll.getSnapshot().status,'ready');assert.equal(f.poll.getSnapshot().count,0);f.poll.stop();
});
test('read status changes only after confirmed storage and survives a subsequent refresh',async()=>{
 let stored=false;let fail=true;
 const f=fixture({fetch:async(url,init)=>{
  if(init.method){if(fail)return json({code:'failure'},500);stored=true;return json({success:true})}
  return json({count:3,notifications:[{...notification,read:stored}]});
 }});
 await f.poll.refresh();assert.equal(await f.poll.markRead(notification.id),false);assert.equal(f.poll.getSnapshot().notifications[0].read,false);
 fail=false;assert.equal(await f.poll.markRead(notification.id),true);assert.equal(f.poll.getSnapshot().notifications[0].read,true);
 await f.poll.refresh(true);assert.equal(f.poll.getSnapshot().notifications[0].read,true);f.poll.stop();
});
test('a pre-read list response cannot undo a successful read',async()=>{
 let delay=false;const oldResponse=deferred();
 const f=fixture({fetch:async(url,init)=>{
  if(init.method)return json({success:true});
  if(delay)await oldResponse.promise;
  return json({count:3,notifications:[notification]});
 }});
 await f.poll.refresh();delay=true;const pending=f.poll.refresh();await tick();await f.poll.markRead();oldResponse.resolve();await pending;assert.equal(f.poll.getSnapshot().notifications[0].read,true);f.poll.stop();
});

test('a message-read event queues one fresh count after an older request instead of restoring a stale unread badge',async()=>{
 const old=deferred();let count=5;let slow=false;let pairs=0;
 const f=fixture({fetch:async url=>{
  const observed=count;
  if(url==='/api/inbox')pairs++;
  if(slow)await old.promise;
  return json({count:observed,notifications:[]});
 }});
 await f.poll.refresh();slow=true;const pending=f.poll.refresh();await tick();
 count=0;const receipt=f.poll.refreshAfterMessageRead();slow=false;old.resolve();await pending;await receipt;
 assert.equal(f.poll.getSnapshot().count,0);assert.equal(pairs,3);f.poll.stop();
});
