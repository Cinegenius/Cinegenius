import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PGlite } from '@electric-sql/pglite';
import * as logo from './company-logo.ts';
import * as media from './company-media.ts';
import * as roles from './company-roles.ts';
import * as catering from './catering-taxonomy.ts';
const require = createRequire(import.meta.url);
function load(file, mocks) {
 const compiled=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',compiled)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);return mod.exports;
}

test('auto is a deterministic light surface; explicit dark and invalid legacy values remain safe',()=>{
 assert.deepEqual(logo.COMPANY_LOGO_BACKGROUNDS,['auto','light','dark']);
 for(const value of [undefined,null,'old-value',{},'light','auto'])assert.equal(logo.companyLogoSurface(value),'#f3f3f0');
 assert.equal(logo.companyLogoSurface('dark'),'#171b25');
 for(const value of ['',null,{},1,'WHITE'])assert.equal(logo.isCompanyLogoBackground(value),false);
});
test('shared renderer preserves the original URL, contain fit and reserved box with no color filters or overlays',()=>{
 const Component=load('../components/CompanyLogo.tsx',{'next/image':{default:({onError,...props})=>React.createElement('img',props)},'next-intl':{useTranslations:()=>key=>key},'@/lib/company-logo':logo}).default;
 for(const background of logo.COMPANY_LOGO_BACKGROUNDS){
  const html=renderToStaticMarkup(React.createElement(Component,{src:'/own-transparent-logo.png',name:'Test company',background,className:'h-24 w-full'}));
  assert.match(html,new RegExp(`background-color:${logo.companyLogoSurface(background)}`));assert.match(html,/object-contain/);assert.match(html,/h-24 w-full/);assert.match(html,/src="\/own-transparent-logo.png"/);assert.doesNotMatch(html,/object-cover|invert|brightness|opacity|overlay|absolute inset/);
 }
 const missing=renderToStaticMarkup(React.createElement(Component,{src:null,name:'No logo',className:'h-24 w-full'}));assert.match(missing,/role="img"/);assert.doesNotMatch(missing,/<img/);
});

test('small compatible database migration preserves original files and persists valid settings',async()=>{
 const pg=new PGlite();try{
  await pg.exec("create table companies(id text primary key,logo_url text);insert into companies values('own','unchanged-original.png')");
  const sql=readFileSync(new URL('../supabase/migrations/20261027150000_company_logo_background.sql',import.meta.url),'utf8');
  await pg.exec(sql);await pg.exec(sql);
  assert.equal((await pg.query('select logo_background from companies')).rows[0].logo_background,'auto');
  for(const background of logo.COMPANY_LOGO_BACKGROUNDS){await pg.query('update companies set logo_background=$1',[background]);assert.equal((await pg.query('select logo_background from companies')).rows[0].logo_background,background);}
  await assert.rejects(pg.query("update companies set logo_background='unsafe'"));
  assert.equal((await pg.query('select logo_url from companies')).rows[0].logo_url,'unchanged-original.png');
 }finally{await pg.close();}
});

function companyApi(){
 let userId='editor',canEdit=true,row=null,writes=[];
 const db={from(table){let filters={},value=null;const q={select(){return q},eq(k,v){filters[k]=v;return q},in(){return q},ilike(){return Promise.resolve({data:[],error:null})},order(){return q},limit(){return Promise.resolve({data:row?[row]:[],error:null})},update(v){value=v;return q},insert(v){value=v;return q},upsert(){return Promise.resolve({error:null})},async single(){if(value){row={id:'own-company',owner_user_id:'owner',slug:'test-company',...row,...value};writes.push(value);}return{data:row,error:null}},then(resolve){if(table==='profiles')return Promise.resolve({error:null}).then(resolve);return q.single().then(resolve)}};return q;}};
 const api=load('../app/api/companies/route.ts',{'@/lib/db':{db},'@/lib/auth':{requireAuth:async()=>userId?{userId}:require('next/server').NextResponse.json({}, {status:401})},'next/cache':{revalidatePath(){},revalidateTag(){}},'next-intl/server':{getTranslations:async()=>key=>key},'@/lib/company-logo':logo,'@/lib/company-media':media,'@/lib/company-roles':roles,'@/lib/catering-taxonomy':catering,'@/lib/company-access':{getCompanyAccess:async()=>canEdit?{role:'editor'}:null}});
 const request=body=>new(require('next/server').NextRequest)('https://fixture.invalid/api/companies',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Own Test Company',city:'Test City',...body})});
 return {post:body=>api.POST(request(body)),row:()=>row,writes,deny(){canEdit=false},signOut(){userId=null}};
}
test('actual company API saves, reloads and changes preference; older editors do not reset it',async()=>{
 const api=companyApi();let response=await api.post({logo_background:'dark'});assert.equal(response.status,200);assert.equal((await response.json()).data.logo_background,'dark');
 response=await api.post({id:'own-company',logo_background:'light'});assert.equal(response.status,200);assert.equal((await response.json()).data.logo_background,'light');
 response=await api.post({id:'own-company'});assert.equal(response.status,200);assert.equal((await response.json()).data.logo_background,'light');
 assert.equal(Object.hasOwn(api.writes.at(-1),'logo_background'),false);
 const defaults=companyApi();assert.equal((await defaults.post({})).status,200);assert.equal(defaults.row().logo_background,'auto');
});
test('actual company API rejects invalid options and unauthorized changes without a write',async()=>{
 const api=companyApi();assert.equal((await api.post({logo_background:'arbitrary-css'})).status,400);assert.equal(api.writes.length,0);
 await api.post({logo_background:'light'});const before=api.writes.length;api.deny();assert.equal((await api.post({id:'own-company',logo_background:'dark'})).status,403);assert.equal(api.writes.length,before);assert.equal(api.row().logo_background,'light');
 api.signOut();assert.equal((await api.post({id:'own-company',logo_background:'dark'})).status,401);assert.equal(api.writes.length,before);
});


test('background selection renders in all six locales with one accessible radio group',()=>{
 const Component=load('../components/CompanyLogoBackgroundSelect.tsx',{'next-intl':require('next-intl'),'@/lib/company-logo':logo}).default;
 const {NextIntlClientProvider}=require('next-intl');
 for(const locale of ['de','en','es','it','cs','hu']){
  const messages=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'));
  const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages,timeZone:'Europe/Berlin'},React.createElement(Component,{value:'dark',onChange(){}})));
  assert.equal((html.match(/type="radio"/g)||[]).length,3);assert.match(html,/<fieldset/);assert.ok(html.includes(messages.companyLogo.dark));assert.ok(html.includes(messages.companyLogo.hint));
 }
});
