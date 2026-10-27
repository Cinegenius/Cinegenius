import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

function entry({ userId='visitor', company={id:'company-test',slug:'test-firma',name:'Testfirma',owner_user_id:'responsible-account',published:true}, error=null }={}) {
  const query={select(){return this},eq(){return this},async maybeSingle(){return {data:company,error}}};
  const mocks={
    '@clerk/nextjs/server':{auth:async()=>({userId})},
    'next/navigation':{redirect:url=>{throw Object.assign(new Error('redirect'),{url})},notFound:()=>{throw new Error('not-found')}},
    'next-intl/server':{getTranslations:async()=>key=>key},
    '@/lib/db':{db:{from:table=>{assert.equal(table,'companies');return query}}},
    'react/jsx-runtime':{jsx:(_,props)=>props},
  };
  const source=readFileSync('app/companies/[slug]/message/page.tsx','utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};new Function('require','module','exports',compiled)(name=>mocks[name],mod,mod.exports);
  return ()=>mod.exports.default({params:Promise.resolve({slug:'test-firma'})});
}

test('company messaging requires sign-in and retains the intended action',async()=>{
  await assert.rejects(entry({userId:null})(),error=>error.url==='/sign-in?redirect_url=%2Fcompanies%2Ftest-firma%2Fmessage');
});
test('company contact resolves its responsible account without requiring a public person profile',async()=>{
  await assert.rejects(entry()(),error=>{
    const url=new URL(error.url,'https://cinegenius.co');
    assert.equal(url.pathname,'/messages');assert.equal(url.searchParams.get('to'),'responsible-account');
    assert.equal(url.searchParams.get('company_slug'),'test-firma');
    assert.equal(url.searchParams.has('company_label'),false);return true;
  });
});
test('private and missing companies cannot be used to resolve a contact; technical failures are not 404',async()=>{
  await assert.rejects(entry({company:null})(),/not-found/);
  await assert.rejects(entry({company:{published:false,owner_user_id:'other'}})(),/not-found/);
  await assert.rejects(entry({error:{message:'database unavailable'}})(),/unavailable/);
});
test('owner is directed to management, missing responsible account is explained without guessing',async()=>{
  await assert.rejects(entry({userId:'responsible-account'})(),error=>error.url==='/company-dashboard');
  const result=await entry({company:{slug:'test-firma',name:'Testfirma',published:true,owner_user_id:null}})();
  assert.equal(result.role,'status');assert.equal(result.children,'noContact');
});

test('chat company identity is validated server-side against the recipient, not a supplied display name',()=>{
  const route=readFileSync('app/api/companies/contact-context/route.ts','utf8');
  assert.match(route,/await requireAuth\(\)/);
  assert.match(route,/\.eq\("owner_user_id", recipient\)\.eq\("published", true\)/);
  assert.match(route,/private, no-store/);
  const client=readFileSync('app/messages/page.tsx','utf8');
  assert.doesNotMatch(client,/searchParams.get\("company_label"\)/);
  assert.match(client,/\/api\/companies\/contact-context/);
});
