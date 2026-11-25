import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { SUPPORTED_LOCALES } from './i18n/locales.ts';
import { translatorFor } from './i18n-test-fixture.mjs';
import * as labels from './project-type-labels.ts';
import * as categories from './project-category-filter.ts';
import * as browse from './projects-browse.ts';
const require=createRequire(import.meta.url);
const styles=new Proxy({},{get:(_object,key)=>String(key)});
function load(file,mocks){
 const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const loaded={exports:{}};new Function('require','module','exports',source)(name=>{const value=Object.hasOwn(mocks,name)?mocks[name]:require(name);return value&&'default'in value?{__esModule:true,...value}:value},loaded,loaded.exports);return loaded.exports;
}
const data=Object.freeze([
 Object.freeze({id:'project-poster',title:'Zusammen durch die lange Nacht: ein ausführlicher Projekttitel ohne verlorenen Text',type:'Kurzfilm',year:2026,director:'Alexandra Maximiliane von Beispielhausen',poster_url:'/api/media/synthetic-project-poster',crew_count:14,place_country_code:'DE',updated_at:null,created_at:null}),
 Object.freeze({id:'project-fallback',title:'Internationales Dokumentarprojekt mit zweitem vollständigen Titel',type:'Member format / édition spéciale',year:null,director:'Christopher Alexander Beispielname',poster_url:null,crew_count:3,place_country_code:'AT',updated_at:null,created_at:null}),
]);
const htmlText=value=>renderToStaticMarkup(React.createElement('span',null,value)).slice(6,-7);
function results(locale='de'){
 return load('app/projects/NativeProjectResults.tsx',{'next/link':{default:({children,...props})=>React.createElement('a',props,children)},'next-intl':{useLocale:()=>locale,useTranslations:namespace=>translatorFor(locale,namespace)},'@/components/MediaImage':{default:({src,alt,className})=>React.createElement('img',{src,alt,className})},'@/lib/project-type-labels':labels,'./NativeProjectResults.module.css':{default:styles}});
}
for(const locale of SUPPORTED_LOCALES)test(`${locale}: native list and two-column project cards preserve all public facts and real poster/fallback data`,()=>{
 const before=JSON.stringify(data),Component=results(locale).default;
 for(const view of ['list','grid']){
  const html=renderToStaticMarkup(React.createElement(Component,{projects:data,view}));
  assert.match(html,new RegExp(`data-native-projects="${view}"`));
  assert.equal((html.match(/<img\b/g)??[]).length,1);assert.match(html,/src="\/api\/media\/synthetic-project-poster"/);
  assert.equal((html.match(/data-project-poster="fallback"/g)??[]).length,1);
  assert.match(html,/data-native-project-tone="short"/);assert.match(html,/data-native-project-tone="neutral"/);
  for(const project of data){assert.ok(html.includes(htmlText(project.title)));assert.ok(html.includes(htmlText(project.director)));assert.ok(html.includes(`/projects/${project.id}`));assert.ok(html.includes(htmlText(labels.projectTypeLabel(project.type,translatorFor(locale)))));}
  assert.ok(html.includes(htmlText(translatorFor(locale)('CountryNames.DE'))));
  assert.ok(html.includes(htmlText(translatorFor(locale,'projects')('creditCount',{count:14}))));
  assert.doesNotMatch(html,/line-clamp|truncate|MISSING_MESSAGE|invented.*\.jpg/);
 }
 assert.equal(JSON.stringify(data),before,'presentation never rewrites project values');
});
test('native project colors/icons follow stable known actual types; custom and unknown values stay neutral',()=>{
 const {nativeProjectTone}=results();
 assert.equal(nativeProjectTone('Kurzfilm'),'short');assert.equal(nativeProjectTone('Spielfilm'),'feature');assert.equal(nativeProjectTone('TV / Episodic'),'series');assert.equal(nativeProjectTone('Dokumentarfilm'),'documentary');assert.equal(nativeProjectTone('Corporate Video'),'corporate');
 assert.equal(new Set(['Spielfilm','Kurzfilm','Serie','Dokumentation','Werbefilm','Musikvideo','Corporate','Foto','Social Media','Event'].map(nativeProjectTone)).size,10);
 for(const value of [null,'Member format / édition spéciale','constructor','__proto__'])assert.equal(nativeProjectTone(value),'neutral');
});
function nodes(value,predicate,out=[]){if(Array.isArray(value))value.forEach(child=>nodes(child,predicate,out));else if(value?.props){if(predicate(value))out.push(value);nodes(value.props.children,predicate,out)}return out;}
function controller(native=true,saved='list'){
 const fields=new Map([['projects.view',saved]]),writes=[];
 const Component=load('app/projects/ProjectsContent.tsx',{
  react:{...React,useMemo:create=>create(),useEffect:effect=>effect()},'next-intl':{useLocale:()=> 'de',useTranslations:namespace=>translatorFor('de',namespace)},'next/link':{default:'a'},'next/navigation':{useRouter:()=>({push(){}})},
  '@/lib/use-native-app-appearance':{useNativeAppAppearance:()=>native},'./NativeProjectResults':{default:'native-projects'},'@/components/ProjectBrowseResults':{default:'website-projects'},
  '@/lib/use-view-state':{useViewState:(key,initial)=>{if(!fields.has(key))fields.set(key,typeof initial==='function'?initial():initial);return[fields.get(key),value=>{const next=typeof value==='function'?value(fields.get(key)):value;fields.set(key,next);writes.push({key,value:next})}]}},
  '@/components/BrowseGeography':{default:'geography',CountrySelect:'country'},'@/lib/browse-geography':{prioritizeGeographically:values=>values},'@/lib/use-browse-geography':{useBrowseGeography:()=>({preferred:null,key:'synthetic',setEnabled(){}})},
  '@/components/MobileBrowseControls':{default:'browse',MobileFilterField:'field',MobileFilterSelect:'select'},'@/components/DirectoryViewControls':{default:'views'},'@/components/app/NativeBrowseToolbar':{NativeBrowseQuickFilter:'quick'},
  '@/lib/places/core':{matchesPlace:()=>true,browsePlaceOptions:()=>[],UNASSIGNED_COUNTRY:'unassigned'},'@/lib/project-category-filter':categories,'@/lib/project-type-labels':labels,'@/lib/projects-browse':browse,
 }).default;
 return {fields,writes,render:()=>Component({projects:data})};
}
test('actual native project controls switch and persist genuinely distinct views while keeping filters/counts',()=>{
 const f=controller(true,'grid');let tree=f.render(),controls=nodes(tree,node=>node.type==='browse')[0].props;
 assert.equal(nodes(tree,node=>node.type==='native-projects')[0].props.view,'grid','saved selection is honored');
 assert.equal(controls.nativeCategoryKind,'projectType');assert.equal(nodes(controls.nativePlaceFilters,node=>node.type==='country').length,1);assert.ok(controls.nativeCategory.options.length>0);
 controls.nativeViewControls.props.onChange('list');tree=f.render();assert.equal(f.fields.get('projects.view'),'list');assert.equal(nodes(tree,node=>node.type==='native-projects')[0].props.view,'list');
 controls=nodes(tree,node=>node.type==='browse')[0].props;controls.nativeCategory.onChange('Kurzfilm');tree=f.render();controls=nodes(tree,node=>node.type==='browse')[0].props;assert.equal(controls.resultCount,1);assert.deepEqual(nodes(tree,node=>node.type==='native-projects')[0].props.projects.map(value=>value.id),['project-poster']);
 controls.nativeViewControls.props.onChange('grid');tree=f.render();assert.equal(f.fields.get('projects.view'),'grid');assert.equal(nodes(tree,node=>node.type==='native-projects')[0].props.projects.length,1,'switching view preserves active filter');
 const writes=f.writes.length;controls.nativeViewControls.props.onChange('map');assert.equal(f.writes.length,writes,'unavailable map never becomes a false selected view');
});
test('ordinary website retains its original shared project renderer and saved view',()=>{
 const f=controller(false,'grid'),tree=f.render();assert.equal(nodes(tree,node=>node.type==='native-projects').length,0);assert.equal(nodes(tree,node=>node.type==='website-projects')[0].props.view,'grid');
});
test('native project styles explicitly distinguish phone grid from list without clipping title/director facts',()=>{
 const css=readFileSync('app/projects/NativeProjectResults.module.css','utf8');assert.match(css,/html\[data-cg-native-community-appearance="app"\]/);assert.match(css,/\.grid \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);assert.match(css,/\.list \{ grid-template-columns:minmax\(0,1fr\)/);assert.match(css,/overflow-wrap:anywhere/);assert.match(css,/-webkit-line-clamp:unset/);assert.doesNotMatch(css.replace(/\.srOnly\s*\{[^}]*\}/g,''),/line-clamp:[12](?:;|\})|text-overflow:ellipsis|white-space:nowrap/);
});
