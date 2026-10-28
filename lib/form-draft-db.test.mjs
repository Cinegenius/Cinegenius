import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {NextRequest,NextResponse} from 'next/server.js';
import ts from 'typescript';
import * as validation from './form-draft.ts';
const require=createRequire(import.meta.url);let pg,api,account='own-test-a',reads=0,permitted=true,limited=false;
before(async()=>{
 pg=new PGlite();await pg.exec('create role anon;create role authenticated;create role service_role;');
 await pg.exec(readFileSync(new URL('../supabase/migrations/20261028180000_private_form_drafts.sql',import.meta.url),'utf8'));
 const mockDb={from:()=>{let user,key;const q={select:()=>q,eq:(k,v)=>{if(k==='user_id')user=v;else if(k==='form_key')key=v;return q},maybeSingle:async()=>{reads++;return{data:(await pg.query('select draft_data,revision::int,updated_at from private_form_drafts where user_id=$1 and form_key=$2',[user,key])).rows[0]??null,error:null}}};return q},
 rpc:async(_name,p)=>{try{return{data:(await pg.query('select revision::int,draft_data from save_private_form_draft($1,$2,$3,$4)',[p.p_user,p.p_key,p.p_expected,p.p_data])).rows,error:null}}catch(e){return{data:null,error:{code:e.code}}}}};
 const source=ts.transpileModule(readFileSync(new URL('../app/api/form-drafts/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mocks={'next/server':{NextRequest,NextResponse},'@/lib/auth':{requireAuth:async()=>account?{userId:account}:NextResponse.json({code:'auth'},{status:401})},'@/lib/form-draft-access':{canUseFormDraft:async()=>permitted},'@/lib/rateLimit':{rateLimit:async()=>({allowed:!limited})},'@/lib/db':{db:mockDb},'@/lib/form-draft':validation};const mod={exports:{}};
 new Function('require','module','exports',source)(name=>mocks[name]??require(name),mod,mod.exports);api=mod.exports;
});
after(async()=>pg?.close());
const put=(data,revision=0,who=account,key='listing:new')=>api.PUT(new NextRequest('http://localhost/api/form-drafts',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,data,revision,account:who})}));
const get=(who=account,key='listing:new')=>api.GET(new NextRequest('http://localhost/api/form-drafts?key='+encodeURIComponent(key),{headers:{'X-Draft-Account':who??''}}));
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
