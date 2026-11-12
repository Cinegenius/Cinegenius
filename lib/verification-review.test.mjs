import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiHarness,LOCALES} from './api-test-harness.mjs';
import {memberVerificationStatus,verificationDocument} from './verification.ts';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {intlServerFor,notificationCopy,translatorFor} from './i18n-test-fixture.mjs';
import {NextResponse} from 'next/server.js';
import ts from 'typescript';
import sharp from 'sharp';
import * as protectedMedia from './protected-media.ts';
const route='app/api/verification-requests/route.ts';
const id='10000000-0000-4000-8000-000000000001';
const body={requestId:id,version:2,profileRevision:3,action:'approve',reason:''};
test('canonical member status preserves rejection/reapply and trusts the badge over historical request approval',()=>{
 assert.equal(memberVerificationStatus(false,'rejected'),'rejected');assert.equal(memberVerificationStatus(false,'pending'),'pending');
 assert.equal(memberVerificationStatus(false,'approved'),'none');assert.equal(memberVerificationStatus(true,'rejected'),'approved');
 assert.equal(memberVerificationStatus(true,null),'approved');
});
test('admins retain their own member status unless the explicit admin scope is selected',async()=>{
 const h=createApiHarness({isAdmin:true,result:(table)=>({data:table==='profiles'?{verified:false}:[{id:'own',status:'rejected'}],error:null})});
 const response=await h.load(route).GET(h.request());const json=await response.json();assert.equal(json.status,'rejected');
 assert.ok(h.state.queries.every(query=>query.operations.some(op=>op.op==='eq'&&op.args[0]==='user_id'&&op.args[1]==='owner-user')));
 assert.match(response.headers.get('cache-control'),/private, no-store/);
});
test('ordinary users cannot load admin evidence or review another member',async()=>{
 const h=createApiHarness();let req=h.request();req.nextUrl=new URL('https://fixture.invalid/api/verification-requests?scope=admin');
 assert.equal((await h.load(route).GET(req)).status,403);assert.equal((await h.load(route).PATCH(h.request(body))).status,403);
 assert.equal(h.state.queries.length,0);assert.equal(h.state.rpcs.length,0);
});
test('lookup failures remain unavailable and never become a misleading fresh application',async()=>{
 const h=createApiHarness({databaseError:{message:'private SQL detail'}});const response=await h.load(route).GET(h.request());
 assert.equal(response.status,503);assert.equal('status' in await response.json(),false);
});
test('admin queue defaults to pending and does not expose protected document references',async()=>{
 const h=createApiHarness({isAdmin:true,result:table=>({data:table==='profiles'?[{user_id:'member',verification_revision:3,verified:false}]:[{id,user_id:'member',status:'pending',notes:'{"id_doc":"/api/media/member/secret.webp"}',review_version:2}],count:1,error:null})});
 let request=h.request();request.nextUrl=new URL('https://fixture.invalid/api/verification-requests?scope=admin');
 const response=await h.load(route).GET(request);const json=await response.json();assert.equal(json.data[0].notes,null);assert.equal(json.data[0].has_document,true);assert.equal(json.data[0].profile_revision,3);
 assert.ok(h.state.queries[0].operations.some(op=>op.op==='eq'&&op.args[0]==='status'&&op.args[1]==='pending'));assert.doesNotMatch(JSON.stringify(json),/secret.webp/);
});
test('decisions require reviewed versions and a rejection reason before calling the atomic transition',async()=>{
 for(const input of [{...body,version:undefined},{...body,profileRevision:undefined},{...body,action:'reject',reason:''},{...body,reason:12}]){
  const h=createApiHarness({isAdmin:true});assert.equal((await h.load(route).PATCH(h.request(input))).status,400);assert.equal(h.state.rpcs.length,0);
 }
});
test('approval uses one atomic RPC with the server actor, exact versions, localized notification and honest default reason',async()=>{
 const h=createApiHarness({isAdmin:true,rpcResult:()=> 'saved'});assert.equal((await h.load(route).PATCH(h.request(body))).status,200);
 assert.equal(h.state.rpcs.length,1);const rpc=h.state.rpcs[0];assert.equal(rpc.name,'verification_review');assert.equal(rpc.args.p_actor,'owner-user');assert.equal(rpc.args.p_version,2);assert.equal(rpc.args.p_profile_revision,3);assert.equal(rpc.args.p_reason,h.t('VerificationReview.approvalReason'));assert.equal(h.state.queries.length,0);
});
test('concurrent decision conflicts are recoverable and database failures never report success',async()=>{
 for(const [value,status] of [['stale',409],['profile_missing',404],['invalid',503]]){
  const h=createApiHarness({isAdmin:true,rpcResult:()=>value});assert.equal((await h.load(route).PATCH(h.request(body))).status,status);
 }
 const h=createApiHarness({isAdmin:true,rpcError:{message:'private'}});assert.equal((await h.load(route).PATCH(h.request(body))).status,503);
});
test('manual badge changes also require a reviewed profile revision and use the atomic status transition',async()=>{
 const h=createApiHarness({isAdmin:true,rpcResult:()=> 'saved'});const api=h.load('app/api/admin/users/route.ts');
 assert.equal((await api.PATCH(h.request({targetUserId:'member',verified:false,reason:'Own reviewed reason'}))).status,400);
 assert.equal(h.state.rpcs.length,0);assert.equal((await api.PATCH(h.request({targetUserId:'member',verified:false,revision:3,reason:'Own reviewed reason'}))).status,200);
 assert.equal(h.state.rpcs[0].name,'verification_set_profile');assert.equal(h.state.rpcs[0].args.p_revision,3);assert.equal(h.state.queries.length,0);
});
test('admin member lists and unsuccessful decisions cannot be retained in browser or shared caches',async()=>{
 const h=createApiHarness({isAdmin:true,result:()=>({data:[],count:0,error:null}),rpcResult:()=> 'stale'});
 const api=h.load('app/api/admin/users/route.ts');
 const listed=await api.GET({...h.request(),url:'https://fixture.invalid/api/admin/users'});
 const conflict=await api.PATCH(h.request({targetUserId:'member',verified:false,revision:3,reason:'Own reviewed reason'}));
 assert.equal(listed.status,200);assert.equal(conflict.status,409);
 for(const response of [listed,conflict])for(const key of ['cache-control','cdn-cache-control','vercel-cdn-cache-control'])assert.match(response.headers.get(key),/no-store/);
});
test('member submissions use the authenticated account and preserve missing-profile and retry outcomes',async()=>{
 for(const [outcome,status] of [['saved',200],['pending',400],['approved',400],['missing',409]]){
  const h=createApiHarness({rpcResult:()=>({status:outcome,id})});
  const response=await h.load(route).POST(h.request({userId:'forged-account',notes:'Own evidence notes'}));
  assert.equal(response.status,status);assert.equal(h.state.rpcs.length,1);
  assert.equal(h.state.rpcs[0].name,'verification_submit');assert.equal(h.state.rpcs[0].args.p_user,'owner-user');assert.equal(h.state.rpcs[0].args.p_notes,'Own evidence notes');
 }
 for(const notes of [42,'a'.repeat(6001)]){
  const h=createApiHarness();assert.equal((await h.load(route).POST(h.request({notes}))).status,400);assert.equal(h.state.rpcs.length,0);
 }
});
const require=createRequire(import.meta.url);
function documentFixture({authorized=true,version=2,owner='member',source=null,reference,assetError=false}={}){
 const key='member/'+'a'.repeat(32)+'.webp';reference??='/api/media/'+key;const calls={reads:[],downloads:0};
 const db={from(table){calls.reads.push(table);const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({error:table==='media_assets'&&assetError?{message:'private'}:null,data:table==='verification_requests'?{user_id:'member',notes:JSON.stringify({id_doc:reference}),review_version:version}:{owner_user_id:owner,reference_url:reference,source_type:source}})};return q;},storage:{from:()=>({download:async path=>{calls.downloads++;assert.equal(path,key);return{data:new Blob([await sharp({create:{width:100,height:200,channels:3,background:'#aaaaaa'}}).png().toBuffer()]),error:null};}})}};
 const mocks={'@/lib/auth':{requireAdmin:async()=>authorized?{userId:'admin'}:NextResponse.json({error:'forbidden'},{status:403})},'@/lib/db':{db},'@/lib/verification':{verificationDocument},'@/lib/protected-media':protectedMedia,'next-intl/server':intlServerFor()};
 const sourceCode=ts.transpileModule(readFileSync(new URL('../app/api/verification-requests/[id]/document/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',sourceCode)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);
 return{calls,get:()=>mod.exports.GET({nextUrl:new URL('https://fixture.invalid/document?version=2')},{params:Promise.resolve({id})})};
}
test('identity documents require admin auth before any read and fail closed for stale, foreign, public-parent or remote references',async()=>{
 for(const [options,status] of [[{authorized:false},403],[{version:3},409],[{owner:'someone-else'},404],[{source:'profile'},404],[{reference:'https://evil.invalid/passport.jpg'},404],[{assetError:true},503]]){
  const f=documentFixture(options);assert.equal((await f.get()).status,status);assert.equal(f.calls.downloads,0);if(!options.authorized&&options.authorized!==undefined)assert.deepEqual(f.calls.reads,[]);
 }
});
test('authorized document previews preserve portrait proportions, strip metadata and bypass shared caches',async()=>{
 const f=documentFixture();const response=await f.get();assert.equal(response.status,200);assert.equal(f.calls.downloads,1);
 for(const key of ['cache-control','cdn-cache-control','vercel-cdn-cache-control'])assert.match(response.headers.get(key),/no-store/);
 const metadata=await sharp(new Uint8Array(await response.arrayBuffer())).metadata();assert.equal(metadata.width,100);assert.equal(metadata.height,200);assert.equal(metadata.exif,undefined);
});
for(const locale of LOCALES)test(locale+': approval, rejection and revocation notifications use the active UI language',()=>{
 for(const key of ['verificationApprovedBody','verificationRejectedBody','verificationRevokedBody']){
  const original=notificationCopy.localizedNotification({title:{key:'verificationResultTitle'},body:{key}});
  const notice={...original,type:key==='verificationApprovedBody'?'verification_approved':'verification_pending'};
  const rendered=notificationCopy.localizeNotification(notice,translatorFor(locale,'NotificationCopy'));
  assert.equal(rendered.body,translatorFor(locale,'NotificationCopy')(key));
 }
});
