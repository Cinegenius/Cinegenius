import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as primaryOccupation from './primary-occupation.ts';
import {createOnboardingSaveQueue,isQuickStartContentSaved,clerkRateLimitSeconds} from './onboarding-save.ts';
import {START_QUICK_START_DRAFT} from './quick-start-flow.ts';
const require=createRequire(import.meta.url);
const draft=()=>structuredClone(START_QUICK_START_DRAFT);

test('autosave serializes concurrent writes and skips acknowledged duplicate snapshots',async()=>{
 const calls=[]; let release;const gate=new Promise(r=>release=r);
 const q=createOnboardingSaveQueue(async d=>{calls.push(d.name);if(calls.length===1)await gate;return true;});
 const a={...draft(),name:'Alex'},b={...a,name:'Alex Test'};
 const pending=[q.save(a),q.save(a),q.save(b),q.save(b)];
 await Promise.resolve();await Promise.resolve();release();
 assert.deepEqual(await Promise.all(pending),[true,true,true,true]);assert.deepEqual(calls,['Alex','Alex Test']);
 q.acknowledge(b);await q.save(b);assert.equal(calls.length,2);
});
test('a failed snapshot stays retryable and is never acknowledged as saved',async()=>{
 let count=0;const q=createOnboardingSaveQueue(async()=>++count>1);const d=draft();
 assert.equal(await q.save(d),false);assert.equal(await q.save(d),true);assert.equal(await q.save(d),true);assert.equal(count,2);
});
test('completion waits for every selected resource; searching requires no public profile',()=>{
 const d=draft();assert.equal(isQuickStartContentSaved(d),false);
 d.intents=['search'];assert.equal(isQuickStartContentSaved(d),true);
 d.intents=['crew','talent','company','location','equipment','search'];d.completed={profile:true,company:'company',listings:{location:'location'}};
 assert.equal(isQuickStartContentSaved(d),false);d.completed.listings.equipment='equipment';assert.equal(isQuickStartContentSaved(d),true);
});
test('rate limits preserve the supplied cooldown and handle Clerk retryAfter zero',()=>{
 assert.equal(clerkRateLimitSeconds({status:429,retryAfter:0}),10);assert.equal(clerkRateLimitSeconds({status:429,retryAfter:2.2}),3);
 assert.equal(clerkRateLimitSeconds({errors:[{code:'too_many_requests'}]}),10);assert.equal(clerkRateLimitSeconds({status:503}),null);
});
function routeFixture({limited=false,guest=false}={}){
 const metadata={other:'keep',cinegeniusOnboarding:{quickStart:{name:'private draft'},profileEditorDraftEncoded:'preserve',intent:'crew',setupComplete:false}};
 const writes=[],reads=[];
 function merge(target,patch){for(const [key,value] of Object.entries(patch)){if(value===null)delete target[key];else if(typeof value==='object'&&!Array.isArray(value)){target[key]??={};merge(target[key],value);}else target[key]=value;}}
 const deps={'@clerk/nextjs/server':{clerkClient:async()=>({users:{getUser:async id=>{reads.push(id);return{privateMetadata:metadata};},updateUserMetadata:async(id,patch)=>{writes.push({id,patch});if(limited)throw{status:429,retryAfter:0};merge(metadata,patch.privateMetadata);}}})},'@/lib/auth':{requireAuth:async()=>guest?require('next/server').NextResponse.json({error:'unauthorized'},{status:401}):{userId:'own-test-account'}},'@/lib/profile-editor-private-draft':{},'@/lib/quick-start-flow':{},'@/lib/onboarding-save':{clerkRateLimitSeconds}};
 const output=ts.transpileModule(readFileSync(new URL('../app/api/onboarding/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',output)(n=>deps[n]??require(n),mod,mod.exports);
 return{metadata,writes,reads,remove:()=>mod.exports.DELETE(new(require('next/server').NextRequest)('https://test.invalid/api/onboarding?type=quick-start'))};
}
test('actual completion route removes the nested draft with one atomic write, preserving other private data',async()=>{
 const f=routeFixture();const res=await f.remove();assert.equal(res.status,200);assert.equal((await res.json()).completed,true);
 assert.equal(f.metadata.cinegeniusOnboarding.quickStart,undefined);assert.equal(f.metadata.cinegeniusOnboarding.setupComplete,true);
 assert.equal(f.metadata.other,'keep');assert.equal(f.metadata.cinegeniusOnboarding.profileEditorDraftEncoded,'preserve');
 assert.equal(f.reads.length,0);assert.equal(f.writes.length,1);assert.equal(f.writes[0].id,'own-test-account');
 assert.equal((await f.remove()).status,200);assert.equal(f.reads.length,0);
});
test('failed completion reports a retryable 429 and never claims success or loses the draft',async()=>{
 const f=routeFixture({limited:true});const res=await f.remove();assert.equal(res.status,429);assert.equal(res.headers.get('Retry-After'),'10');
 const body=await res.json();assert.equal(body.completed,undefined);assert.equal(body.retryAfter,10);assert.ok(f.metadata.cinegeniusOnboarding.quickStart);
});
test('signed-out callers cannot clear progress',async()=>{
 const f=routeFixture({guest:true});assert.equal((await f.remove()).status,401);assert.equal(f.writes.length,0);assert.equal(f.reads.length,0);
});

test('repeated actual profile GETs read the owner profile without consuming Clerk metadata writes',async()=>{
 let clerkCalls=0;const profile={user_id:'own-test-account',display_name:'Alex',positions:['Licht'],location:'München'};
 const query={select:()=>query,eq:(_key,id)=>{assert.equal(id,'own-test-account');return query;},maybeSingle:async()=>({data:profile,error:null})};
 const deps={'@/lib/crew-occupations':await import('./crew-occupations.ts'),'@/lib/db':{db:{from:()=>query}},'@/lib/auth':{requireAuth:async()=>({userId:'own-test-account'})},'@clerk/nextjs/server':{clerkClient:async()=>{clerkCalls++;throw new Error('GET must never write Clerk');}},'next/cache':{},'@/lib/profile-types':{PROFILE_TYPE_LABELS:{}},'@/lib/primary-occupation':primaryOccupation,'@/lib/profile-display':{},'@/lib/profile-cover':{},'@/lib/profile-db-compat':{selectOptionalProfileColumns:async()=>({data:{},unavailableFields:[]})}};
 const compiled=ts.transpileModule(readFileSync(new URL('../app/api/profile/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',compiled)(n=>deps[n]??require(n),mod,mod.exports);
 for(let i=0;i<12;i++){const res=await mod.exports.GET();assert.equal(res.status,200);assert.equal((await res.json()).profile.display_name,'Alex');assert.match(res.headers.get('Cache-Control'),/private, no-store/);}
 assert.equal(clerkCalls,0);
});
