import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {setImmediate as tick} from 'node:timers/promises';
import React from 'react';
import ts from 'typescript';
import {translatorFor} from './i18n-test-fixture.mjs';
import * as discovery from './native-smart-discovery.ts';
import * as seeds from './discovery-seed.ts';
import * as browseControls from './browse-filter-controls.ts';
import * as smartView from './native-smart-controls.ts';
import * as discoveryRequest from './native-smart-discovery-request.ts';
import {emptyDiscoveryFilters} from './smart-discovery.ts';

const require=createRequire(import.meta.url);
const compiled=ts.transpileModule(readFileSync(process.env.CINEGENIUS_SMART_RESUME_SOURCE??'components/app/NativeSmartLanding.tsx','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
}).outputText;
const seed='1'.repeat(32);
function nodes(value,predicate,out=[]){
  if(Array.isArray(value))value.forEach(child=>nodes(child,predicate,out));
  else if(value?.props){if(predicate(value))out.push(value);nodes(value.props.children,predicate,out);}
  return out;
}
function fixture(){
  let now=10_000,cursor=0,dirty=true,tree,timerId=0,unavailable=0;
  const slots=[],effects=[],timers=new Map(),listeners=new Map(),calls=[];
  const same=(a,b)=>a?.length===b?.length&&a.every((value,i)=>Object.is(value,b[i]));
  const effect=(create,deps)=>{
    const index=cursor++,prior=slots[index];
    if(!prior||!same(prior.deps,deps)){
      const slot={deps,cleanup:prior?.cleanup};slots[index]=slot;
      effects.push(()=>{slot.cleanup?.();slot.cleanup=create();});
    }
  };
  const hooks={...React,useEffect:effect,useLayoutEffect:effect,
    useMemo(create,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={deps,value:create()};return slots[i].value;},
    useRef(initial){const index=cursor++;return slots[index]??={current:initial};},
    useState(initial){
      const index=cursor++;slots[index]??={value:typeof initial==='function'?initial():initial};
      return [slots[index].value,action=>{
        const next=typeof action==='function'?action(slots[index].value):action;
        if(!Object.is(next,slots[index].value)){slots[index].value=next;dirty=true;}
      }];
    },
    useCallback(callback,deps){
      const index=cursor++;
      if(!slots[index]||!same(slots[index].deps,deps))slots[index]={deps,callback};
      return slots[index].callback;
    },
  };
  const events={
    addEventListener(name,callback){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(callback);},
    removeEventListener(name,callback){listeners.get(name)?.delete(callback);},
  };
  const window={...events,setTimeout(callback){timers.set(++timerId,callback);return timerId;},clearTimeout(id){timers.delete(id);}};
  const document={...events,visibilityState:'visible'};
  const onUnavailable=()=>unavailable++;
  const mocks={
    react:hooks,'react/jsx-runtime':require('react/jsx-runtime'),
    '@clerk/nextjs':{useAuth:()=>({isLoaded:true,isSignedIn:true,userId:'synthetic-user',sessionId:'synthetic-session'}),
      useSession:()=>({isLoaded:true,session:{id:'synthetic-session',status:'active',user:{id:'synthetic-user'}}})},
    'next-intl':{useLocale:()=> 'de',useTranslations:namespace=>translatorFor('de',namespace)},
    'next/link':{default:'fixture-link'},'@/components/DirectoryPage':{default:'fixture-page'},
    '@/components/ContentTranslation':{ContentTranslationNotice:()=>null},
    '@/components/SmartSearchPreview':{default:'fixture-preview'},
    '@/components/SmartSearchExplorer':{default:'fixture-results'},
    '@/lib/smart-discovery':{emptyDiscoveryFilters},
    '@/lib/browse-filter-controls':browseControls,'@/lib/native-smart-controls':smartView,'@/lib/native-smart-discovery-request':discoveryRequest,
    '@/lib/use-view-state':{useViewState:(field,initial)=>{
      const [value,setValue]=hooks.useState(field==='native.smart.seed'?seed:initial);
      return [value,hooks.useCallback(setValue,[])];
    }},
    '@/lib/use-form-router':{useFormRouter:()=>({push(){assert.fail('No navigation during resume');}})},
    '@/lib/native-smart-discovery':discovery,'@/lib/discovery-seed':seeds,
    '@/lib/use-native-segment-drag':{useNativeSegmentDrag:()=>({})},
    './NativeCreateMenu':{default:'fixture-create'},'./NativeSmartLanding.module.css':{default:{}},
  };
  const loaded={exports:{}};
  const fetch=(url,init)=>new Promise((resolve,reject)=>calls.push({url,signal:init.signal,resolve,reject}));
  const performance={now:()=>now,clearMarks(){},clearMeasures(){},measure(){},getEntriesByName:()=>[]};
  new Function('require','module','exports','window','document','fetch','Date','performance',compiled)(
    id=>{const value=mocks[id]??require(id);return value&&'default'in value?{__esModule:true,...value}:value;},
    loaded,loaded.exports,window,document,fetch,{now:()=>now},performance);
  function render(){
    cursor=0;dirty=false;
    tree=loaded.exports.default({accountId:'synthetic-user',loaded:true,allowed:true,onUnavailable});
    while(tree&&typeof tree.type==='function')tree=tree.type(tree.props);
    effects.splice(0).forEach(run=>run());
  }
  return {
    calls,get unavailable(){return unavailable;},
    advance(ms){now+=ms;},
    event(name){for(const callback of listeners.get(name)??[])callback();},
    visibility(value){document.visibilityState=value;this.event('visibilitychange');},
    hasResults(){return nodes(tree,node=>node.type==='fixture-results').length===1;},
    async settle(){for(let n=0;n<10;n++){if(dirty)render();const ready=[...timers.values()];timers.clear();ready.forEach(run=>run());await tick();}assert.equal(dirty,false);},
    reply(index,status=200){
      const groups=discovery.nativeDiscoveryPlan().searches.map(({area},wishIndex)=>({area,wishIndex,label:area,results:[],nextOffset:null}));
      calls[index].resolve({status,ok:status===200,json:async()=>({
        contract:discovery.NATIVE_DISCOVERY_CONTRACT,accountId:'synthetic-user',serverNow:new Date().toISOString(),
        focus:{mode:'neutral',departments:[],city:null},plan:discovery.nativeDiscoveryPlan(),groups,seed,
      })});
    },
    dispose(){slots.forEach(slot=>slot?.cleanup?.());},
    listenerCount(){return [...listeners.values()].reduce((sum,values)=>sum+values.size,0);},
  };
}

test('one Work return keeps one current permission request despite separated focus/resume events',async t=>{
  const f=fixture();t.after(()=>f.dispose());await f.settle();f.reply(0);await f.settle();assert.equal(f.hasResults(),true);
  f.event('cinegenius:native-workspace-presented');f.advance(1000);f.event('focus');await f.settle();
  assert.equal(f.calls.length,2);assert.equal(f.hasResults(),false,'Old private rows stay unavailable until checked');
  f.advance(750);f.event('cinegenius:app-resume');await f.settle();
  f.advance(750);f.event('pageshow');await f.settle();
  assert.equal(f.calls.length,2,'A slow current request must not be cancelled and started over');
  assert.equal(f.calls[1].signal.aborted,false);
  f.reply(1);await f.settle();assert.equal(f.hasResults(),true);
});

for(const suspend of ['blur','pagehide','cinegenius:native-workspace-presented','visibilitychange'])
test('a genuinely new visit retires the old request: '+suspend,async t=>{
  const f=fixture();t.after(()=>f.dispose());await f.settle();
  if(suspend==='visibilitychange')f.visibility('hidden');else f.event(suspend);
  assert.equal(f.calls[0].signal.aborted,true);
  f.advance(1000);
  if(suspend==='visibilitychange')f.visibility('visible');else f.event('cinegenius:app-resume');
  await f.settle();assert.equal(f.calls.length,2);
  f.reply(0);await f.settle();assert.equal(f.hasResults(),false,'A late pre-visit response cannot restore rows');
  f.reply(1);await f.settle();assert.equal(f.hasResults(),true);
});

test('a finished failure permits retry, denial falls back, and listeners are removed',async()=>{
  const f=fixture();
  try{
    await f.settle();f.reply(0,503);await f.settle();assert.equal(f.hasResults(),false);
    f.advance(1000);f.event('focus');await f.settle();assert.equal(f.calls.length,2);
    f.reply(1,403);await f.settle();assert.equal(f.unavailable,1);assert.equal(f.hasResults(),false);
  }finally{f.dispose();}
  assert.equal(f.listenerCount(),0);
});
