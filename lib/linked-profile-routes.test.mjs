import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import * as projectMediaRights from './project-media-rights.ts';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
function route(file){let queries=0;const deps={'@/lib/project-media-rights':projectMediaRights,'@clerk/nextjs/server':{auth:async()=>({userId:'own-test-member-a'})},'@/lib/trust':{canViewProfile:async()=>false},'@/lib/linked-profile-access':{},'@/lib/db':{db:{from:()=>{queries++;throw Error('Private target must be rejected before querying linked content');}}},'@/lib/auth':{},'@/lib/rateLimit':{},'next/cache':{}};const m={exports:{}};const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',source)(n=>deps[n]??require(n),m,m.exports);return {...m.exports,queries:()=>queries};}
for(const [file,param] of [['../app/api/collaborations/route.ts','userId'],['../app/api/recommendations/route.ts','userId'],['../app/api/project-credits/route.ts','user_id']])test(`${file}: changing a member ID cannot bypass the original private profile permission`,async()=>{
 const f=route(file),url=new URL(`https://own-test.invalid/api/test?${param}=own-test-member-b`);const response=await f.GET({url:url.href,nextUrl:url});assert.equal(response.status,404);assert.equal(f.queries(),0);assert.equal(await response.text(),'');
});
