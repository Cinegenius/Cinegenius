import * as projectMediaRights from "./project-media-rights.ts";
import * as listingPricing from "./listing-price.ts";
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import { dragCoverPosition, profileCoverSettings, profileCoverStyle, validProfileFocalPoint } from './profile-cover.ts';
import * as compat from './profile-db-compat.ts';
import * as primaryOccupation from './primary-occupation.ts';
import * as crewOccupations from './crew-occupations.ts';
const require=createRequire(import.meta.url);
const {NextRequest,NextResponse}=require('next/server');

test('100% brightness is the original image, with no opacity multiplication',()=>{
 assert.deepEqual(profileCoverStyle({x:25,y:30,opacity:1,cover:{x:60,y:70}}),{objectPosition:'60% 70%',filter:'brightness(1)'});
 assert.equal(profileCoverStyle({opacity:.6}).filter,'brightness(0.6)');
 assert.equal(Object.hasOwn(profileCoverStyle({opacity:1}),'opacity'),false);
});
test('legacy portraits retain their focus while covers default to centered and malformed values remain bounded',()=>{
 assert.deepEqual(profileCoverSettings({x:10,y:90,opacity:.8}),{x:50,y:50,brightness:.8});
 assert.deepEqual(profileCoverSettings(null),{x:50,y:50,brightness:.4});
 assert.deepEqual(profileCoverSettings({cover:{x:-10,y:130},opacity:5}),{x:0,y:100,brightness:1});
 assert.equal(profileCoverSettings({opacity:NaN}).brightness,.4);
});
test('horizontal and vertical dragging tracks actual cover overflow and follows the pointer',()=>{
 assert.deepEqual(dragCoverPosition({x:50,y:50},{x:50,y:10},{width:200,height:200},{width:400,height:200}),{x:25,y:50});
 assert.deepEqual(dragCoverPosition({x:50,y:50},{x:10,y:50},{width:200,height:100},{width:200,height:300}),{x:50,y:25});
 assert.deepEqual(dragCoverPosition({x:50,y:50},{x:999,y:-999},{width:200,height:200},{width:400,height:200}),{x:0,y:50});
});
test('matching aspect ratios and not-yet-loaded images do not jump',()=>{
 assert.deepEqual(dragCoverPosition({x:30,y:40},{x:40,y:50},{width:200,height:100},{width:400,height:200}),{x:30,y:40});
 assert.deepEqual(dragCoverPosition({x:30,y:40},{x:40,y:50},{width:0,height:0},{width:400,height:200}),{x:30,y:40});
});
test('cover settings validate existing values and reject invalid coordinates or brightness',()=>{
 for(const value of [null,{x:50,y:33},{x:1,y:99,opacity:1,cover:{x:0,y:100}}]) assert.equal(validProfileFocalPoint(value),true);
 for(const value of [[],false,'bad',{x:NaN},{opacity:0},{opacity:2},{cover:{x:1}},{cover:{x:101,y:30}},{cover:{x:'50',y:50}}]) assert.equal(validProfileFocalPoint(value),false);
});

function load(source,dependencies) {
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const loaded={exports:{}};
 new Function('require','module','exports',compiled)(name=>Object.hasOwn(dependencies,name)?dependencies[name]:name==="@/lib/listing-price"?listingPricing:require(name),loaded,loaded.exports);
 return loaded.exports;
}
function fixture(signedIn=true) {
 const calls=[],invalidations=[];
 let saved={user_id:'user_me',display_name:'Testperson',slug:'testperson',avatar_url:'/api/media/user_me/0123456789abcdef0123456789abcdef.webp',profile_types:['camera_operator'],focal_point:{x:20,y:35,opacity:.4}};
 const db=createClient('https://fixture.invalid','fixture-only-key',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const url=new URL(input);calls.push({url,method:init.method});
  if(init.method==='PATCH') {
   assert.equal(url.searchParams.get('user_id'),'eq.user_me');
   saved={...saved,...JSON.parse(init.body)};
   return new Response(JSON.stringify({user_id:'user_me'}),{headers:{'content-type':'application/json'}});
  }
  return new Response(JSON.stringify(saved),{headers:{'content-type':'application/json'}});
 }}});
 const deps={
 '@/lib/project-media-rights':projectMediaRights,
 '@/lib/linked-profile-access':{visibleLinkedProfileIds:async ids=>new Set(ids)},
  '@/lib/crew-occupations':crewOccupations, '@/lib/primary-occupation':primaryOccupation, '@/lib/db':{db},'@/lib/auth':{requireAuth:async()=>signedIn?{userId:'user_me'}:NextResponse.json({error:'Anmeldung erforderlich'},{status:401})},
  '@clerk/nextjs/server':{},'next/cache':{revalidateTag:tag=>invalidations.push(tag),unstable_cache:fn=>fn},
  '@/lib/profile-types':{PROFILE_TYPE_LABELS:{},getPresetForType:()=>[]},'@/lib/profile-display':{normalizeProfileTypes:()=>['camera_operator']},
  '@/lib/profile-cover':{validProfileFocalPoint},'@/lib/profile-db-compat':compat,
  '@/lib/profile-views':{},'@/components/JsonLd':{},'./ProfileView':{},'@/lib/trust':{},'@/lib/contact-visibility':{},
 };
 const api=load(readFileSync(new URL('../app/api/profile/route.ts',import.meta.url),'utf8'),deps);
 const page=load(readFileSync(new URL('../app/profile/[slug]/page.tsx',import.meta.url),'utf8')+'\nexport { _getProfile as loadProfileForCoverTest };',deps);
 return {api,page,calls,invalidations};
}
function request(body){return new NextRequest('https://fixture.invalid/api/profile',{method:'PATCH',body:JSON.stringify(body),headers:{'content-type':'application/json'}});}

test('actual profile save and public reload retain independent cover position, brightness and portrait focus',async()=>{
 const app=fixture();
 const focal={x:20,y:35,opacity:1,cover:{x:15,y:85},card:{x:70,y:25,zoom:1.8}};
 assert.equal((await app.api.PATCH(request({focal_point:focal,user_id:'user_foreign'}))).status,200);
 const reloaded=await app.page.loadProfileForCoverTest('testperson');
 assert.deepEqual(reloaded.focal_point,focal);
 assert.equal(reloaded.avatar_url,'/api/media/user_me/0123456789abcdef0123456789abcdef.webp');
 assert.deepEqual(profileCoverStyle(reloaded.focal_point),{objectPosition:'15% 85%',filter:'brightness(1)'});
 assert.deepEqual(app.invalidations,['profiles']);
 assert.ok(app.calls.find(c=>c.method==='GET'&&c.url.searchParams.get('select').includes('focal_point')));
});
test('unsigned or invalid profile requests cannot persist cover settings',async()=>{
 const signedOut=fixture(false);
 assert.equal((await signedOut.api.PATCH(request({focal_point:{opacity:1}}))).status,401);assert.equal(signedOut.calls.length,0);
 const app=fixture();
 assert.equal((await app.api.PATCH(request({focal_point:{cover:{x:800,y:50}}}))).status,400);
 assert.equal((await app.api.POST(request({focal_point:{opacity:-1}}))).status,400);
 assert.equal(app.calls.length,0);
});
