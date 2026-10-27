import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {NextResponse} from 'next/server.js';
import * as paths from './protected-media.ts';
const require=createRequire(import.meta.url);
const path=`own-fixture/${'a'.repeat(32)}.webp`;
function fixture({admin=true,readable=false}={}){
 const calls={db:0,files:0,permission:0};
 const deps={
  '@/lib/requireAdmin':{requireAdmin:async()=>admin?{userId:'own-admin'}:new NextResponse(null,{status:403})},
  '@/lib/protected-media':paths,
  '@/lib/protected-media-server':{readableProtectedMedia:async()=>{calls.permission++;return readable?{}:null;}},
  '@/lib/db':{db:{from:()=>{calls.db++;const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{storage_path:path},error:null})};return q;},storage:{from:()=>({list:async()=>{calls.files++;return{data:[{name:path.split('/').at(-1)}],error:null};},download:()=>{throw Error('Admin diagnostics must never fetch private bytes');}})}}},
 };
 const source=ts.transpileModule(readFileSync(new URL('../app/api/admin/media/check/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const m={exports:{}};new Function('require','module','exports',source)(n=>deps[n]??require(n),m,m.exports);
 return {...m.exports,calls};
}
test('admin media diagnostics report private access without downloading or granting file access',async()=>{
 const f=fixture();const response=await f.GET({nextUrl:new URL('https://own-fixture.invalid/api/admin/media/check?url='+encodeURIComponent('/api/media/'+path))});
 assert.deepEqual(await response.json(),{status:'access_problem',protected:true});assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(f.calls.permission,1);assert.equal(f.calls.files,1);
});
test('ordinary members cannot use admin media diagnostics or query its file ledger',async()=>{
 const f=fixture({admin:false});const response=await f.GET({nextUrl:new URL('https://own-fixture.invalid/api/admin/media/check?url='+encodeURIComponent('/api/media/'+path))});
 assert.equal(response.status,403);assert.equal(f.calls.db,0);assert.equal(f.calls.files,0);assert.equal(f.calls.permission,0);
});
