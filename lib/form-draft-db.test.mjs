import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {NextRequest,NextResponse} from 'next/server.js';
import ts from 'typescript';
import * as validation from './form-draft.ts';
const require=createRequire(import.meta.url);let pg,api,account='own-test-a',reads=0,permitted=true,limited=false,lastSignal,busyWrite=false;
before(async()=>{
 pg=new PGlite();await pg.exec('create role anon;create role authenticated;create role service_role;');
 await pg.exec(readFileSync(new URL('../supabase/migrations/20261028180000_private_form_drafts.sql',import.meta.url),'utf8'));
 await pg.exec(readFileSync(new URL('../supabase/migrations/20261030150000_nonblocking_private_form_drafts.sql',import.meta.url),'utf8'));
 const mockDb={from:()=>{let user,key,signal;const q={select:()=>q,eq:(k,v)=>{if(k==='user_id')user=v;else if(k==='form_key')key=v;return q},abortSignal:s=>{signal=s;lastSignal=s;return q},maybeSingle:async()=>{signal?.throwIfAborted();reads++;return{data:(await pg.query('select draft_data,revision::int,updated_at from private_form_drafts where user_id=$1 and form_key=$2',[user,key])).rows[0]??null,error:null}}};return q},
 rpc:(_name,p)=>{let signal;const q={abortSignal:s=>{signal=s;lastSignal=s;return q},then:(resolve,reject)=>(async()=>{signal?.throwIfAborted();if(busyWrite)return{data:null,error:{code:'55P03'}};try{return{data:(await pg.query('select revision::int,draft_data from save_private_form_draft($1,$2,$3,$4)',[p.p_user,p.p_key,p.p_expected,p.p_data])).rows,error:null}}catch(e){return{data:null,error:{code:e.code}}}})().then(resolve,reject)};return q}};
 const source=ts.transpileModule(readFileSync(new URL('../app/api/form-drafts/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mocks={'next/server':{NextRequest,NextResponse},'@/lib/auth':{requireAuth:async()=>account?{userId:account}:NextResponse.json({code:'auth'},{status:401})},'@/lib/form-draft-access':{canUseFormDraft:async()=>permitted},'@/lib/rateLimit':{rateLimit:async()=>({allowed:!limited})},'@/lib/db':{db:mockDb},'@/lib/form-draft':validation};const mod={exports:{}};
 new Function('require','module','exports',source)(name=>mocks[name]??require(name),mod,mod.exports);api=mod.exports;
});
after(async()=>pg?.close());
const put=(data,revision=0,who=account,key='listing:new',signal)=>api.PUT(new NextRequest('http://localhost/api/form-drafts',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,data,revision,account:who}),signal}));
const get=(who=account,key='listing:new',signal)=>api.GET(new NextRequest('http://localhost/api/form-drafts?key='+encodeURIComponent(key),{headers:{'X-Draft-Account':who??''},signal}));
test('guest access is denied before reads; accounts can only access their own snapshots',async()=>{
 account=null;const before=reads;assert.equal((await get()).status,401);assert.equal((await put({title:'own'})).status,401);assert.equal(reads,before);
 account='own-test-a';assert.equal((await put({title:'Own private draft',images:['/api/media/own/a.webp']},0)).status,200);
 account='own-test-b';assert.equal((await get()).status,200);assert.equal((await(await get()).json()).data,null);
 assert.equal((await get('own-test-a')).status,403);assert.equal((await put({title:'No'},0,'own-test-a')).status,403);
 account='own-test-a';assert.equal((await(await get()).json()).data.title,'Own private draft');
});
test('reload/login recovery, idempotent retries and stale tabs use actual SQL revisions',async()=>{
 account='own-test-recovery';const data={text:'Own draft',price:'VB',images:['/api/media/b','/api/media/a'],crop:{x:12,y:44}};
 let result=await(await put(data)).json();assert.equal(result.saved,true);const revision=result.revision;
 assert.equal((await(await put(data,0)).json()).revision,revision,'lost acknowledgement can be retried');
 assert.deepEqual((await(await get()).json()).data,data);
 result=await(await put({...data,text:'New edit'},revision)).json();assert.ok(result.revision>revision);
 await assert.rejects(pg.query('select * from save_private_form_draft($1,$2,$3,$4)',[account,'listing:new',revision,{...data,text:'Old tab'}]),error=>error.code==='PT409');
 assert.equal((await put({...data,text:'Old tab'},revision)).status,409);
 const cleared=await(await put(null,result.revision)).json();assert.equal((await(await get()).json()).data,null);
 assert.equal((await put(data,result.revision)).status,409,'a late save cannot resurrect a completed draft');
 assert.equal((await(await put(null,cleared.revision)).json()).revision,cleared.revision);
});
test('private snapshots are not exposed directly through Supabase roles',async()=>{
 for(const role of ['anon','authenticated']){
  assert.equal((await pg.query("select has_table_privilege($1,'private_form_drafts','select') ok",[role])).rows[0].ok,false);
  assert.equal((await pg.query("select has_function_privilege($1,'save_private_form_draft(text,text,bigint,jsonb)','execute') ok",[role])).rows[0].ok,false);
 }
 assert.equal((await pg.query("select relrowsecurity from pg_class where oid='private_form_drafts'::regclass")).rows[0].relrowsecurity,true);
});
test('invalid keys, temporary previews and oversize snapshots cannot be persisted',async()=>{
 account='own-test-validation';assert.equal((await put({text:'own'},0,account,'messages:all')).status,400);
 assert.equal((await put({photo:'blob:local-preview'})).status,400);assert.equal((await put({text:'x'.repeat(300001)})).status,413);
});

test('withdrawn content permissions and write limits fail closed without returning recovery data',async()=>{
 account='own-test-access';permitted=false;const before=reads;
 const key='company:10000000-0000-4000-8000-000000000001';
 assert.equal((await get(account,key)).status,403);assert.equal((await put({name:'Own recovery'},0,account,key)).status,403);assert.equal(reads,before);
 permitted=true;limited=true;assert.equal((await put({title:'Own draft'})).status,429);limited=false;
});

test('a busy-writer response preserves confirmed data and allows an explicit retry',async()=>{
 account='own-test-busy';
 const original={title:'Confirmed own draft',images:['/api/media/own/one.webp']};
 const saved=await(await put(original)).json();
 // PGlite has one backend; inject the busy response at the API boundary.
 // Normal writes, version conflicts and retries still execute the migrated SQL.
 busyWrite=true;
 try {
  const response=await put({...original,title:'Still unsaved input'},saved.revision);
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{code:'unavailable'});
  const restored=await(await get()).json();
  assert.deepEqual(restored.data,original);
  assert.equal(restored.revision,saved.revision);
 } finally {busyWrite=false;}
 const retried=await put({...original,title:'Retry after contention'},saved.revision);
 assert.equal(retried.status,200);
 assert.equal((await(await get()).json()).data.title,'Retry after contention');
 const config=(await pg.query("select proconfig from pg_proc where oid='public.save_private_form_draft(text,text,bigint,jsonb)'::regprocedure")).rows[0].proconfig;
 assert.ok(config.includes('lock_timeout=2s'));
});

test('abandoned reads and writes stop through the request signal and preserve saved recovery',async()=>{
 account='own-test-abort';const original={title:'Keep this draft'};
 const saved=await(await put(original)).json();
 const controller=new AbortController();controller.abort();
 const read=await get(account,'listing:new',controller.signal);
 assert.equal(read.status,503);assert.equal(lastSignal.aborted,true);
 const write=await put({title:'Not acknowledged'},saved.revision,account,'listing:new',controller.signal);
 assert.equal(write.status,503);assert.equal(lastSignal.aborted,true);
 const restored=await(await get()).json();
 assert.deepEqual(restored.data,original);assert.equal(restored.revision,saved.revision);
});

test('application version conflicts never use the transaction-retry SQLSTATE',async()=>{
 const definition=(await pg.query("select prosrc from pg_proc where oid='public.save_private_form_draft(text,text,bigint,jsonb)'::regprocedure")).rows[0].prosrc;
 assert.doesNotMatch(definition,/errcode\s*=\s*'40001'/i);
 account='own-test-missing-revision';
 await assert.rejects(pg.query('select * from save_private_form_draft($1,$2,$3,$4)',[account,'listing:new',4,{title:'Stale missing draft'}]),error=>error.code==='PT409');
 assert.equal((await(await get()).json()).data,null);
});
