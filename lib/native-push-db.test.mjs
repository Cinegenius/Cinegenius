import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
let pg;
const config={bundleId:'co.cinegenius.app',environment:'sandbox'};
const hash=value=>createHash('sha256').update(value).digest('hex');
before(async()=>{pg=new PGlite();await pg.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text,type text,read boolean DEFAULT false,created_at timestamptz DEFAULT clock_timestamp());
 CREATE TABLE messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid,sender_id text,created_at timestamptz DEFAULT clock_timestamp());
 CREATE TABLE conversation_members(conversation_id uuid,user_id text,joined_at timestamptz DEFAULT clock_timestamp(),left_at timestamptz,PRIMARY KEY(conversation_id,user_id));
 CREATE TABLE message_reads(message_id uuid,user_id text,read_at timestamptz DEFAULT clock_timestamp(),PRIMARY KEY(message_id,user_id));
 CREATE TABLE blocks(blocker_id text,blocked_id text);`);await pg.exec(readFileSync('supabase/migrations/20261118233739_native_push_v1.sql','utf8'));});
after(async()=>{await pg?.close();});
async function rpc(action,actor=null,session=null,input={}){return(await pg.query('SELECT public.native_push_v1($1,$2,$3,$4::jsonb) value',[action,actor,session,JSON.stringify({...config,...input})])).rows[0].value;}
async function tx(work){await pg.exec('BEGIN');try{await work();}finally{await pg.exec('ROLLBACK');await pg.exec('RESET ROLE');}}
async function denied(work){await pg.exec('SAVEPOINT own_denied');await assert.rejects(work,/permission denied/);await pg.exec('ROLLBACK TO own_denied');}
async function ready(){await pg.query("UPDATE native_push_private.settings SET enabled=true,bundle_id=$1,environment=$2",[config.bundleId,config.environment]);assert.equal((await rpc('worker_heartbeat')).status,'ok');}
function input(id=randomUUID(),changes={}){const token=id.replaceAll('-','').repeat(2);return{installationId:id,proofHash:hash('proof:'+id),expectedRevision:null,deviceToken:token,tokenHash:hash(token),locale:'en',messages:true,notices:true,...changes};}
async function register(actor='alice',session='session-alice',value=input()){const result=await rpc('register',actor,session,value);assert.equal(result.status,'ok');return{value,result};}
async function notice(user='alice',changes={}){const id=randomUUID();await pg.query('INSERT INTO notifications(id,user_id,type,read,created_at)VALUES($1,$2,$3,$4,coalesce($5::timestamptz,clock_timestamp()))',[id,user,changes.type??'booking_request',changes.read??false,changes.createdAt??null]);return id;}
async function claim(){return(await rpc('claim')).jobs;}
async function prepare(job){return rpc('prepare',null,null,job);}
async function memberMessage(){const conversation=randomUUID();await pg.query("INSERT INTO conversation_members(conversation_id,user_id,joined_at)VALUES($1,'sender',clock_timestamp()-interval '1 hour'),($1,'alice',clock_timestamp()-interval '1 hour')",[conversation]);const id=randomUUID();await pg.query("INSERT INTO messages(id,conversation_id,sender_id)VALUES($1,$2,'sender')",[id,conversation]);return{id,conversation};}

test('migration is disabled, service-only and creates no historical deliveries',()=>tx(async()=>{
 assert.deepEqual(await rpc('capabilities'),{status:'ok',register:false,dispatch:false});assert.equal((await rpc('register','alice','session-a',input())).status,'unavailable');
 await notice();assert.equal((await pg.query('SELECT count(*) n FROM native_push_private.deliveries')).rows[0].n,0);
 for(const role of ['anon','authenticated']){await pg.exec('SET ROLE '+role);await denied(()=>pg.exec('SELECT * FROM native_push_private.installations'));await denied(()=>rpc('capabilities'));await pg.exec('RESET ROLE');}
}));

test('proof and CAS protect account transfer, repeat registration and old deletes without token disclosures',()=>tx(async()=>{
 await ready();const a=await register();const own=await rpc('view','alice','session-alice',a.value);assert.equal(own.binding,'own');assert.equal(own.revision,a.result.revision);assert.doesNotMatch(JSON.stringify(own),/deviceToken|proofHash|session-alice/);
 assert.deepEqual(await rpc('view','bob','session-bob',{...a.value,proofHash:hash('wrong')}),{status:'missing'});
 const foreign=await rpc('view','bob','session-bob',a.value);assert.equal(foreign.binding,'different-account');assert.equal(foreign.preferences,undefined);assert.equal(foreign.locale,undefined);
 const next={...a.value,expectedRevision:a.result.revision};assert.equal((await rpc('register','alice','session-alice',next)).revision,a.result.revision);
 const b=await rpc('register','bob','session-bob',next);assert.equal(b.binding,'own');assert.notEqual(b.revision,a.result.revision);
 assert.equal((await rpc('register','alice','session-alice',next)).status,'conflict');assert.equal((await rpc('revoke','alice','session-alice',next)).status,'conflict');
 assert.equal((await pg.query('SELECT user_id FROM native_push_private.installations WHERE id=$1',[a.value.installationId])).rows[0].user_id,'bob');
}));

test('revoke erases token/account, is repeatable and closes late first registration',()=>tx(async()=>{
 const initial=input(),closed=await rpc('revoke','alice','session-alice',initial);assert.equal(closed.revoked,true);await ready();assert.equal((await rpc('register','alice','session-alice',initial)).status,'conflict');
 const a=await register();const gone=await rpc('revoke','alice','session-alice',{...a.value,expectedRevision:a.result.revision});assert.equal(gone.revoked,true);
 const row=(await pg.query('SELECT * FROM native_push_private.installations WHERE id=$1',[a.value.installationId])).rows[0];for(const key of ['device_token','token_hash','user_id','session_id','locale'])assert.equal(row[key],null);
 assert.equal((await rpc('revoke','alice','session-alice',{...a.value,expectedRevision:gone.revision})).revision,gone.revision);
}));

test('notification enqueue is transactional, opt-in only, no backfill/duplicate message notices/read ACK events',()=>tx(async()=>{
 await notice();await ready();const a=await register('alice','session-alice',input(undefined,{messages:true,notices:false}));await notice();assert.equal((await claim()).length,0);
 await rpc('register','alice','session-alice',{...a.value,expectedRevision:a.result.revision,notices:true});
 await pg.exec('SAVEPOINT own_notice');await notice();assert.equal((await pg.query('SELECT count(*) n FROM native_push_private.deliveries')).rows[0].n,1);await pg.exec('ROLLBACK TO own_notice');
 await notice('alice',{type:'new_message'});await notice('alice',{read:true});assert.equal((await claim()).length,0);
 const id=await notice();await pg.query('UPDATE notifications SET read=true WHERE id=$1',[id]);const jobs=await claim();assert.equal(jobs.length,1);assert.equal((await prepare(jobs[0])).status,'cancelled');assert.equal((await claim()).length,0);
}));

test('message trigger uses real members and transaction rollback without synthetic Inbox notices',()=>tx(async()=>{
 await ready();await register();const {id}=await memberMessage();const jobs=await claim();assert.equal(jobs.length,1);assert.equal((await prepare(jobs[0])).destination,'messages');
 assert.equal((await pg.query('SELECT count(*) n FROM notifications')).rows[0].n,0);assert.equal((await pg.query('SELECT source_id FROM native_push_private.deliveries')).rows[0].source_id,id);
 await pg.exec('SAVEPOINT own_message');await memberMessage();assert.equal((await pg.query('SELECT count(*) n FROM native_push_private.deliveries')).rows[0].n,2);await pg.exec('ROLLBACK TO own_message');assert.equal((await pg.query('SELECT count(*) n FROM native_push_private.deliveries')).rows[0].n,1);
}));

for(const outage of ['stale-heartbeat','missing-heartbeat','provider-cooldown'])test(`committed events remain durable through ${outage} without historical backfill`,()=>tx(async()=>{
 const beforeActivation=await notice();await ready();await register();
 if(outage==='stale-heartbeat')await pg.exec("UPDATE native_push_private.settings SET worker_at=clock_timestamp()-interval '6 minutes'");
 if(outage==='missing-heartbeat')await pg.exec('UPDATE native_push_private.settings SET worker_at=NULL');
 if(outage==='provider-cooldown')await pg.exec('UPDATE native_push_private.settings SET provider_failure_at=clock_timestamp()');
 const historical=await notice('alice',{createdAt:new Date(Date.now()-3600000).toISOString()});
 const notification=await notice(),message=await memberMessage();
 const pending=(await pg.query('SELECT source_kind,source_id,state,attempts FROM native_push_private.deliveries ORDER BY source_kind')).rows;
 assert.deepEqual(pending,[{source_kind:'message',source_id:message.id,state:'pending',attempts:0},{source_kind:'notification',source_id:notification,state:'pending',attempts:0}]);
 assert.equal((await rpc('capabilities')).dispatch,false);assert.deepEqual(await claim(),[]);
 assert.equal((await pg.query("SELECT count(*) n FROM native_push_private.deliveries WHERE state='pending' AND attempts=0")).rows[0].n,2);
 assert.equal((await rpc('worker_heartbeat')).status,'ok');
 if(outage==='provider-cooldown'){
  assert.deepEqual(await claim(),[],'a heartbeat does not bypass provider cooldown');
  await pg.exec("UPDATE native_push_private.settings SET provider_failure_at=clock_timestamp()-interval '16 minutes'");
 }
 const recovered=await claim();assert.equal(recovered.length,2);
 const destinations=[];for(const job of recovered){const allowed=await prepare(job);assert.equal(allowed.status,'ready');destinations.push(allowed.destination);}
 assert.deepEqual(destinations.sort(),['messages','notifications']);
 assert.equal((await pg.query('SELECT count(*) n FROM native_push_private.deliveries WHERE source_id IN($1,$2)',[beforeActivation,historical])).rows[0].n,0,'recovery never backfills historical sources');
 assert.equal((await pg.query('SELECT count(*) n FROM native_push_private.deliveries')).rows[0].n,2);
}));

test('provider cooldown defers an already leased valid second job and resumes both jobs after recovery',()=>tx(async()=>{
 await ready();await register();await notice();await notice();const jobs=await claim();assert.equal(jobs.length,2);
 assert.equal((await prepare(jobs[0])).status,'ready');
 assert.equal((await rpc('finish',null,null,{...jobs[0],outcome:'configuration'})).status,'ok');
 assert.deepEqual(await prepare(jobs[1]),{status:'deferred'});
 assert.deepEqual((await pg.query("SELECT state,lease,lease_until FROM native_push_private.deliveries WHERE id=$1",[jobs[1].id])).rows[0],{state:'pending',lease:null,lease_until:null});
 assert.deepEqual(await claim(),[],'no new dispatch permission during provider cooldown');
 assert.equal((await rpc('finish',null,null,{...jobs[1],outcome:'accepted'})).status,'stale','released lease cannot acknowledge an old dispatch');
 await pg.exec("UPDATE native_push_private.settings SET provider_failure_at=clock_timestamp()-interval '16 minutes';UPDATE native_push_private.deliveries SET due_at=clock_timestamp()-interval '1 second'");
 assert.equal((await rpc('worker_heartbeat')).status,'ok');const resumed=await claim();assert.equal(resumed.length,2);
 for(const job of resumed){assert.equal((await prepare(job)).status,'ready');assert.equal((await rpc('finish',null,null,{...job,outcome:'accepted'})).status,'ok');}
 assert.equal((await pg.query("SELECT count(*) n FROM native_push_private.deliveries WHERE state='accepted'")).rows[0].n,2);
}));

for(const reason of ['read','expired'])test(`permanent ${reason} is still cancelled during temporary worker unavailability`,()=>tx(async()=>{
 await ready();await register();const id=await notice(),job=(await claim())[0];
 if(reason==='read')await pg.query('UPDATE notifications SET read=true WHERE id=$1',[id]);
 if(reason==='expired')await pg.query("UPDATE native_push_private.deliveries SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[job.id]);
 await pg.exec('UPDATE native_push_private.settings SET worker_at=NULL');
 assert.equal((await prepare(job)).status,'cancelled');
 assert.equal((await pg.query('SELECT state FROM native_push_private.deliveries WHERE id=$1',[job.id])).rows[0].state,'cancelled');
}));

for(const reason of ['read','removed','late-join','block-from','block-to','message-deleted'])test(`message is checked immediately before dispatch: ${reason}`,()=>tx(async()=>{
 await ready();await register();const value=await memberMessage(),job=(await claim())[0];assert.equal((await prepare(job)).status,'ready');
 if(reason==='read')await pg.query("INSERT INTO message_reads(message_id,user_id)VALUES($1,'alice')",[value.id]);
 if(reason==='removed')await pg.query("UPDATE conversation_members SET left_at=clock_timestamp() WHERE user_id='alice' AND conversation_id=$1",[value.conversation]);
 if(reason==='late-join')await pg.query("UPDATE conversation_members SET joined_at=clock_timestamp()+interval '1 second' WHERE user_id='alice' AND conversation_id=$1",[value.conversation]);
 if(reason==='block-from')await pg.exec("INSERT INTO blocks VALUES('sender','alice')");if(reason==='block-to')await pg.exec("INSERT INTO blocks VALUES('alice','sender')");if(reason==='message-deleted')await pg.query('DELETE FROM messages WHERE id=$1',[value.id]);
 assert.equal((await prepare(job)).status,'cancelled');
}));

test('leases and backoff prevent duplicate claims; stale APNs failures cannot disable a fresh account binding',()=>tx(async()=>{
 await ready();const a=await register();await notice();const job=(await claim())[0];assert.deepEqual(await claim(),[]);
 assert.equal((await rpc('finish',null,null,{...job,outcome:'retry',retryAfterMs:900000})).status,'ok');assert.deepEqual(await claim(),[]);
 await pg.exec("UPDATE native_push_private.deliveries SET due_at=clock_timestamp()-interval '1 second'");const next=(await claim())[0];assert.notEqual(next.lease,job.lease);assert.equal((await rpc('finish',null,null,{...job,outcome:'accepted'})).status,'stale');
 const b=await rpc('register','bob','session-bob',{...a.value,expectedRevision:a.result.revision});assert.notEqual(b.revision,a.result.revision);
 assert.equal((await rpc('finish',null,null,{...next,outcome:'invalid-device'})).status,'stale');assert.equal((await pg.query('SELECT active,user_id FROM native_push_private.installations WHERE id=$1',[a.value.installationId])).rows[0].user_id,'bob');
}));

test('410 timestamp protects a newer binding; current400 only invalidates that unchanged registration',()=>tx(async()=>{
 await ready();const a=await register();await notice();let job=(await claim())[0];await rpc('finish',null,null,{...job,outcome:'invalid-device',invalidSince:Date.now()-3600000});assert.equal((await pg.query('SELECT active FROM native_push_private.installations WHERE id=$1',[a.value.installationId])).rows[0].active,true);
 await notice();job=(await claim())[0];await rpc('finish',null,null,{...job,outcome:'invalid-device'});assert.equal((await pg.query('SELECT active FROM native_push_private.installations WHERE id=$1',[a.value.installationId])).rows[0].active,false);
}));

test('separate message opt-in, sender exclusion and late joins prevent unintended recipients',()=>tx(async()=>{
 await ready();const a=await register('alice','session-alice',input(undefined,{messages:false,notices:true}));await register('sender','session-sender');await memberMessage();assert.equal((await claim()).length,0,'sender never receives own push and recipient opted out');
 await rpc('register','alice','session-alice',{...a.value,expectedRevision:a.result.revision,messages:true});const {id}=await memberMessage();assert.equal((await claim()).length,1);
 await pg.query("INSERT INTO messages(id,conversation_id,sender_id)SELECT id,conversation_id,sender_id FROM messages WHERE id=$1 ON CONFLICT(id)DO NOTHING",[id]);assert.equal((await pg.query('SELECT count(*) n FROM native_push_private.deliveries')).rows[0].n,1,'message replay creates no second queue entry');
}));

test('expired work and missing worker readiness never dispatch or admit fresh registrations',()=>tx(async()=>{
 await ready();const a=await register();await notice();await pg.exec("UPDATE native_push_private.deliveries SET expires_at=clock_timestamp()-interval '1 second'");assert.deepEqual(await claim(),[]);
 await pg.exec("UPDATE native_push_private.settings SET worker_at=clock_timestamp()-interval '6 minutes'");assert.equal((await rpc('capabilities')).register,false);assert.equal((await rpc('register','alice','session-alice',{...a.value,expectedRevision:a.result.revision})).status,'unavailable');
}));

test('same account with a new session inherits no opt-ins and old-session requests lose after deliberate rebinding',()=>tx(async()=>{
 await ready();const a=await register();const view=await rpc('view','alice','session-new',a.value);assert.equal(view.binding,'absent');assert.equal(view.preferences,undefined);assert.equal(view.revision,a.result.revision);
 const b=await rpc('register','alice','session-new',{...a.value,expectedRevision:view.revision});assert.equal(b.binding,'own');assert.notEqual(b.revision,a.result.revision);
 assert.equal((await rpc('revoke','alice','session-alice',{...a.value,expectedRevision:a.result.revision})).status,'conflict');
}));
