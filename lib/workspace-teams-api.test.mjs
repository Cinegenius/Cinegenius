import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {NextRequest,NextResponse} from 'next/server.js';
import {intlServerFor} from './i18n-test-fixture.mjs';
import * as backend from './messaging-backend.ts';
const require=createRequire(import.meta.url),team='10000000-0000-4000-8000-000000000001';
function fixture({actor='actor',error=null,allowed=true}={}){
 const calls=[];const mocks={'@/lib/auth':{requireAuth:async()=>actor?{userId:actor}:NextResponse.json({}, {status:401})},'@/lib/db':{db:{rpc:async(name,args)=>{calls.push({name,args});return {data:error?null:{accountId:actor,teams:[]},error};}}},'@/lib/rateLimit':{rateLimit:async()=>({allowed})},'@/lib/messaging-backend':backend,'next-intl/server':intlServerFor('en')};
 const source=ts.transpileModule(readFileSync(new URL('../app/api/work/teams/route.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;const mod={exports:{}};new Function('require','module','exports',source)(id=>mocks[id]??require(id),mod,mod.exports);return {...mod.exports,calls};
}
const req=(body,account='actor',query='')=>new NextRequest('https://fixture.invalid/api/work/teams'+query,{headers:{'X-Team-Account':account,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
test('every Team read/write binds to the authenticated account before any database call',async()=>{
 for(const actor of [null,'other']){const f=fixture({actor});assert.equal((await f.GET(req())).status,actor?403:401);assert.equal(f.calls.length,0);}
 const f=fixture();assert.equal((await f.POST(req({accountId:'old',action:'create_team',p:{name:'Own',key:'fixture-key'}}))).status,403);assert.equal(f.calls.length,0);
 const success=await f.POST(req({accountId:'actor',actor:'forged',action:'create_team',p:{name:'Own',key:'fixture-key',actor:'forged'}}));assert.equal(success.status,200);assert.equal(f.calls[0].args.p_actor,'actor');assert.match(success.headers.get('cache-control'),/private, no-store/);
});
test('malformed targets, unknown actions and missing operation keys never reach the database',async()=>{
 for(const body of [{action:'delete_everything',p:{}},{action:'create_team',p:{name:'Own'}},{action:'join',p:{teamId:team,revision:1,channelId:'forged',key:'fixture-key'}},{action:'invite',p:{teamId:team,revision:1,userId:'bad),id.eq.other',key:'fixture-key'}}]){const f=fixture();assert.equal((await f.POST(req({accountId:'actor',...body}))).status,400);assert.equal(f.calls.length,0);}
});
test('unapplied schema is honestly unavailable; private SQL error text never reaches a member',async()=>{
 for(const [code,status] of [['PGRST202',503],['42P01',503],['PT409',409],['42501',403],['PT404',404]]){const f=fixture({error:{code,message:'PRIVATE schema details'}});const response=await f.GET(req());assert.equal(response.status,status);assert.doesNotMatch(JSON.stringify(await response.json()),/PRIVATE/);}
 const f=fixture({allowed:false});assert.equal((await f.POST(req({accountId:'actor',action:'create_team',p:{name:'Own',key:'fixture-key'}}))).status,429);assert.equal(f.calls.length,0);
});
