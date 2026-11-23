import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import { accountDirectoryRow, readAccountDirectory, selectDirectoryAccounts } from './admin-account-directory.ts';
import { intlServerFor } from './i18n-test-fixture.mjs';
import * as directory from './admin-account-directory.ts';
const require = createRequire(import.meta.url);
const {NextRequest, NextResponse} = require('next/server');
const user = (id, saved={}) => ({id,firstName:null,lastName:null,primaryEmailAddressId:'p',emailAddresses:[{id:'p',emailAddress:id+'@example.invalid'}],createdAt:100,lastSignInAt:null,privateMetadata:{cinegeniusOnboarding:saved,secret:'never-return'}});
const profile = {user_id:'a',display_name:'A Profile',slug:'a',avatar_url:null,location:'Berlin',positions:['Gaffer'],role:null,profile_type:'lighting',profile_types:['lighting'],verified:true};
const select=(rows, filters={})=>selectDirectoryAccounts(rows,{search:'',area:'all',setup:'all',sort:'newest',locale:'de',...filters});

test('area membership combines actual profile types, saved goals and real company ownership without duplicates',()=>{
 const row=accountDirectoryRow(user('a',{intent:'crew'}),{...profile,profile_types:['lighting','equipment','studio']},null,true);
 assert.deepEqual(row.areas,['crew','marketplace','locations','companies']); assert.equal(row.profileVerified,true);
 for (const area of row.areas) assert.equal(select([row],{area}).length,1);
 assert.equal(select([row]).length,1);assert.equal(select([row],{area:'search'}).length,0);
 assert.doesNotMatch(JSON.stringify(row),/privateMetadata|secret|never-return/);
});
test('provider-only profiles never acquire a crew category, and unfinished goals remain findable',()=>{
 for(const type of ['equipment','vehicle','props','location','studio']) {
  const row=accountDirectoryRow(user(type),{...profile,positions:[],role:null,profile_type:type,profile_types:[type],verified:false},null,false);
  assert.deepEqual(row.areas,[['location','studio'].includes(type)?'locations':'marketplace']);
  assert.equal(row.profileVerified,false);
 }
 const open=accountDirectoryRow(user('pending',{quickStart:{intents:['equipment'],name:'Saved Member',step:'intro'}}),null,null,false);
 assert.deepEqual(open.areas,['marketplace']);assert.equal(open.needsSetup,true);assert.equal(open.name,'Saved Member');assert.equal(open.profileStatus,'missing');
 assert.equal(select([open],{setup:'open'}).length,1);assert.equal(select([open],{setup:'complete'}).length,0);
});
test('existing search accounts stay completed and searchable; placeholder search and empty accounts are unassigned',()=>{
 const saved=accountDirectoryRow(user('legacy',{intent:'search',setupComplete:true}),null,null,false);
 assert.deepEqual(saved.areas,['search']);assert.equal(saved.needsSetup,false);
 for(const progress of [{},{intent:'search',quickStart:{intents:[],step:'name'}}])assert.deepEqual(accountDirectoryRow(user('empty',progress),null,null,false).areas,['unassigned']);
 const mixed=accountDirectoryRow(user('legacy',{intent:'search',setupComplete:true}),profile,'private',false);
 assert.deepEqual(mixed.areas,['crew','search']);assert.equal(mixed.profileUrl,null);
});
test('search, setup and area intersect; stable sorts do not mutate the source or count null logins as active',()=>{
 const rows=[accountDirectoryRow(user('b',{intent:'crew',quickStart:{intents:['crew'],name:'Zoe'}}),null,null,false),accountDirectoryRow({...user('a'),createdAt:50,lastSignInAt:200},profile,null,true)];
 assert.deepEqual(select(rows,{search:'A PROFILE',area:'crew',setup:'complete'}).map(x=>x.userId),['a']);
 assert.deepEqual(select(rows,{search:'b@example.invalid'}).map(x=>x.userId),['b']);
 assert.deepEqual(select(rows,{sort:'name'}).map(x=>x.userId),['a','b']);
 assert.deepEqual(select(rows,{sort:'oldest'}).map(x=>x.userId),['a','b']);
 assert.deepEqual(select(rows,{sort:'active'}).map(x=>x.userId),['a','b']);
 assert.deepEqual(rows.map(x=>x.userId),['b','a']);
});
test('global filtering includes matches beyond the first 100 and accepts an empty directory',async()=>{
 const pages=[];const all=Array.from({length:201},(_,i)=>accountDirectoryRow(user('u'+i,{intent:i===200?'equipment':'crew'}),null,null,false));
 const rows=await readAccountDirectory(async page=>{pages.push(page);return{accounts:all.slice((page-1)*100,page*100),total:all.length,page,pageSize:100};});
 assert.deepEqual(pages,[1,2,3]);assert.equal(select(rows,{area:'marketplace'}).length,1);assert.equal(select(rows,{area:'crew'}).length,200);
 assert.deepEqual(await readAccountDirectory(async()=>({accounts:[],total:0,page:1,pageSize:100})),[]);
});
for(const issue of ['truncated','duplicate','changing-total','wrong-page','too-large','network'])test('directory refuses misleading partial success: '+issue,async()=>{
 const rows=Array.from({length:100},(_,i)=>accountDirectoryRow(user('u'+i),null,null,false));
 await assert.rejects(readAccountDirectory(async page=>{
  if(issue==='network'&&page===2)throw Error('offline');
  return{accounts:page===1?(issue==='truncated'?rows.slice(0,50):rows):[issue==='duplicate'?rows[0]:{...rows[0],userId:'last'}],total:issue==='too-large'?10001:issue==='changing-total'&&page===2?102:101,page:issue==='wrong-page'?2:page,pageSize:100};
 }));
});
function apiFixture({authorized=true, databaseError=false,clerkError=false,users=[user('a')],companies=[]}={}) {
 const reads=[],clerkCalls=[];
 const db=createClient('https://fixture.invalid','fixture-key',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const url=new URL(input);reads.push({url,method:init?.method??'GET'});const table=url.pathname.split('/').at(-1);
  let data=table==='profiles'?[profile]:table==='user_settings'?[{user_id:'a',profile_visibility:'private'}]:companies;
  if(table==='companies')data=data.slice(Number(url.searchParams.get('offset')??0),Number(url.searchParams.get('offset')??0)+1000);
  return new Response(JSON.stringify(databaseError?{message:'private failure'}:data),{status:databaseError?500:200});
 }}});
 const mocks={'@/lib/db':{db},'@/lib/requireAdmin':{requireAdmin:async()=>authorized?{userId:'admin'}:NextResponse.json({error:'Forbidden'},{status:403})},'@clerk/nextjs/server':{clerkClient:async()=>({users:{getUserList:async args=>{clerkCalls.push(args);if(clerkError)throw Error('secret');return{data:users,totalCount:users.length};}}})},'@/lib/admin-account-directory':directory,'next-intl/server':intlServerFor()};
 const source=ts.transpileModule(readFileSync(new URL('../app/api/admin/account-directory/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',source)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);
 return{reads,clerkCalls,get:page=>mod.exports.GET(new NextRequest('https://fixture.invalid/api/admin/account-directory?page='+page))};
}
test('directory denies unauthorized reads before Clerk or database access',async()=>{
 const f=apiFixture({authorized:false});assert.equal((await f.get(1)).status,403);assert.equal(f.reads.length,0);assert.equal(f.clerkCalls.length,0);
});
test('directory exposes only minimal scoped rows, no drafts, media documents or mutations',async()=>{
 const f=apiFixture({companies:[{id:'c',owner_user_id:'a'}]});const response=await f.get(1);const body=await response.json();
 assert.equal(response.status,200);assert.equal(body.accounts[0].profileUrl,null);assert.deepEqual(body.accounts[0].areas,['crew','companies']);
 for(const header of ['cache-control','cdn-cache-control','vercel-cdn-cache-control'])assert.match(response.headers.get(header),/no-store/);
 assert.doesNotMatch(JSON.stringify(body),/privateMetadata|never-return|secret|content|drafts/);
 assert.ok(f.reads.every(r=>r.method==='GET'&&r.url.searchParams.get(r.url.pathname.endsWith('companies')?'owner_user_id':'user_id')==='in.(a)'));
 assert.equal(f.clerkCalls[0].limit,100);
});
test('company ownership follows database pages and does not silently truncate at 1000',async()=>{
 const f=apiFixture({companies:Array.from({length:1001},(_,i)=>({id:String(i),owner_user_id:'a'}))});assert.equal((await f.get(1)).status,200);assert.equal(f.reads.filter(r=>r.url.pathname.endsWith('/companies')).length,2);
});
for(const config of [{databaseError:true},{clerkError:true}])test('directory read failure is a private error, never a zero-count result',async()=>{
 const f=apiFixture(config);const response=await f.get(1);assert.equal(response.status,503);const body=await response.json();assert.ok(body.error);assert.equal(body.accounts,undefined);assert.doesNotMatch(JSON.stringify(body),/secret|private failure/);
});
test('empty and invalid directory pages do not perform unnecessary database reads',async()=>{
 const f=apiFixture({users:[]});assert.equal((await f.get(1)).status,200);assert.equal(f.reads.length,0);
 for(const page of [0,-1,101,'NaN',1.5])assert.equal((await f.get(page)).status,400);
 assert.equal(f.clerkCalls.length,1);
});
