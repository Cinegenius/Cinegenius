import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
import {createTranslator} from 'next-intl';
import * as rights from './project-media-rights.ts';
import * as drafts from './project-drafts.ts';
const require=createRequire(import.meta.url);const {NextRequest,NextResponse}=require('next/server');
const original='/api/media/user_Own/0123456789abcdef0123456789abcdef.webp';
const project={id:'own-project',title:'Own project',created_by:'user_Own',poster_url:original,images:[original,'https://own-test.invalid/second.jpg'],metadata:{private_note:'never expose'}};
const permission={confirmed:true,basis:'permission',holder:'Own test film company',source:'Own test written permission',credit:'© Own test film company'};
const grant=()=>rights.projectMediaGrant(project,permission,'user_Own','2026-10-30T12:00:00Z');
function load(file,mocks){const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const mod={exports:{}};new Function('require','module','exports',source)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);return mod.exports;}
function fixture({allowed=true,media=true}={}){
 const calls=[];let published=null;const draft={id:'own-draft',user_id:'user_Own',source_project_id:null,published_project_id:null,draft_data:{title:'Own project',type:'Kurzfilm',...(media?{poster_url:original}:{})}};
 const db=createClient('https://fixture.invalid','test-only-key',{auth:{persistSession:false},global:{fetch:async(input,init)=>{const url=new URL(input);const method=init?.method??'GET';const body=init?.body?JSON.parse(init.body):null;calls.push({url,method,body});let data=[];if(url.pathname.endsWith('/project_drafts')&&method==='GET')data=[draft];if(url.pathname.endsWith('/projects')&&method==='POST'){published=body;data={id:'own-published'}};return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}})}}});
 const t=createTranslator({locale:'de',messages:JSON.parse(readFileSync(new URL('../messages/de.json',import.meta.url),'utf8')),namespace:'ProjectMediaRights'});
 const mocks={'@/lib/db':{db},'@/lib/auth':{requireAuth:async()=>allowed?{userId:'user_Own'}:NextResponse.json({error:'Forbidden'},{status:403})},'@/lib/project-drafts':drafts,'@/lib/project-media-rights':rights,'next-intl/server':{getTranslations:async()=>t},'next/cache':{revalidatePath:()=>{},revalidateTag:()=>{}}};
 return {api:load('../app/api/project-drafts/[id]/publish/route.ts',mocks),calls,published:()=>published};
}
const req=body=>new NextRequest('https://fixture.invalid/api/project-drafts/own/publish',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const context={params:Promise.resolve({id:'own-draft'})};
test('existing project artwork without a recorded permission is removed from public projections without mutating originals',()=>{
 const copy=structuredClone(project);const output=rights.publicProjectMedia(project);
 assert.equal(output.poster_url,null);assert.deepEqual(output.images,[]);assert.doesNotMatch(JSON.stringify(output),/private_note|created_by|0123456789|second.jpg/);assert.deepEqual(project,copy);assert.equal(output.title,project.title);
});
test('confirmation requires a recognised basis, real holder and permission reference; actor/time are server supplied',()=>{
 for(const value of [{...permission,confirmed:false},{...permission,basis:'imdb'},{...permission,holder:''},{...permission,source:''}])assert.equal(rights.projectMediaGrant(project,value,'user_Own'),null);
 const stamped=rights.projectMediaGrant(project,{...permission,confirmed_by:'other',confirmed_at:'invented'},'user_Own','server-time');assert.equal(stamped.confirmed_by,'user_Own');assert.equal(stamped.confirmed_at,'server-time');assert.deepEqual(stamped.urls,[original,'https://own-test.invalid/second.jpg']);
});
test('grant displays only its specific images, follows current ownership and hides private evidence',()=>{
 const licensed={...project,metadata:{media_rights:grant()}};
 const output=rights.publicProjectMedia(licensed);assert.equal(output.poster_url,original);assert.equal(output.image_credit,permission.credit);assert.doesNotMatch(JSON.stringify(output),/written permission|confirmed_by|metadata|created_by/);
 assert.equal(rights.publicProjectMedia({...licensed,poster_url:'https://unlicensed.invalid/replacement.jpg'}).poster_url,null);
 assert.equal(rights.publicProjectMedia({...licensed,created_by:'new-owner'}).poster_url,null);
 const credits=rights.publicProjectCredits([{projects:project}]);assert.equal(credits[0].projects.poster_url,null);
});
test('draft sanitization preserves the declaration fields but cannot set trusted media metadata directly',()=>{
 const data=drafts.sanitizeProjectDraftData({title:'Own',mediaRights:permission,metadata:{media_rights:grant()},created_by:'other'});assert.deepEqual(data,{title:'Own',mediaRights:permission});
});
test('publication refuses unconfirmed pictures before writing any public data',async()=>{
 const app=fixture();const result=await app.api.POST(req({}),context);assert.equal(result.status,400);assert.equal(app.published(),null);assert.ok(app.calls.every(call=>call.method==='GET'));
});
test('a project remains publishable without images and therefore without any image declaration',async()=>{
 const app=fixture({media:false});const result=await app.api.POST(req({}),context);assert.equal(result.status,200);assert.equal(app.published().poster_url,null);assert.deepEqual(app.published().images,[]);
});
test('an authorised owner publishes a URL-bound declaration without allowing a forged actor',async()=>{
 const app=fixture();const result=await app.api.POST(req({mediaRights:{...permission,confirmed_by:'other'}}),context);assert.equal(result.status,200);const saved=app.published().metadata.media_rights;assert.equal(saved.confirmed_by,'user_Own');assert.deepEqual(saved.urls,[original]);assert.ok(saved.confirmed_at);
});
test('unauthorised publication is denied before any database access',async()=>{
 const app=fixture({allowed:false});assert.equal((await app.api.POST(req({mediaRights:permission}),context)).status,403);assert.equal(app.calls.length,0);
});
test('new rights instructions are present in all supported language catalogues',()=>{
 const expected=Object.keys(JSON.parse(readFileSync(new URL('../messages/de.json',import.meta.url),'utf8')).ProjectMediaRights).sort();
 for(const locale of ['de','en','es','it','cs','hu']){const copy=JSON.parse(readFileSync(new URL('../messages/'+locale+'.json',import.meta.url),'utf8')).ProjectMediaRights;assert.deepEqual(Object.keys(copy).sort(),expected);for(const value of Object.values(copy))assert.ok(typeof value==='object'||value.trim());}
});
