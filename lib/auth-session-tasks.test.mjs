import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator} from 'next-intl';
import ts from 'typescript';
import {AUTH_TASK_URLS,isAuthSessionTaskKey} from './auth-session-tasks.ts';
import * as redirects from './auth-redirect.ts';
import {finalizeThenNavigate} from './sign-in-flow.ts';

const locales=['de','en','es','it','cs','hu','nl','nl-BE','sv'],keys=['reset-password','choose-organization','setup-mfa'];
const require=createRequire(import.meta.url),compiled=new Map(),catalogs=new Map();
function messages(locale){if(!catalogs.has(locale))catalogs.set(locale,JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8')));return catalogs.get(locale);}
function translator(locale,namespace){return createTranslator({locale,messages:messages(locale),namespace,onError(error){throw error;}});}
function sourceModule(file,mocks){
 const url=new URL(file,import.meta.url);
 if(!compiled.has(url.href))compiled.set(url.href,ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText);
 const localRequire=createRequire(url),loaded={exports:{}};
 new Function('require','module','exports','process',compiled.get(url.href))(name=>Object.hasOwn(mocks,name)?mocks[name]:localRequire(name),loaded,loaded.exports,Object.freeze({env:Object.freeze({})}));
 return loaded.exports;
}
class Redirect extends Error{constructor(url){super('controlled redirect');this.url=url;}}
class NotFound extends Error{constructor(){super('controlled not found');}}
function identity(mode,options){return mode==='guest'?{userId:null,sessionStatus:null}:mode==='active'?{userId:'test-member',sessionStatus:'active'}:options?.treatPendingAsSignedOut===false?{userId:'test-member',sessionStatus:'pending'}:{userId:null,sessionStatus:'pending'};}
function clientFixture(locale='de',state={isLoaded:true,isSignedIn:false,session:null}){
 const widgets=[],taskRedirects=[],translation=namespace=>translator(locale,namespace);
 const widget=key=>function TaskWidget(props){widgets.push({key,props});return React.createElement('section',{'data-sdk-task':key},'Controlled SDK task surface');};
 const mocks={
  '@clerk/nextjs':{useSession:()=>state,RedirectToTasks:props=>{taskRedirects.push(props);return React.createElement('span',{'data-sdk-task-redirect':true});},TaskResetPassword:widget('reset-password'),TaskChooseOrganization:widget('choose-organization'),TaskSetupMFA:widget('setup-mfa')},
  'next-intl':{useTranslations:translation},'next/link':{__esModule:true,default:({href,children,...props})=>React.createElement('a',{...props,href},children)},
  '@/lib/auth-redirect':redirects,
 };
 mocks['@/components/AuthFormLoading']=sourceModule('../components/AuthFormLoading.tsx',mocks);
 const client=sourceModule('../components/AuthSessionTask.tsx',mocks);
 return {...client,widgets,taskRedirects,state,
  render:(task='reset-password',destination='/dashboard')=>renderToStaticMarkup(React.createElement(client.default,{task,destination})),
  gate:children=>renderToStaticMarkup(React.createElement(client.AuthSessionTaskGate,null,children)),
 };
}
function serverFixture({locale='de',mode='pending',state}={}){
 const calls={auth:[],forms:[],task:[]},client=clientFixture(locale,state??{isLoaded:true,isSignedIn:mode==='active',session:mode==='guest'?null:{id:'test-session',status:mode,currentTask:mode==='pending'?{key:'reset-password'}:undefined}});
 const mocks={
  '@clerk/nextjs/server':{auth:async options=>{calls.auth.push(options);return identity(mode,options);}},
  'next-intl/server':{getTranslations:async namespace=>translator(locale,namespace)},
  'next/navigation':{redirect:url=>{throw new Redirect(url);},notFound:()=>{throw new NotFound();}},
  '@/lib/auth-redirect':redirects,'@/lib/auth-session-tasks':{AUTH_TASK_URLS,isAuthSessionTaskKey},
  '@/components/AuthSessionTask':{...client,__esModule:true,default:props=>{calls.task.push(props);return React.createElement(client.default,props);}},
  '@/components/AuthForm':{__esModule:true,default:props=>{calls.forms.push(props);return React.createElement('form',{'data-public-auth-mode':props.mode},React.createElement('input',{name:'email',type:'email'}));}},
 };
 const page=sourceModule('../app/sign-in/tasks/[task]/page.tsx',mocks);
 return {client,calls,mocks,
  page:(task='reset-password',redirect_url)=>page.default({params:Promise.resolve({task}),searchParams:Promise.resolve({redirect_url})}),
  entry:async(modeName='sign-in',query={})=>sourceModule(`../app/${modeName}/[[...${modeName}]]/page.tsx`,mocks).default({searchParams:Promise.resolve(query)}),
 };
}

for(const locale of locales)for(const task of keys)test(`${locale}: real task page renders native headings and exactly matching SDK task ${task}`,async()=>{
 const f=serverFixture({locale,state:{isLoaded:true,isSignedIn:false,session:{id:'test-session',status:'pending',currentTask:{key:task}}}});
 const tree=await f.page(task,'/inserat?group=locations#details'),html=renderToStaticMarkup(tree),t=translator(locale,'auth');
 const text=value=>renderToStaticMarkup(React.createElement(React.Fragment,null,value));
 assert.ok(html.includes(text(t('sessionTaskTitle'))));assert.ok(html.includes(text(t('sessionTaskDescription'))));
 assert.match(html,new RegExp(`data-sdk-task="${task}"`));assert.equal(f.client.widgets.length,1);assert.equal(f.client.widgets[0].key,task);
 assert.equal(f.client.widgets[0].props.redirectUrlComplete,'/inserat?group=locations#details');assert.ok(f.client.widgets[0].props.appearance);
 assert.deepEqual(f.calls.auth,[{treatPendingAsSignedOut:false}]);assert.deepEqual(f.calls.forms,[]);assert.deepEqual(f.client.taskRedirects,[]);
});
for(const locale of locales)test(`${locale}: pending-session gate hides public credential forms and delegates resumption to Clerk`,async()=>{
 for(const entry of ['sign-in','sign-up']){
  const f=serverFixture({locale}),tree=await f.entry(entry,{redirect_url:'/inserat?group=locations'}),html=renderToStaticMarkup(tree);
  assert.equal(f.client.taskRedirects.length,1);assert.deepEqual(f.calls.forms,[]);assert.match(html,/aria-busy="true"/);assert.ok(!html.includes('data-public-auth-mode'));
  assert.deepEqual(f.calls.auth,[undefined],'ordinary auth entry keeps the default pending-as-signed-out policy');
 }
});
for(const locale of locales)test(`${locale}: guests retain normal credential forms and task-unavailable return links`,async()=>{
 for(const entry of ['sign-in','sign-up']){const f=serverFixture({locale,mode:'guest'});const tree=await f.entry(entry,{redirect_url:'/profile'});const html=renderToStaticMarkup(tree);assert.equal(f.calls.forms.length,1);assert.equal(f.calls.forms[0].mode,entry);assert.ok(html.includes('data-public-auth-mode'));assert.deepEqual(f.client.taskRedirects,[]);}
 const c=clientFixture(locale),html=c.render('reset-password','/inserat?group=locations');
 assert.ok(html.includes(renderToStaticMarkup(React.createElement(React.Fragment,null,translator(locale,'auth')('sessionTaskUnavailable')))));
 assert.ok(html.includes('href="/sign-in?redirect_url=%2Finserat%3Fgroup%3Dlocations"'));assert.deepEqual(c.widgets,[]);
});
test('loading task session renders only native loading UI; no task mounts early',()=>{
 const c=clientFixture('de',{isLoaded:false,isSignedIn:undefined,session:undefined}),html=c.render();assert.match(html,/aria-busy="true"/);assert.deepEqual(c.widgets,[]);assert.deepEqual(c.taskRedirects,[]);
 let mounts=0;function PublicCredentials(){mounts++;return React.createElement('form',null,'Public credentials');}
 assert.ok(c.gate(React.createElement(PublicCredentials)).includes('Public credentials'));assert.equal(mounts,1,'initial SSR credential fields remain available before Clerk initializes');
});
test('wrong task URLs never mount a different task widget; Clerk selects the current task',()=>{
 for(const actual of keys)for(const requested of keys.filter(key=>key!==actual)){
  const c=clientFixture('de',{isLoaded:true,isSignedIn:false,session:{status:'pending',currentTask:{key:actual}}});
  assert.match(c.render(requested),/aria-busy="true"/);assert.deepEqual(c.widgets,[]);assert.equal(c.taskRedirects.length,1);
 }
});
test('server guests return to validated sign-in and active sessions return straight to their destination',async()=>{
 const guest=serverFixture({mode:'guest'});await assert.rejects(guest.page('reset-password','/inserat?group=locations'),error=>error instanceof Redirect&&error.url==='/sign-in?redirect_url=%2Finserat%3Fgroup%3Dlocations');
 const active=serverFixture({mode:'active'});await assert.rejects(active.page('reset-password','/profile?tab=crew#top'),error=>error instanceof Redirect&&error.url==='/profile?tab=crew#top');assert.deepEqual(active.calls.task,[]);
});
test('unsafe completion targets and auth/task loops fall back before reaching SDK task UI or active redirects',async()=>{
 for(const target of ['https://evil.invalid/','//evil.invalid/','/\\evil.invalid','/bad\u0000path','/sign-in','/sign-in/tasks/reset-password','/sign-up?redirect_url=/profile']){
  const pending=serverFixture(),html=renderToStaticMarkup(await pending.page('reset-password',target));assert.match(html,/data-sdk-task="reset-password"/);assert.equal(pending.client.widgets[0].props.redirectUrlComplete,'/dashboard',target);
  const active=serverFixture({mode:'active'});await assert.rejects(active.page('reset-password',target),error=>error instanceof Redirect&&error.url==='/dashboard');
 }
 const list=serverFixture();renderToStaticMarkup(await list.page('reset-password',['/profile','https://evil.invalid']));assert.equal(list.client.widgets[0].props.redirectUrlComplete,'/profile');
});
test('only the three installed SDK task keys have routes; unknown and prototype names fail closed',async()=>{
 assert.deepEqual(Object.keys(AUTH_TASK_URLS).sort(),[...keys].sort());
 for(const key of ['unknown','constructor','__proto__','reset-password/extra','']){assert.equal(isAuthSessionTaskKey(key),false);await assert.rejects(serverFixture().page(key),error=>error instanceof NotFound);}
});
test('installed Clerk useSession exposes a pending session even though its signed-in flag is false',()=>{
 const session=Object.freeze({id:'test-pending-session',status:'pending',currentTask:Object.freeze({key:'reset-password'})});
 const clerk={loaded:true,isSignedIn:false,__internal_lastEmittedResources:{session}};
 const contexts={useClerkInstanceContext:()=>clerk,useInitialStateContext:()=>null,useAssertWrappedByClerkProvider:()=>{}};
 const installed=(file,mocks)=>{const loaded={exports:{}};new Function('require','module','exports',readFileSync(new URL(file,import.meta.url),'utf8'))(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),loaded,loaded.exports);return loaded.exports;};
 const base=installed('../node_modules/@clerk/shared/dist/react/hooks/base/useSessionBase.js',{'../../../deriveState.js':{deriveFromSsrInitialState:()=>null},'../../contexts.js':contexts,react:{useCallback:fn=>fn,useSyncExternalStore:(_subscribe,getSnapshot)=>getSnapshot()}});
 const hooks=installed('../node_modules/@clerk/shared/dist/react/hooks/useSession.js',{'../../telemetry/events/method-called.js':{eventMethodCalled:()=>({})},'../contexts.js':contexts,'./base/useSessionBase.js':base});
 const state=hooks.useSession();assert.equal(state.isLoaded,true);assert.equal(state.isSignedIn,false);assert.equal(state.session,session);
 const c=clientFixture('de',state);assert.match(c.render(),/data-sdk-task="reset-password"/);assert.equal(c.widgets.length,1);
});
test('a pending session exposes task UI only and still receives 401 from the existing private API guard',async()=>{
 const f=serverFixture(),tree=await f.page();assert.match(renderToStaticMarkup(tree),/data-sdk-task="reset-password"/);
 const {NextResponse}=require('next/server');
 const authModule=sourceModule('./auth/index.ts',{...f.mocks,'next/server':{NextResponse},'@/lib/admin-policy':{isConfiguredAdmin:()=>false}});
 const response=await authModule.requireAuth();assert.ok(response instanceof NextResponse);assert.equal(response.status,401);assert.equal(await authModule.getCurrentUser(),null);
 assert.deepEqual(f.calls.auth,[{treatPendingAsSignedOut:false},undefined,undefined]);
});
for(const key of [...keys,'future-task'])test(`finalization with current task ${key} never decorates or navigates to app content`,async()=>{
 const calls=[],session=Object.freeze({status:'pending',currentTask:Object.freeze({key})});
 const result=await finalizeThenNavigate(async({navigate})=>{await navigate({session,decorateUrl:()=>{calls.push('decorate');return '/dashboard';}});return {error:null};},'/dashboard',url=>calls.push(url));
 assert.equal(result.error,null);assert.deepEqual(calls,[]);assert.equal(session.status,'pending');
});
test('ordinary finalization preserves authorized Safari decoration, awaits navigation and remains idempotent',async()=>{
 const destination='/profile?tab=crew',decorated='https://clerk.cinegenius.co/v1/client/touch?redirect_url='+encodeURIComponent(destination),events=[];
 let release;const completed=new Promise(resolve=>{release=resolve});
 const completion=finalizeThenNavigate(async({navigate})=>{const move=navigate({session:{status:'active'},decorateUrl:value=>{assert.equal(value,destination);return decorated;}});navigate({session:{status:'active'},decorateUrl:()=>assert.fail('duplicate callback must not decorate again')});await move;events.push('activation published');return {error:null};},destination,url=>{events.push(url);return completed;});
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(events,[decorated]);release();await completion;assert.deepEqual(events,[decorated,'activation published']);
});
test('SDK activation errors or rejected navigation cannot be turned into a successful app redirect',async()=>{
 const error=Object.freeze({code:'controlled_activation_failure'}),calls=[];
 assert.equal((await finalizeThenNavigate(async()=>({error}),'/dashboard',url=>calls.push(url))).error,error);assert.deepEqual(calls,[]);
 await assert.rejects(finalizeThenNavigate(async({navigate})=>{await navigate({session:{status:'active'},decorateUrl:url=>url});return {error:null};},'/dashboard',()=>Promise.reject(new Error('controlled navigation failure'))),/controlled navigation failure/);
});
