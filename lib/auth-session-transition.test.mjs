import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator} from 'next-intl';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const code=ts.transpileModule(readFileSync(new URL('../components/AuthSessionBoundary.tsx',import.meta.url),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
}).outputText;

function fixture(locale='de'){
 let state={isLoaded:false,session:null},mounts=0;
 const messages=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'));
 const mocks={
  '@clerk/nextjs':{useSession:()=>state},
  'next-intl':{useTranslations:namespace=>createTranslator({locale,messages,namespace})},
 };
 const mod={exports:{}};
 new Function('require','module','exports',code)(name=>mocks[name]??require(name),mod,mod.exports);
 const Boundary=mod.exports.default;
 function PrivatePage(){mounts++;return React.createElement('a',{href:'/profile'},'Own private content')}
 function render(initialSessionId='own-session-a'){
  return renderToStaticMarkup(React.createElement(Boundary,{initialSessionId},React.createElement(PrivatePage)));
 }
 return {setState:value=>{state=value},render,getMounts:()=>mounts,messages};
}

for(const locale of ['de','en','es','it','cs','hu']){
 test(`logout gap never mounts the old authenticated page as a guest: ${locale}`,()=>{
  const f=fixture(locale);
  f.setState({isLoaded:true,session:null});
  const html=f.render();
  assert.equal(f.getMounts(),0);
  assert.ok(!html.includes('Own private content'));
  assert.ok(!html.includes('href="/profile"'));
  assert.ok(html.includes('role="status"'));
  assert.ok(html.includes(f.messages.SessionTransition.loading));
  assert.ok(html.includes(f.messages.SessionTransition.home));
  // A native link works even if the SDK's navigation failed; it starts no
  // automatic Next.js prefetch and makes no authorization decision itself.
  assert.ok(html.includes('href="/"'));
  assert.equal(f.render(),html);
  assert.equal(f.getMounts(),0);
 });
}
test('ordinary guests, same-session hydration, and active account changes still render their supplied page',()=>{
 const f=fixture();
 assert.ok(f.render().includes('Own private content'));
 f.setState({isLoaded:true,session:{id:'own-session-a'}});
 assert.ok(f.render().includes('Own private content'));
 f.setState({isLoaded:true,session:{id:'own-session-b'}});
 assert.ok(f.render().includes('Own private content'));
 f.setState({isLoaded:true,session:null});
 assert.ok(f.render(null).includes('Own private content'));
 assert.equal(f.getMounts(),4);
});
test('server reconciliation releases the transition without a timer, reload, or client-side status override',()=>{
 const f=fixture();f.setState({isLoaded:true,session:null});
 assert.ok(f.render().includes('role="status"'));assert.equal(f.getMounts(),0);
 assert.ok(f.render(null).includes('Own private content'));assert.equal(f.getMounts(),1);
 // If the client session is restored after an unsuccessful sign-out, the
 // still-authenticated tree can render again without forcing navigation.
 f.setState({isLoaded:true,session:{id:'own-session-a'}});
 assert.ok(f.render().includes('Own private content'));assert.equal(f.getMounts(),2);
});
