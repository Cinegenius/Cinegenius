import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
import {NextResponse} from 'next/server.js';
const require=createRequire(import.meta.url);
const id='10000000-0000-4000-8000-000000000001',version='2026-11-13T12:00:00.000Z';
function load(path,mocks){const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};new Function('require','module','exports',code)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),m,m.exports);return m.exports;}
const intl={'next-intl/server':{getTranslations:async()=>key=>key}};
const cache={'next/cache':{revalidatePath(){},revalidateTag(){}}};

test('verification endpoint denies a member before reading project data; admin must supply reviewed revision',async()=>{
 for(const admin of [false,true]){const calls=[];const api=load('../app/api/projects/[id]/verify/route.ts',{...intl,...cache,'@/lib/guards':{requireAdmin:async()=>admin?{userId:'real-admin'}:NextResponse.json({}, {status:403})},'@/lib/project-record':{isProjectId:()=>true},'@/lib/project-verification-server':{setProjectVerification:async input=>{calls.push(input);return{kind:'success',verified:true}}}});
 const missing=await api.POST({json:async()=>({verified:true})},{params:Promise.resolve({id})});assert.equal(missing.status,admin?400:403);assert.equal(calls.length,0);
 const response=await api.POST({json:async()=>({verified:true,expectedUpdatedAt:version,actorUserId:'forged'})},{params:Promise.resolve({id})});assert.equal(response.status,admin?200:403);if(admin)assert.equal(calls[0].actorUserId,'real-admin');
 }
});

test('verification is revision-bound, preserves metadata and refuses a missing audit receipt',async()=>{
 for(const mode of ['ok','stale','audit-failed','raced']){const writes=[],audit=[];const db=createClient('https://fixture.invalid','fixture',{auth:{persistSession:false},global:{fetch:async(input,init)=>{const url=new URL(input);if(init.method==='PATCH'){writes.push({url,body:JSON.parse(init.body)});return Response.json(mode==='raced'?[]:[{id,updated_at:'2026-11-13T13:00:00+00:00'}]);}return Response.json([{id,updated_at:version,metadata:{media_rights:{keep:true},project_details:{logline:'Preserve me'}}}]);}}});
 const helper=load('./project-verification-server.ts',{'@/lib/db':{db},'@/lib/admin-audit':{startAdminAudit:async input=>{audit.push(input);return mode==='audit-failed'?null:'receipt'},finishAdminAudit:async()=>true}});
 const result=await helper.setProjectVerification({projectId:id,actorUserId:'admin',verified:true,reason:'Reviewed sources',expectedUpdatedAt:mode==='stale'?'old':version});
 assert.equal(result.kind,mode==='ok'?'success':mode==='audit-failed'?'error':'conflict');
 if(mode==='ok'){assert.equal(writes[0].url.searchParams.get('updated_at'),'eq.'+version);assert.equal(writes[0].body.metadata.project_details.logline,'Preserve me');assert.equal(writes[0].body.metadata.media_rights.keep,true);}
 if(mode==='stale'||mode==='audit-failed')assert.equal(writes.length,0);
 }
});

test('members can correct their own credit, never another account credit, and malformed roles do not write',async()=>{
 for(const own of [true,false]){const calls=[];const db=createClient('https://fixture.invalid','fixture',{auth:{persistSession:false},global:{fetch:async(input,init)=>{const url=new URL(input);calls.push({url,method:init.method,body:init.body?JSON.parse(init.body):null});return Response.json(init.method==='GET'?(own?[{id,user_id:'member',role:'Wrong role||Original note'}]:[]):[]);}}});
 const api=load('../app/api/project-credits/route.ts',{...intl,...cache,'@/lib/db':{db},'@/lib/auth':{requireAuth:async()=>({userId:'member'})},'@clerk/nextjs/server':{},'@/lib/trust':{},'@/lib/project-media-rights':{},'@/lib/rateLimit':{}});
 assert.equal((await api.PATCH({json:async()=>({id,role:42})})).status,400);assert.equal(calls.length,0);
 const response=await api.PATCH({json:async()=>({id,role:'Art Director||Original note',user_id:'forged'})});assert.equal(response.status,own?200:404);
 for(const call of calls)assert.equal(call.url.searchParams.get('user_id'),'eq.member');
 assert.equal(calls.filter(call=>call.method==='PATCH').length,own?1:0);
 }
});
