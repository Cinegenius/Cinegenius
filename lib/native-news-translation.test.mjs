import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as jsx from 'react/jsx-runtime';
import ts from 'typescript';
import {translatorFor} from './i18n-test-fixture.mjs';
const code=ts.transpileModule(readFileSync(new URL('../components/ContentTranslation.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function nodes(tree,match,out=[]){if(Array.isArray(tree))for(const child of tree)nodes(child,match,out);else if(tree?.props){if(match(tree))out.push(tree);nodes(tree.props.children,match,out)}return out}
function fixture(locale='de'){
 const effects=[],calls={original:[],refresh:0,subscriptions:0};let result={status:'unavailable',fields:{},originals:{}};
 const context={enabled:true,original:false,setOriginal:value=>calls.original.push(value),client:{refresh:()=>calls.refresh++,get:()=>result,subscribe:()=>{calls.subscriptions++;return()=>{}}}};
 const mocks={'react/jsx-runtime':jsx,react:{createContext:()=>({}),useContext:()=>context,useState:()=>[true,()=>{}],useRef:value=>({current:value}),useEffect:fn=>effects.push(fn),useCallback:fn=>fn,useSyncExternalStore:(_subscribe,snapshot)=>snapshot()},'next-intl':{useTranslations:namespace=>translatorFor(locale,namespace)},'@clerk/nextjs':{useAuth:()=>({isLoaded:true,userId:'fixture'})},'next/navigation':{usePathname:()=>'/news'},'lucide-react':{Languages:'language-icon',RotateCw:'retry-icon'},'@/lib/content-translation-client':{createContentTranslationClient:()=>{throw Error('No translation client may be constructed by these controls')}},'@/lib/i18n/locales':{isAppLocale:()=>true}};
 const module={exports:{}};new Function('require','module','exports',code)(id=>{assert.ok(id in mocks,id);return mocks[id]},module,module.exports);
 return{...module.exports,context,calls,effects,setResult:value=>{result=value}};
}
for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv','fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk'])test(`${locale}: native translation controls stay compact and retry is restricted to real errors`,()=>{
 const f=fixture(locale),t=translatorFor(locale,'contentTranslation');
 let tree=f.ContentTranslationActions({unavailable:false});assert.equal(nodes(tree,n=>n.type==='button').length,1);
 assert.equal(nodes(tree,n=>n.type==='button')[0].props['aria-label'],t('showOriginal'));
 tree=f.ContentTranslationActions({unavailable:true});const buttons=nodes(tree,n=>n.type==='button');assert.equal(buttons.length,2);assert.equal(buttons[1].props['aria-label'],t('retry'));buttons[1].props.onClick();assert.equal(f.calls.refresh,1);
 buttons[0].props.onClick();assert.deepEqual(f.calls.original,[true]);
 f.context.original=true;tree=f.ContentTranslationActions({unavailable:true});assert.equal(nodes(tree,n=>n.type==='button').length,1);assert.equal(nodes(tree,n=>n.type==='button')[0].props['aria-label'],t('showTranslated'));
 f.context.original=false;f.context.client=null;assert.equal(nodes(f.ContentTranslationActions({unavailable:true}),n=>n.type==='button').length,1);
 f.context.enabled=false;assert.equal(f.ContentTranslationActions({unavailable:true}),null);assert.equal(f.calls.subscriptions,0);
});
test('visible text instances report and remove their own error without cancelling another title/preview',()=>{
 const f=fixture(),failed=new Set();const report=(reference,status)=>{if(status==='unavailable')failed.add(reference.instance);else failed.delete(reference.instance)};
 const props={kind:'news',id:'approved',field:'title',children:'Original title',onStatusChange:report};
 f.TranslatedText(props);const first=f.effects.splice(0).map(effect=>effect()).filter(Boolean);assert.equal(failed.size,1);
 f.TranslatedText(props);const second=f.effects.splice(0).map(effect=>effect()).filter(Boolean);assert.equal(failed.size,2);
 first.forEach(cleanup=>cleanup());assert.equal(failed.size,1);
 second.forEach(cleanup=>cleanup());assert.equal(failed.size,0);
 assert.equal(f.calls.subscriptions,0,'observing the current result creates no extra subscription or request');
});
test('the ordinary website translation notice keeps its existing text and actions',()=>{
 const f=fixture(),tree=f.ContentTranslationNotice();
 assert.equal(nodes(tree,n=>n.type==='span')[0].props.children,translatorFor('de','contentTranslation')('notice'));
 assert.equal(nodes(tree,n=>n.type==='button').length,2);
});
