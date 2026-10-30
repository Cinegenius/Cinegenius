import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
function fixture(failing=false,{fetchResponse}={}){
 const calls=[],requestOptions=[];
 const db=createClient('https://fixture.invalid','own-test-fixture-key',{auth:{persistSession:false},global:{fetch:async(input,options)=>{
  const u=new URL(input),table=u.pathname.split('/').at(-1);calls.push(u);requestOptions.push(options);
  if(fetchResponse)return fetchResponse(u,options);
  let rows=[];
  if(table==='user_settings')rows=[{user_id:'private',profile_visibility:'private'},{user_id:'friend',profile_visibility:'private'}];
  if(table==='blocks'&&u.searchParams.has('blocker_id')&&u.searchParams.get('blocker_id')?.startsWith('in.'))rows=[{blocker_id:'blocked'}];
  if(table==='friendships'&&u.searchParams.get('sender_id')==='eq.me')rows=[{receiver_id:'friend'}];
  return new Response(JSON.stringify(failing?{message:'database unavailable',code:'08006'}:rows),{status:failing?500:200,headers:{'content-type':'application/json'}});
 }}});
 const code=ts.transpileModule(readFileSync(new URL('./linked-profile-access.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const m={exports:{}};new Function('require','module','exports',code)(n=>n==='server-only'?{}:{db},m,m.exports);
 return {...m.exports,calls,requestOptions};
}
test('cross-area links use current batch permissions; private profiles and either-direction blocks never gain access from a reference',async()=>{
 const f=fixture();assert.deepEqual([...await f.visibleLinkedProfileIds(['public','private','friend','blocked','me'],'me')],['public','friend','me']);assert.equal(f.calls.length,5);
 assert.ok(f.calls.every(u=>!u.pathname.endsWith('/profiles')),'identity data is not fetched before permissions');
});
test('guest links exclude private profiles and changed privacy is checked afresh',async()=>{
 const f=fixture();assert.deepEqual([...await f.visibleLinkedProfileIds(['public','private','friend'])],['public']);assert.equal(f.calls.length,1);
 await f.visibleLinkedProfileIds(['public','private']);assert.equal(f.calls.length,2);
});
test('database errors fail closed, while the current owner can still see their own record',async()=>{
 const f=fixture(true);assert.deepEqual([...await f.visibleLinkedProfileIds(['private','public','me'],'me')],['me']);
});

test('media block lookup is fresh, guest-safe and fails closed on unavailable permissions',async()=>{
 const f=fixture();assert.deepEqual(await f.blockedMediaOwnerIds(null),[]);assert.equal(f.calls.length,0);
 await f.blockedMediaOwnerIds('me');assert.equal(f.calls.length,2);
 await assert.rejects(fixture(true).blockedMediaOwnerIds('me'),/unavailable/);
});

test('a caller signal reaches both directional block lookups while guests still make no request',async()=>{
 const controller=new AbortController();
 const f=fixture(false,{fetchResponse:url=>new Response(JSON.stringify(url.searchParams.get('select')==='blocked_id'?[{blocked_id:'outgoing'}]:[{blocker_id:'incoming'}]),{headers:{'content-type':'application/json'}})});
 assert.deepEqual(await f.blockedMediaOwnerIds(null,controller.signal),[]);assert.equal(f.calls.length,0);
 assert.deepEqual(new Set(await f.blockedMediaOwnerIds('me',controller.signal)),new Set(['outgoing','incoming']));
 assert.equal(f.calls.length,2);assert.ok(f.requestOptions.every(options=>options.signal===controller.signal));
});

test('aborting block lookups cancels both requests and never treats unknown permissions as an empty block list',{timeout:2000},async()=>{
 const controller=new AbortController();let started,requests=0;
 const pending=new Promise(resolve=>{started=resolve;});
 const f=fixture(false,{fetchResponse:(_url,options)=>{
  if(++requests===2)started();
  assert.equal(options.signal,controller.signal);
  return new Promise((resolve,reject)=>{
   if(options.signal.aborted)reject(options.signal.reason);
   else options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});
  });
 }});
 const failure=assert.rejects(f.blockedMediaOwnerIds('me',controller.signal),/unavailable/);
 await pending;controller.abort();await failure;
 assert.equal(f.calls.length,2);
});
