import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {intlClientFor,translatorFor} from './i18n-test-fixture.mjs';
import {SMART_MAP_COLORS} from './smart-search-map.ts';
const require=createRequire(import.meta.url);
const locales=['de','en','es','it','cs','hu','nl','nl-BE','sv'];
function load(file,mocks){const mod={exports:{}};const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(name=>mocks[name]??require(name),mod,mod.exports);return mod.exports.default;}
function nodes(tree,predicate,result=[]){if(!tree||typeof tree!=='object')return result;if(predicate(tree))result.push(tree);for(const c of React.Children.toArray(tree.props?.children))nodes(c,predicate,result);return result;}
function fixture(locale,account,admin){let index=0;const values=[],navigation=[];let current=account,serverAdmin=admin;
 const hooks={...React,useEffect(){},useId:()=> 'smart-hint',useCallback:fn=>fn,useContext:()=>serverAdmin,useRef:()=>({current:null}),useState(initial){const i=index++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return[values[i],value=>values[i]=typeof value==='function'?value(values[i]):value]}};
 const Preview=()=>null;
 const mocks={react:hooks,'@/components/SmartSearchPreview':{__esModule:true,default:Preview},'@/lib/server-admin-context':{ServerAdminContext:{}},'@clerk/nextjs':{useAuth:()=>({isLoaded:true,userId:current})},'next-intl':intlClientFor(locale),'next/navigation':{useRouter:()=>({push:href=>navigation.push(href)})}};
 const Hero=load('../components/HeroSearch.tsx',mocks);
 return{Preview,navigation,render(){index=0;return Hero()},account(user,admin){current=user;serverAdmin=admin;}};
}
for(const locale of locales)test(`${locale}: Smart gives guests a notice, members an example and admins an operable tab`,()=>{
 const t=translatorFor(locale);
 for(const [user,admin,allowed,preview] of [[null,null,false,false],['member',null,false,true],['member','admin',false,true],['admin','admin',true,false]]){
  const f=fixture(locale,user,admin);let tree=f.render();
  const smart=nodes(tree,n=>n.type==='button'&&n.props.children===t('UnifiedSearch.tab'))[0];
  smart.props.onClick({currentTarget:{scrollIntoView(){}}});tree=f.render();
  assert.equal(nodes(tree,n=>n.type==='button'&&n.props['aria-pressed']===true)[0].props.children,t(allowed?'UnifiedSearch.tab':'nav.locations'));
  assert.equal(nodes(tree,n=>n.type===f.Preview).length,preview?1:0);
  assert.equal(nodes(tree,n=>n.props?.role==='status').length,allowed?0:1);
  if(allowed){nodes(tree,n=>n.type==='input'&&n.props.name==='q')[0].props.onChange({target:{value:'Kamera in Berlin'}});tree=f.render();nodes(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});assert.match(f.navigation[0],/^\/search\?smart=1/);
   f.account('member','admin');tree=f.render();nodes(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});assert.equal(f.navigation.length,1,'stale admin bootstrap does not authorize another account');}
 }
 const Preview=load('../components/SmartSearchPreview.tsx',{'next-intl':intlClientFor(locale),'@/lib/smart-search-map':{SMART_MAP_COLORS}});
 const html=renderToStaticMarkup(React.createElement(Preview));
 assert.ok(html.includes(t('UnifiedSearch.previewLabel')));assert.ok(html.includes(t('UnifiedSearch.previewNote')));assert.match(html,/<svg[^>]+role="img"/);
 for(const color of Object.values(SMART_MAP_COLORS).slice(0,4))assert.ok(html.includes(color));
 assert.doesNotMatch(html,/<(?:img|iframe|button|a|input)\b/,'preview has no remote media or active search controls');
});
