import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
let pg;
const migration=readdirSync('supabase/migrations').find(n=>n.endsWith('_shots_ephemeral_v1.sql'));
before(async()=>{pg=new PGlite();await pg.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA storage;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated,service_role;GRANT SELECT ON storage.buckets TO service_role;
 CREATE POLICY fixture_legacy_permissive ON storage.objects FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);
 CREATE TABLE public.user_settings(user_id text PRIMARY KEY,ghost_mode boolean DEFAULT false);
 CREATE TABLE public.blocks(blocker_id text,blocked_id text);
 CREATE TABLE public.friendships(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sender_id text,receiver_id text,status text,sender_favorite boolean DEFAULT false,receiver_favorite boolean DEFAULT false);
 GRANT SELECT ON public.user_settings,public.blocks,public.friendships TO service_role;`);await pg.exec(readFileSync('supabase/migrations/'+migration,'utf8'))});
after(async()=>pg?.close());
const tx=async run=>{await pg.exec('BEGIN');try{await run()}finally{await pg.exec('ROLLBACK')}};
const rpc=async(action,actor='alice',p={})=>(await pg.query('SELECT public.shots_v1($1,$2,$3::jsonb) result',[action,actor,JSON.stringify(p.requestId?{...p,requestScope:createHash('sha256').update(JSON.stringify([actor,p.requestId.toLowerCase()])).digest('hex')}:p)])).rows[0].result;
const denied=async(run,pattern)=>{await pg.exec('SAVEPOINT denied');try{await assert.rejects(run,pattern)}finally{await pg.exec('ROLLBACK TO SAVEPOINT denied');await pg.exec('RELEASE SAVEPOINT denied')}};
const ready=async()=>pg.exec("UPDATE shots_private.config SET enabled=true,cleanup_ready=true,worker_seen_at=clock_timestamp()");
const payload=(extra={})=>({requestId:randomUUID(),payloadHash:'a'.repeat(64),audience:'community',format:'portrait',look:'bw',grain:45,width:800,height:600,assets:[{variant:'full',bytes:100,sha256:'a'.repeat(64)},{variant:'thumbnail',bytes:50,sha256:'b'.repeat(64)}],...extra});
async function publish(owner='alice',extra={}){const input=payload(extra),p=await rpc('prepare',owner,input);assert.equal(p.status,'prepared');for(const a of p.assets)assert.equal((await rpc('uploaded',owner,{id:p.id,token:p.token,variant:a.variant,sha256:a.sha256})).status,'ok');const result=await rpc('publish',owner,{id:p.id,token:p.token});assert.equal(result.status,'published');return{...result,input,token:p.token,id:p.id}}
async function expire(id){await pg.query("UPDATE shots_private.shots SET published_at=now()-interval '30 hours 1 second',expires_at=now()-interval '1 second' WHERE id=$1",[id]);await pg.query("UPDATE shots_private.cleanup SET due_at=clock_timestamp()-interval '1 second' WHERE shot_id=$1",[id])}

test('default capability is off and direct database/storage roles cannot read or write Shots',()=>tx(async()=>{
 assert.equal((await rpc('feed','alice',{audience:'community'})).status,'unavailable');
 assert.equal((await pg.query("SELECT public FROM storage.buckets WHERE id='shots-ephemeral-v1'")).rows[0].public,false);
 await pg.exec("INSERT INTO storage.objects(bucket_id,name)VALUES('shots-ephemeral-v1','private.webp'),('other','ordinary.webp')");
 for(const role of ['anon','authenticated']){await pg.exec('SET ROLE '+role);await denied(()=>pg.exec('SELECT * FROM shots_private.shots'),/permission denied/);await denied(()=>rpc('feed','alice',{audience:'community'}),/permission denied/);const rows=(await pg.query('SELECT bucket_id FROM storage.objects')).rows;assert.deepEqual(rows,[{bucket_id:'other'}]);await denied(()=>pg.exec("INSERT INTO storage.objects(bucket_id,name)VALUES('shots-ephemeral-v1','forged.webp')"),/row-level security/);await pg.exec('RESET ROLE')}
}));
test('publish starts exactly30h at confirmed publication and repeats never extend or duplicate it',()=>tx(async()=>{
 await ready();const shot=await publish();assert.equal(Date.parse(shot.item.expiresAt)-Date.parse(shot.item.createdAt),30*60*60*1000);
 const repeated=await rpc('prepare','alice',shot.input);assert.equal(repeated.status,'published');assert.equal(repeated.item.expiresAt,shot.item.expiresAt);assert.equal((await pg.query('SELECT count(*) n FROM shots_private.shots')).rows[0].n,1);
 const conflicting=await rpc('prepare','alice',{...shot.input,payloadHash:'c'.repeat(64)});assert.equal(conflicting.status,'conflict');assert.equal((await rpc('prepare','bob',shot.input)).status,'conflict');
 assert.equal((await rpc('request','bob',{requestId:shot.input.requestId})).status,'absent');
}));
test('Homies uses author-side currentlyaccepted stars and honors removal, blocks, Ghost and no recipient leaks',()=>tx(async()=>{
 await ready();const shot=await publish('alice',{audience:'homies'});
 assert.equal((await rpc('get','bob',{id:shot.id})).status,'missing');
 await pg.exec("INSERT INTO friendships(sender_id,receiver_id,status,sender_favorite,receiver_favorite)VALUES('bob','alice','accepted',true,false)");assert.equal((await rpc('get','bob',{id:shot.id})).status,'missing','viewerfavorite is notauthorgrant');
 await pg.exec("UPDATE friendships SET receiver_favorite=true");let result=await rpc('get','bob',{id:shot.id});assert.equal(result.status,'ok');assert.equal(result.item.requestId,null);assert.equal(result.item.isMine,false);assert.doesNotMatch(JSON.stringify(result),/owner_id|sender_favorite|receiver_favorite|alice/);
 await pg.exec("UPDATE friendships SET status='pending'");assert.equal((await rpc('get','bob',{id:shot.id})).status,'missing');await pg.exec("UPDATE friendships SET status='accepted'");
 for(const [a,b]of[['alice','bob'],['bob','alice']]){await pg.query('INSERT INTO blocks VALUES($1,$2)',[a,b]);assert.equal((await rpc('get','bob',{id:shot.id})).status,'missing');await pg.exec('DELETE FROM blocks')}
 await pg.exec("INSERT INTO user_settings(user_id,ghost_mode)VALUES('alice',true)");assert.equal((await rpc('get','bob',{id:shot.id})).status,'missing');assert.equal((await rpc('get','alice',{id:shot.id})).status,'ok');
}));
test('hard expiry denies everybody including owner and every media variant before cleanup',()=>tx(async()=>{
 await ready();const shot=await publish();await expire(shot.id);
 for(const actor of ['alice','bob']){assert.equal((await rpc('get',actor,{id:shot.id})).status,'missing');for(const variant of ['full','thumbnail'])assert.equal((await rpc('media',actor,{id:shot.id,variant})).status,'missing');assert.deepEqual((await rpc('feed',actor,{audience:'community'})).items,[])}
 assert.equal((await rpc('request','alice',{requestId:shot.input.requestId})).status,'expired');assert.ok(['expired','unavailable'].includes((await rpc('prepare','alice',shot.input)).status));
}));
test('owner deletion is immediately denied, never deletes a foreignShot, and retries are harmless',()=>tx(async()=>{
 await ready();const shot=await publish();assert.equal((await rpc('delete','bob',{id:shot.id})).status,'missing');assert.equal((await rpc('get','bob',{id:shot.id})).status,'ok');
 assert.equal((await rpc('delete','alice',{id:shot.id})).purgePending,true);assert.equal((await rpc('get','alice',{id:shot.id})).status,'missing');assert.equal((await rpc('delete','alice',{id:shot.id})).status,'deleted');
}));
test('cleanup needs exact object ACKs, survives crash/retry, and leaves only an unlinked technical tombstone',()=>tx(async()=>{
 await ready();const shot=await publish();await expire(shot.id);let claim=await rpc('cleanup_claim',null);assert.equal(claim.jobs.length,1);const job=claim.jobs[0];
 assert.deepEqual((await rpc('cleanup_claim',null)).jobs,[],'livelease cannot be claimed twice');
 assert.equal((await rpc('cleanup_finish',null,{id:job.id,token:job.token,removed:[job.paths[0].key]})).status,'invalid');assert.equal((await pg.query('SELECT count(*) n FROM shots_private.shots')).rows[0].n,1);
 assert.equal((await rpc('cleanup_retry',null,{id:job.id,token:job.token})).status,'retry');await pg.query("UPDATE shots_private.cleanup SET due_at=clock_timestamp()-interval '1 second' WHERE shot_id=$1",[job.id]);claim=await rpc('cleanup_claim',null);assert.notEqual(claim.jobs[0].token,job.token);
 assert.equal((await rpc('cleanup_finish',null,{id:job.id,token:job.token,removed:job.paths.map(x=>x.key)})).status,'conflict');
 const fresh=claim.jobs[0];assert.equal((await rpc('cleanup_finish',null,{id:fresh.id,token:fresh.token,removed:fresh.paths.map(x=>x.key)})).status,'done');
 for(const table of['shots','assets','cleanup'])assert.equal((await pg.query('SELECT count(*) n FROM shots_private.'+table)).rows[0].n,0);
 const closed=(await pg.query('SELECT * FROM shots_private.closed_requests')).rows[0];assert.deepEqual(Object.keys(closed).sort(),['closed_at','request_scope','shot_id','status']);assert.equal(closed.status,'expired');assert.ok(['expired','unavailable'].includes((await rpc('prepare','alice',shot.input)).status));
 assert.equal((await rpc('cleanup_finish',null,{id:fresh.id,token:fresh.token,removed:fresh.paths.map(x=>x.key)})).status,'done');
}));
test('capacity includes reserved uploads and6active limit; expired upload cannot publish after cleanupclaim',()=>tx(async()=>{
 await ready();const reserved=[];for(let i=0;i<6;i++)reserved.push(await rpc('prepare','alice',payload()));assert.ok(reserved.every(x=>x.status==='prepared'));assert.equal((await rpc('prepare','alice',payload())).status,'capacity');
 const p=reserved[0];await pg.query("UPDATE shots_private.shots SET draft_deadline=clock_timestamp()-interval '1 second' WHERE id=$1",[p.id]);await pg.query("UPDATE shots_private.cleanup SET due_at=clock_timestamp()-interval '1 second' WHERE shot_id=$1",[p.id]);await rpc('cleanup_claim',null);assert.ok(['conflict','unavailable'].includes((await rpc('publish','alice',{id:p.id,token:p.token})).status));
}));
test('request recovery is accountbound, absent/expiredlease only and never renews the draft deadline',()=>tx(async()=>{
 await ready();const input=payload();let r=await rpc('request','alice',{requestId:input.requestId});assert.equal(r.status,'absent');assert.equal(r.retryAllowed,true);
 const p=await rpc('prepare','alice',input),deadline=(await pg.query('SELECT draft_deadline FROM shots_private.shots WHERE id=$1',[p.id])).rows[0].draft_deadline;
 r=await rpc('request','alice',{requestId:input.requestId});assert.equal(r.status,'pending');assert.equal(r.retryAllowed,false);assert.equal((await rpc('prepare','alice',input)).status,'pending');
 await pg.query("UPDATE shots_private.shots SET upload_until=clock_timestamp()-interval '1 second' WHERE id=$1",[p.id]);assert.equal((await rpc('request','alice',{requestId:input.requestId})).retryAllowed,true);assert.equal((await rpc('prepare','alice',input)).id,p.id);assert.equal((await pg.query('SELECT draft_deadline FROM shots_private.shots WHERE id=$1',[p.id])).rows[0].draft_deadline.getTime(),deadline.getTime());
 await rpc('delete','alice',{id:p.id});assert.equal((await rpc('request','alice',{requestId:input.requestId})).retryAllowed,false);
 await pg.query("UPDATE shots_private.shots SET upload_until=clock_timestamp()-interval '3 minutes' WHERE id=$1",[p.id]);const job=(await rpc('cleanup_claim',null)).jobs[0];await rpc('cleanup_finish',null,{id:job.id,token:job.token,removed:job.paths.map(x=>x.key)});
 r=await rpc('request','alice',{requestId:input.requestId});assert.equal(r.status,'deleted');assert.equal(r.retryAllowed,false);r=await rpc('request','bob',{requestId:input.requestId});assert.equal(r.status,'absent');assert.equal(r.retryAllowed,true);
 const closed=(await pg.query('SELECT * FROM shots_private.closed_requests')).rows[0];assert.doesNotMatch(JSON.stringify(closed),new RegExp('alice|'+input.requestId));
}));
test('stale/failed workers stop publishes; reads/delete survive, and a claim does not forge a successful heartbeat',()=>tx(async()=>{
 await ready();const shot=await publish();await pg.exec("UPDATE shots_private.config SET worker_seen_at=clock_timestamp()-interval '11 minutes'");
 assert.equal((await rpc('capabilities')).publishAllowed,false);assert.equal((await rpc('prepare','alice',payload())).status,'unavailable');assert.equal((await rpc('get','bob',{id:shot.id})).status,'ok');
 const before=(await pg.query('SELECT worker_seen_at FROM shots_private.config')).rows[0].worker_seen_at;await rpc('cleanup_claim',null);assert.equal((await pg.query('SELECT worker_seen_at FROM shots_private.config')).rows[0].worker_seen_at.getTime(),before.getTime());
 assert.equal((await rpc('cleanup_complete',null)).status,'healthy');assert.equal((await rpc('capabilities')).publishAllowed,true);await rpc('cleanup_failed',null);assert.equal((await rpc('capabilities')).publishAllowed,false);assert.equal((await rpc('get','alice',{id:shot.id})).status,'ok');
 await rpc('delete','alice',{id:shot.id});assert.equal((await rpc('cleanup_complete',null)).status,'backlog');assert.equal((await rpc('capabilities')).publishAllowed,false);
}));
test('cleanup waits for a previous upload lease plus safety window even when owner deletes its draft',()=>tx(async()=>{
 await ready();const p=await rpc('prepare','alice',payload());await rpc('delete','alice',{id:p.id});assert.equal((await rpc('cleanup_claim',null)).jobs.length,0);
 await pg.query("UPDATE shots_private.shots SET upload_until=clock_timestamp()-interval '1 minute' WHERE id=$1",[p.id]);assert.equal((await rpc('cleanup_claim',null)).jobs.length,0);await pg.query("UPDATE shots_private.shots SET upload_until=clock_timestamp()-interval '3 minutes' WHERE id=$1",[p.id]);assert.equal((await rpc('cleanup_claim',null)).jobs.length,1);assert.equal((await rpc('uploaded','alice',{id:p.id,token:p.token,variant:'full',sha256:'a'.repeat(64)})).status,'unavailable');
}));
test('the12MiB quota includes both immutable derivatives and reservations',()=>tx(async()=>{
 await ready();const assets=[{variant:'full',bytes:3145728,sha256:'a'.repeat(64)},{variant:'thumbnail',bytes:3145728,sha256:'b'.repeat(64)}];assert.equal((await rpc('prepare','alice',payload({assets}))).status,'prepared');assert.equal((await rpc('prepare','alice',payload({assets}))).status,'prepared');assert.equal((await rpc('prepare','alice',payload())).status,'capacity');
}));
test('feed pages use the same timestamp precision and stable tuple cursor without duplicate/omitted IDs',()=>tx(async()=>{
 await ready();for(let i=0;i<25;i++)await publish('member_'+i);let first=await rpc('feed','viewer',{audience:'community'});assert.equal(first.items.length,24);assert.ok(first.next);assert.equal(first.items[23].id,first.next.id);
 const second=await rpc('feed','viewer',{audience:'community',beforeId:first.next.id,beforeAt:first.next.createdAt});assert.equal(second.items.length,1);assert.equal(second.next,null);const ids=new Set([...first.items,...second.items].map(x=>x.id));assert.equal(ids.size,25);assert.ok(first.items.every(x=>new Date(x.createdAt).getTime()===Date.parse(x.createdAt)));
}));
test('only the service role can execute real Shot transitions and private-bucket readiness is checked server-side',()=>tx(async()=>{
 await ready();await pg.exec('SET ROLE service_role');assert.equal((await rpc('capabilities')).status,'ok');const p=await rpc('prepare','alice',payload());assert.equal(p.status,'prepared');await pg.exec('RESET ROLE');await pg.exec("UPDATE storage.buckets SET public=true WHERE id='shots-ephemeral-v1'");assert.equal((await rpc('capabilities')).status,'unavailable');assert.equal((await rpc('get','alice',{id:p.id})).status,'unavailable');assert.equal((await rpc('delete','alice',{id:p.id})).status,'deleted');
}));
