import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {NextResponse} from 'next/server.js';
import * as privacy from './location-privacy.ts';
const require=createRequire(import.meta.url),id='10000000-0000-4000-8000-000000000001';
function fixture(){let actor='owner',result={data:{status:'ok',value:null,revision:0},error:null};const calls=[];
 const mocks={'next/server':{NextResponse},'next-intl/server':{getTranslations:async()=>key=>key},'@/lib/auth':{requireAuth:async()=>actor?{userId:actor}:NextResponse.json({error:'unauthorized'},{status:401})},'@/lib/db':{db:{rpc:async(name,args)=>{calls.push({name,args});return result;}}},'@/lib/location-privacy':privacy,'next/cache':{revalidatePath(){}}};
 const source=ts.transpileModule(readFileSync(new URL('../app/api/listings/[id]/private-location/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',source)(n=>mocks[n]??require(n),mod,mod.exports);
 const invoke=(method,body)=>mod.exports[method](new Request('http://localhost/api/listings/'+id+'/private-location',{method,...(body?{body:JSON.stringify(body)}:{})}),{params:Promise.resolve({id})});
 return {invoke,calls,setActor:v=>actor=v,setResult:v=>result=v};
}
test('exact-location endpoint authenticates before storage and never caches private data',async()=>{
 const f=fixture();f.setActor(null);let r=await f.invoke('GET');assert.equal(r.status,401);assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(f.calls.length,0);
 f.setActor('owner');f.setResult({data:{status:'missing'},error:null});r=await f.invoke('GET');assert.equal(r.status,404);assert.deepEqual(f.calls[0].args,{p_id:id,p_actor:'owner',p_write:false,p_value:null,p_area:null,p_revision:0});
});
test('writes enforce coordinates, use current authenticated actor, provide only approximate public area and fail closed without migration',async()=>{
 const f=fixture();assert.equal((await f.invoke('PATCH',{revision:0,value:{address:'secret',lat:'52',lng:13}})).status,400);assert.equal(f.calls.length,0);
 const value={address:'Synthetic secret address',lat:52.52,lng:13.4};f.setResult({data:{status:'saved',revision:1},error:null});
 const r=await f.invoke('PATCH',{revision:0,value,p_actor:'forged'});assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);
 assert.equal(f.calls[0].args.p_actor,'owner');assert.deepEqual(f.calls[0].args.p_value,value);assert.deepEqual(f.calls[0].args.p_area,privacy.publicLocationArea(value));
 f.setResult({data:null,error:{code:'PGRST202'}});assert.equal((await f.invoke('PATCH',{revision:0,value})).status,503);
 f.setResult({data:{status:'conflict'},error:null});assert.equal((await f.invoke('PATCH',{revision:0,value})).status,409);
});

test('private location recovery keys recheck current listing permissions',async()=>{
 const {validFormDraftKey}=await import('./form-draft.ts');assert.ok(validFormDraftKey(`location-private:${id}`));
 let allowed=true;const query={select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{user_id:'owner',company_id:null},error:null})};
 const mocks={'server-only':{},'@/lib/organization-access':{},'@/lib/company-access':{},'@/lib/db':{db:{from:()=>query}},'@/lib/listing-access':{canEditListing:async()=>allowed}};
 const source=ts.transpileModule(readFileSync(new URL('./form-draft-access.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;const mod={exports:{}};
 new Function('require','module','exports',source)(n=>mocks[n]??require(n),mod,mod.exports);
 assert.equal(await mod.exports.canUseFormDraft('owner',`location-private:${id}`),true);allowed=false;assert.equal(await mod.exports.canUseFormDraft('owner',`location-private:${id}`),false);
});
