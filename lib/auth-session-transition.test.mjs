import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator} from 'next-intl';
import ts from 'typescript';
import {SUPPORTED_LOCALES} from './i18n/locales.ts';

const require=createRequire(import.meta.url);
const code=ts.transpileModule(readFileSync(new URL('../components/AuthSessionBoundary.tsx',import.meta.url),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
}).outputText;

function fixture(locale='de',native=false,workspace=false){
 let state={isLoaded:false,session:undefined},mounts=0;
 const messages=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'));
 const mocks={
  '@clerk/nextjs':{useSession:()=>state,useClerk:()=>({loaded:state.clerkLoaded??false})},
  '@/lib/genie-conversation':{clearConversation(){assert.fail('Server rendering must not access browser conversation storage');}},
  '@/lib/use-native-app-appearance':{useNativeAppAppearance:()=>native},
  '@/lib/use-native-capability':{useNativeCapability:capability=>{assert.equal(capability,'workspace');return workspace;}},
  'next-intl':{useTranslations:namespace=>createTranslator({locale,messages,namespace})},
 };
 const mod={exports:{}};
 new Function('require','module','exports',code)(name=>mocks[name]??require(name),mod,mod.exports);
 const Boundary=mod.exports.default;
 function PrivatePage(){mounts++;return React.createElement('a',{href:'/profile'},'Own private content')}
 function render(initialSessionId='own-session-a'){
  return renderToStaticMarkup(React.createElement(Boundary,{initialSessionId},React.createElement(PrivatePage)));
 }
 return {setState:value=>{state=value},setPresentation:(appearance,bridge)=>{native=appearance;workspace=bridge;},render,getMounts:()=>mounts,messages};
}

for(const native of [false,true])for(const locale of SUPPORTED_LOCALES){
 test(`provisional Clerk sign-out removes the old page and retains the correct recovery: ${locale}, native=${native}`,()=>{
  const f=fixture(locale,native);f.setState({isLoaded:false,session:undefined,clerkLoaded:true});
  const html=f.render();
  assert.equal(f.getMounts(),0);
  assert.ok(html.includes(f.messages.SessionTransition.loading));
  assert.ok(!html.includes('href="/profile"'));
  assert.ok(html.includes(`href="${native?'/sign-in':'/'}"`));
  assert.ok(html.includes(native?f.messages.nav.signIn:f.messages.SessionTransition.home));
 });
 test(`logout gap never mounts the old authenticated page as a guest: ${locale}, native=${native}`,()=>{
  const f=fixture(locale,native);
  f.setState({isLoaded:true,session:null});
  const html=f.render();
  assert.equal(f.getMounts(),0);
  assert.ok(!html.includes('Own private content'));
  assert.ok(!html.includes('href="/profile"'));
  assert.ok(html.includes('role="status"'));
  assert.ok(html.includes(f.messages.SessionTransition.loading));
  assert.ok(html.includes(native?f.messages.nav.signIn:f.messages.SessionTransition.home));
  // A plain anchor works even if the SDK's navigation failed; it starts no
  // automatic Next.js prefetch and makes no authorization decision itself.
  assert.ok(html.includes(`href="${native?'/sign-in':'/'}"`));
  assert.equal(f.render(),html);
  assert.equal(f.getMounts(),0);
 });
}
for(const locale of SUPPORTED_LOCALES)test(`app recovery stays at sign-in when AppChrome disappears but the installed bridge remains: ${locale}`,()=>{
 const f=fixture(locale,true,true);f.setState({isLoaded:true,session:null});
 const before=f.render();assert.ok(before.includes('href="/sign-in"'));assert.ok(before.includes(f.messages.nav.signIn));
 f.setPresentation(false,true);
 assert.equal(f.render(),before,'removing only the layout marker must not change the recovery destination or label');
 assert.equal(f.getMounts(),0,'the retained workspace capability does not authorize old private children');
 f.setPresentation(false,false);
 const web=f.render();assert.ok(web.includes('href="/"'));assert.ok(web.includes(f.messages.SessionTransition.home));
 assert.equal(f.getMounts(),0);
});
for(const native of [false,true])test(`ordinary guests, same-session hydration, and active account changes still render their supplied page: native=${native}`,()=>{
 const f=fixture('de',native);
 assert.ok(f.render().includes('Own private content'));
 f.setState({isLoaded:true,session:{id:'own-session-a'}});
 assert.ok(f.render().includes('Own private content'));
 f.setState({isLoaded:true,session:{id:'own-session-b'}});
 assert.ok(f.render().includes('Own private content'));
 f.setState({isLoaded:true,session:null});
 assert.ok(f.render(null).includes('Own private content'));
 assert.equal(f.getMounts(),4);
});

function loadInstalled(file,mocks){
 const mod={exports:{}};
 new Function('require','module','exports',readFileSync(new URL(file,import.meta.url),'utf8'))(
  name=>mocks[name]??require(name),mod,mod.exports,
 );
 return mod.exports;
}

test('the installed Clerk hook reports its provisional sign-out state as unresolved while Clerk itself remains loaded',()=>{
 const clerk={loaded:true,isSignedIn:false,__internal_lastEmittedResources:{session:undefined}};
 const contexts={useClerkInstanceContext:()=>clerk,useInitialStateContext:()=>null,useAssertWrappedByClerkProvider:()=>{}};
 const base=loadInstalled('../node_modules/@clerk/shared/dist/react/hooks/base/useSessionBase.js',{
  '../../../deriveState.js':{deriveFromSsrInitialState:()=>null},
  '../../contexts.js':contexts,
  react:{useCallback:fn=>fn,useSyncExternalStore:(_subscribe,getSnapshot)=>getSnapshot()},
 });
 const hooks=loadInstalled('../node_modules/@clerk/shared/dist/react/hooks/useSession.js',{
  '../../telemetry/events/method-called.js':{eventMethodCalled:()=>({})},
  '../contexts.js':contexts,'./base/useSessionBase.js':base,
 });
 const unresolved=hooks.useSession();
 assert.equal(unresolved.isLoaded,false);assert.equal(unresolved.session,undefined);
 const f=fixture();f.setState({...unresolved,clerkLoaded:clerk.loaded});
 const html=f.render();
 assert.equal(f.getMounts(),0,'the previous server page must not run during this real SDK intermediate state');
 assert.ok(html.includes('role="status"'));
 // A genuinely uninitialized SDK must still preserve the server-rendered page.
 clerk.loaded=false;f.setState({...unresolved,clerkLoaded:clerk.loaded});
 assert.ok(f.render().includes('Own private content'));assert.equal(f.getMounts(),1);
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
