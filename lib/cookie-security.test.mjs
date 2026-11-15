import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {NextRequest,NextResponse} from 'next/server.js';
import {SUPPORTED_LOCALES,isAppLocale} from './i18n/locales.ts';

test('browser language preferences use Secure on HTTPS and remain usable in local HTTP previews',()=>{
 const source=readFileSync(new URL('../components/LanguageSwitcher.tsx',import.meta.url),'utf8');
 const ast=ts.createSourceFile('LanguageSwitcher.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const fn=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='persistLocaleCookie');
 assert.ok(fn);
 const code=ts.transpileModule(fn.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 for(const protocol of ['https:','http:']){
  const document={cookie:''};const persist=new Function('window','document',`${code};return persistLocaleCookie;`)({location:{protocol}},document);
  for(const locale of SUPPORTED_LOCALES){
   persist(locale);assert.match(document.cookie,new RegExp(`^cg_locale=${locale};`));
   assert.equal(/; Secure(?:;|$)/.test(document.cookie),protocol==='https:');
   assert.match(document.cookie,/samesite=lax/);
  }
 }
});

test('locale endpoint secures production cookies and persist-only saves do not overwrite the browser preference',async()=>{
 const code=ts.transpileModule(readFileSync(new URL('../app/api/locale/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const deps={'next/server':{NextRequest,NextResponse},'@/lib/rateLimit':{rateLimit:async()=>({allowed:true})},'@clerk/nextjs/server':{auth:async()=>({userId:null})},'@/lib/i18n/locales':{isAppLocale},'next-intl/server':{getTranslations:async()=>key=>key}};
 for(const environment of ['production','development']){
  const m={exports:{}};new Function('require','module','exports','process',code)(name=>{assert.ok(Object.hasOwn(deps,name),name);return deps[name]},m,m.exports,{env:{NODE_ENV:environment}});
  for(const persistOnly of [false,true]){
   const result=await m.exports.POST(new NextRequest('https://www.cinegenius.co/api/locale',{method:'POST',body:JSON.stringify({locale:'it',persistOnly})}));
   assert.equal(result.status,200);
   const cookie=result.headers.get('set-cookie');
   if(persistOnly){assert.equal(cookie,null);continue;}
   assert.match(cookie,/cg_locale=it/);assert.match(cookie,/SameSite=lax/i);
   assert.equal(/; Secure(?:;|$)/i.test(cookie),environment==='production');
  }
 }
});
