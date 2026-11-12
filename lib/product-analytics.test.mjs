import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {analyticsPage, analyticsProperties} from './analytics-policy.ts';
import * as consent from './analytics-consent.ts';
const require = createRequire(import.meta.url);

function harness({choice=null,path='/locations',legacy=false}={}) {
 const previous=globalThis.window;
 const store=new Map(legacy?[['cg_cookies_ok','1']]:[]);
 if(choice)store.set(consent.ANALYTICS_CONSENT_KEY,choice);
 const target=new EventTarget();target.location={pathname:path};
 target.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 globalThis.window=target;
 let effect,cleanup,imports=0,config,initializations=0,opted=false;const events=[];
 const sdk={init(key,options){assert.equal(key,'phc_synthetic');config=options;initializations++},get_distinct_id:()=> 'synthetic-anonymous',has_opted_out_capturing:()=>opted,opt_out_capturing(){opted=true},opt_in_capturing(){opted=false},capture(event,properties){const filtered=config.before_send({event,properties,uuid:'synthetic',timestamp:new Date(),$set:{email:'PRIVATE'},$set_once:{url:'PRIVATE'}});if(filtered)events.push(filtered)}};
 const source=ts.transpileModule(readFileSync(new URL('../components/ProductAnalytics.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports','process',source)(name=>{
  if(name==='react')return {useEffect:fn=>{effect=fn},useSyncExternalStore:(_subscribe,snapshot)=>snapshot()};
  if(name==='next/navigation')return {usePathname:()=>target.location.pathname};
  if(name==='@/lib/analytics-consent')return consent;
  if(name==='@/lib/analytics-policy')return {analyticsPage,analyticsProperties};
  if(name==='posthog-js'){imports++;return {__esModule:true,default:sdk}}
  return require(name);
 },mod,mod.exports,{env:{NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN:'phc_synthetic'}});
 return {store,target,events,get config(){return config},get imports(){return imports},get initializations(){return initializations},get opted(){return opted},
 start(){cleanup?.();mod.exports.default();cleanup=effect()},
 async settle(){await new Promise(resolve=>setImmediate(resolve))},
 dispose(){cleanup?.();globalThis.window=previous}};
}

test('only public directory routes enter analytics; identifiers and private paths never enter payloads',()=>{
 for(const path of ['/','/locations','/locations/suche','/projects/alle','/props','/photo'])assert.equal(analyticsPage(path),path);
 for(const path of ['/dashboard','/dashboard/messages','/admin','/profile-setup','/sign-in','/sign-up','/inserat','/profile/person','/locations/private-id','/locations/edit','/locations?email=secret','/photo#secret','//evil.test','/news/organization/story'])assert.equal(analyticsPage(path),null,path);
 assert.deepEqual(analyticsProperties('/locations'),{$current_url:'https://www.cinegenius.co/locations',$pathname:'/locations',$ip:null});
});

test('no SDK import, initialization or events without new explicit consent, including legacy dismissal',async()=>{
 for(const options of [{},{choice:'rejected'},{legacy:true},{choice:'accepted',path:'/dashboard'},{choice:'accepted',path:'/sign-in'}]){
  const h=harness(options);try{h.start();await h.settle();assert.equal(h.imports,0);assert.equal(h.initializations,0);assert.deepEqual(h.events,[])}finally{h.dispose()}
 }
});

test('consent permits one pageview, EU only, minimal payload, no recording or remote features',async()=>{
 const h=harness({choice:'accepted'});try{
  h.start();await h.settle();h.start();await h.settle();assert.equal(h.events.length,1);assert.equal(h.initializations,1);
  const c=h.config;assert.equal(c.api_host,'https://eu.i.posthog.com');assert.equal(c.persistence,'memory');
  for(const key of ['autocapture','capture_pageview','capture_pageleave','capture_exceptions','capture_performance','capture_heatmaps','capture_dead_clicks','rageclick','ip'])assert.equal(c[key],false,key);
  for(const key of ['disable_session_recording','disable_surveys','disable_conversations','disable_product_tours','disable_external_dependency_loading','advanced_disable_flags'])assert.equal(c[key],true,key);
  assert.equal(c.person_profiles,'never');assert.deepEqual(h.events[0].properties,{...analyticsProperties('/locations'),token:'phc_synthetic',distinct_id:'synthetic-anonymous',$process_person_profile:false});
  assert.ok(!JSON.stringify(h.events).includes('PRIVATE'));
  assert.equal(c.before_send({event:'$autocapture',properties:{text:'secret'}}),null);
  h.target.location.pathname='/dashboard';assert.equal(c.before_send({event:'$pageview',properties:{}}),null);
 }finally{h.dispose()}
});

test('withdrawal blocks future events; reacceptance and navigation resume without remount or duplicate',async()=>{
 const h=harness({choice:'accepted'});try{
  h.start();await h.settle();assert.equal(h.events.length,1);
  consent.writeAnalyticsConsent('rejected');h.start();await h.settle();assert.equal(h.opted,true);assert.equal(h.config.before_send({event:'$pageview',properties:{}}),null);
  consent.writeAnalyticsConsent('accepted');h.start();await h.settle();assert.equal(h.events.length,2);assert.equal(h.opted,false);
  h.target.location.pathname='/props';h.start();await h.settle();assert.equal(h.events.length,3);assert.equal(h.events[2].properties.$pathname,'/props');
 }finally{h.dispose()}
});

test('in-flight SDK load cannot initialize after withdrawal or navigation into private forms',async()=>{
 for(const privateRoute of [false,true]){
  const h=harness({choice:'accepted'});try{h.start();if(privateRoute)h.target.location.pathname='/profile-setup';else consent.writeAnalyticsConsent('rejected');h.start();await h.settle();assert.equal(h.initializations,0);assert.equal(h.events.length,0)}finally{h.dispose()}
 }
});

test('unavailable browser storage fails closed, and stored legacy values never grant consent',()=>{
 const h=harness({legacy:true});try{
  assert.equal(consent.readAnalyticsConsent(),null);h.target.localStorage.getItem=()=>{throw Error('blocked')};h.target.localStorage.setItem=()=>{throw Error('blocked')};assert.equal(consent.readAnalyticsConsent(),null);assert.equal(consent.writeAnalyticsConsent('accepted'),false);
 }finally{h.dispose()}
});

const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {createTranslator}=require('next-intl');
for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv'])test(`${locale}: consent controls remain explicit, equivalent and separate from legacy dismissal`,()=>{
 const h=harness();try{
  const messages=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'));
  const t=createTranslator({locale,messages,namespace:'AnalyticsPrivacy',onError:error=>{throw error}});
  const source=ts.transpileModule(readFileSync(new URL('../components/CookieBanner.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const mod={exports:{}};
  new Function('require','module','exports',source)(name=>{
   if(name==='react')return {...React,useEffect:()=>{},useState:value=>[value,()=>{}],useSyncExternalStore:(_sub,snapshot)=>snapshot()};
   if(name==='next-intl')return {useTranslations:()=>t};
   if(name==='next/link')return function MockLink({href,children,...props}){return React.createElement('a',{href,...props},children)};
   if(name==='@/lib/analytics-consent')return consent;
   return require(name);
  },mod,mod.exports);
  const tree=mod.exports.default();
  const buttons=[];function visit(node){if(Array.isArray(node))node.forEach(visit);else if(React.isValidElement(node)){if(node.type==='button')buttons.push(node);visit(node.props.children)}}visit(tree);
  assert.equal(buttons.length,2);assert.equal(buttons[0].props.children,t('reject'));assert.equal(buttons[1].props.children,t('accept'));
  assert.equal(buttons[0].props.className,buttons[1].props.className,'Equal visibility for refusal and consent');
  const html=renderToStaticMarkup(tree);assert.ok(html.includes('max-h-[60dvh]'));assert.ok(html.includes('min-h-11'));assert.ok(html.includes('/datenschutz'));
  buttons[0].props.onClick();assert.equal(consent.readAnalyticsConsent(),'rejected');buttons[1].props.onClick();assert.equal(consent.readAnalyticsConsent(),'accepted');
 }finally{h.dispose()}
});
