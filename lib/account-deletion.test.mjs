import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as validation from './account-erasure.ts';
const require=createRequire(import.meta.url),{NextResponse}=require('next/server');
const id='64e2fb52-a72d-4a8d-8640-c43b010e93c7',receipt={id,state:'pending',requestedAt:new Date().toISOString()};
function fixture({guest=false,fail=false,value=receipt,own=receipt,header='synthetic-owner'}={}){
 const calls=[];class ErasureError extends Error{constructor(status=503){super('private');this.status=status;}}
 const mocks={'@/lib/auth':{requireAuth:async()=>guest?NextResponse.json({error:'unauthorized'},{status:401}):{userId:'synthetic-owner'}},'@/lib/account-erasure':validation,'@/lib/account-erasure-server':{ErasureError,requestErasure:async actor=>{calls.push(actor);if(fail)throw Error('PRIVATE_DATABASE_DETAIL');if(!validation.erasureSummary(value))throw new ErasureError();return value;},erasureRPC:async(actor,action)=>{calls.push({actor,action});if(fail)throw Error('PRIVATE_DATABASE_DETAIL');return own;}},'next-intl/server':{getTranslations:async()=>()=> 'Request failed'}};
 const source=ts.transpileModule(readFileSync(new URL('../app/api/account/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',source)(name=>mocks[name]??require(name),mod,mod.exports);
 return{calls,get:mod.exports.GET,run:()=>mod.exports.DELETE(new Request('https://www.cinegenius.co/api/account',{method:'DELETE',headers:header?{'X-Account-Id':header}:{}}))};
}
test('signed-out read and deletion fail privately before touching data',async()=>{const f=fixture({guest:true});for(const r of [await f.get(),await f.run()]){assert.equal(r.status,401);assert.match(r.headers.get('cache-control'),/no-store/);}assert.deepEqual(f.calls,[]);});
for(const header of ['', 'different-account'])test('missing/stale account binding rejects '+header,async()=>{const f=fixture({header});assert.equal((await f.run()).status,409);assert.deepEqual(f.calls,[]);});
test('accepted request returns a durable reference, never a completed success',async()=>{const f=fixture(),r=await f.run();assert.equal(r.status,202);assert.deepEqual(await r.json(),{accepted:true,accountId:'synthetic-owner',request:receipt});assert.deepEqual(f.calls,['synthetic-owner']);});
for(const options of [{fail:true},{value:{}},{value:{...receipt,state:'unknown'}},{value:{...receipt,id:'invalid'}}])test('failed persistence or malformed receipt is not accepted '+JSON.stringify(options),async()=>{const f=fixture(options),r=await f.run();assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'Request failed'});assert.equal(r.headers.get('vercel-cdn-cache-control'),'no-store');});
test('member status is read using only the authenticated account',async()=>{const f=fixture({own:null});assert.deepEqual(await(await f.get()).json(),{accountId:'synthetic-owner',request:null});assert.deepEqual(f.calls,[{actor:'synthetic-owner',action:'read_own'}]);});
