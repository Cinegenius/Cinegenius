import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {publicProjectCredits} from './project-media-rights.ts';
const require=createRequire(import.meta.url),{NextResponse}=require('next/server');
function fixture({guest=false,claimed=true}={}) {
 const queries=[],lookups=[];let visible=false;
 const person={id:'person',name:'Private identity',slug:'old-alias',bio:'Private bio',created_by:'private-creator',claimed_by:claimed?'owner':null};
 const db={from(table){queries.push(table);let selection='';const result=()=>({data:table==='unclaimed_profiles'?Object.fromEntries(Object.entries(person).filter(([key])=>selection.split(',').map(field=>field.trim()).includes(key))):table==='profiles'?{slug:'current-alias'}:[],error:null});const q={select(value){selection=value;assert.ok(!value.includes('*'),'person and credit reads must use explicit fields');return q;}};for(const method of ['eq','order'])q[method]=()=>q;q.maybeSingle=async()=>result();q.then=(a,b)=>Promise.resolve(result()).then(a,b);return q;}};
 const deps={
  'next/server':{NextResponse},'@/lib/db':{db},
  '@/lib/auth':{requireAuth:async()=>guest?NextResponse.json({error:'unauthorized'},{status:401}):{userId:'viewer'}},
  '@clerk/nextjs/server':{auth:async()=>({userId:guest?null:'viewer'})},
  'next-intl/server':{getTranslations:async()=>key=>key},
  '@/lib/linked-profile-access':{visibleLinkedProfileIds:async(ids,viewer)=>{lookups.push({ids,viewer});return new Set(visible?ids:[]);}},
  '@/lib/project-media-rights':{publicProjectCredits},
  'next/navigation':{notFound(){throw new Error('NOT_FOUND')},redirect(url){throw new Error('REDIRECT:'+url)}},
  './PersonView':{default:()=>null},'react/jsx-runtime':require('react/jsx-runtime')
 };
 function load(path){const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,mod={exports:{}};new Function('require','module','exports',code)(name=>{assert.ok(Object.hasOwn(deps,name),name);return deps[name]},mod,mod.exports);return mod.exports;}
 return {load,queries,lookups,setVisible:value=>{visible=value}};
}
const params={params:Promise.resolve({slug:'old-alias'})};
test('any signed-in identity claim is rejected before reading or changing persons or credits',async()=>{
 const f=fixture(),route=f.load('app/api/unclaimed-profiles/[slug]/claim/route.ts');
 const response=await route.POST(new Request('https://www.cinegenius.co/api/unclaimed-profiles/old-alias/claim',{method:'POST'}),params);
 assert.equal(response.status,403);assert.equal((await response.json()).error,'claimReview');assert.match(response.headers.get('cache-control'),/no-store/);assert.deepEqual(f.queries,[]);
});
test('guest claims and direct API reads perform no data lookup',async()=>{
 const f=fixture({guest:true});
 for(const [path,method] of [['app/api/unclaimed-profiles/[slug]/claim/route.ts','POST'],['app/api/unclaimed-profiles/[slug]/route.ts','GET']])assert.equal((await f.load(path)[method](null,params)).status,401);
 assert.deepEqual(f.queries,[]);
});
test('old person API alias rechecks visibility on every request and removes the account identifier',async()=>{
 const f=fixture(),route=f.load('app/api/unclaimed-profiles/[slug]/route.ts');
 assert.equal((await route.GET(null,params)).status,404);assert.deepEqual(f.queries,['unclaimed_profiles']);
 f.setVisible(true);const response=await route.GET(null,params),body=await response.json();assert.equal(response.status,200);assert.equal(body.profile.name,'Private identity');assert.ok(!('claimed_by' in body.profile));assert.ok(!('created_by' in body.profile));assert.match(response.headers.get('cache-control'),/no-store/);
 f.setVisible(false);assert.equal((await route.GET(null,params)).status,404);assert.equal(f.lookups.length,3);
});
test('hidden claimed identity has no old-page metadata, redirect, credits or rendered fallback',async()=>{
 const f=fixture(),page=f.load('app/person/[slug]/page.tsx');
 assert.deepEqual(await page.generateMetadata(params),{});await assert.rejects(()=>page.default(params),/NOT_FOUND/);assert.ok(f.queries.every(table=>table==='unclaimed_profiles'));
 f.setVisible(true);assert.match((await page.generateMetadata(params)).title,/Private identity/);await assert.rejects(()=>page.default(params),/REDIRECT:\/profile\/current-alias/);
 f.setVisible(false);assert.deepEqual(await page.generateMetadata(params),{});
});
test('an unclaimed person remains available without inventing an account or granting ownership',async()=>{
 const f=fixture({claimed:false}),route=f.load('app/api/unclaimed-profiles/[slug]/route.ts');
 assert.equal((await route.GET(null,params)).status,200);assert.equal(f.lookups.length,0);
});
