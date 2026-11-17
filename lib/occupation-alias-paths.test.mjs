import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createTranslator } from 'use-intl/core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const jsx = require('react/jsx-runtime');
const locales = ['de','en','es','it','cs','hu','nl','nl-BE','sv','fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk'];
const catalogs = Object.fromEntries(locales.map(locale => [locale, JSON.parse(readFileSync(`${root}/messages/${locale}.json`, 'utf8'))]));
const translate = (locale, namespace) => createTranslator({locale, namespace, messages:catalogs[locale], onError(error){throw error;}});
const compiled = new Map(), modules = new Map();
function code(path) {
  if (!compiled.has(path)) compiled.set(path, ts.transpileModule(readFileSync(`${root}/${path}`, 'utf8'), {
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX},
  }).outputText);
  return compiled.get(path);
}
function pure(path) {
  if (path.endsWith('.json')) return {default:JSON.parse(readFileSync(`${root}/${path}`, 'utf8'))};
  if (!path.endsWith('.ts')) path += '.ts';
  if (modules.has(path)) return modules.get(path);
  const exports = {};
  modules.set(path,exports);
  runInNewContext(code(path), {exports, require(name) {
    if(name.startsWith('@/'))return pure(name.slice(2));
    if(name.startsWith('.'))return pure(resolve(root,dirname(path),name).slice(root.length+1));
    return require(name);
  }});
  return exports;
}
const {jobOccupation} = pure('lib/job-occupation.ts');
const {FILM_DEPARTMENTS} = pure('lib/filmRoles.ts');
const {getOccupationSearchTerms, resolveDepartmentRole, getDepartmentRoleLabel, FILM_TO_PROFILE_DEPARTMENT} = pure('lib/departments.ts');
function elements(tree, predicate, found=[]) {
  if(Array.isArray(tree))tree.forEach(child=>elements(child,predicate,found));
  else if(tree&&typeof tree==='object') {if(predicate(tree))found.push(tree);elements(tree.props?.children,predicate,found);}
  return found;
}
function text(tree) {
  if(tree==null||typeof tree==='boolean')return '';
  if(Array.isArray(tree))return Array.from(tree,text).join('');
  return typeof tree==='object'?text(tree.props?.children):String(tree);
}
function fixture(path, props, {locale='de',name='default',fragment=false}={}) {
  const hooks=[];let cursor=0;
  const react = {
    useState(initial){const index=cursor++;if(!(index in hooks))hooks[index]=typeof initial==='function'?initial():initial;return [hooks[index],value=>{hooks[index]=typeof value==='function'?value(hooks[index]):value;}];},
    useRef(initial){const index=cursor++;return hooks[index]??=( {current:initial});},
    useEffect(){},
    useMemo(fn){return fn();},
  };
  const exports={};
  let source=code(path);
  if(fragment){
    const raw=readFileSync(`${root}/${path}`,'utf8');
    const ast=ts.createSourceFile(path,raw,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    const dropdown=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='RoleDropdown');
    assert.ok(dropdown);
    const imports='import {useMemo,useState,useRef,useEffect} from "react"; import {useLocale,useTranslations} from "next-intl"; import {taxonomyLabel,getOccupationSearchTerms,getDepartmentRoleFormLabels,resolveDepartmentOccupation} from "@/lib/departments"; import {roleOptionMatchesSearch} from "@/lib/project-type-labels"; import {ChevronDown,Search,CheckCircle} from "lucide-react";';
    source=ts.transpileModule(imports+dropdown.getText(ast)+';export {RoleDropdown};',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  }
  runInNewContext(source, {exports, require(dependency){
    if(dependency==='react')return react;
    if(dependency==='react/jsx-runtime')return jsx;
    if(dependency==='next-intl')return {useLocale:()=>locale,useTranslations:namespace=>translate(locale,namespace)};
    if(dependency==='lucide-react')return new Proxy({}, {get:(_,name)=>`icon-${String(name)}`});
    if(dependency.startsWith('@/components/'))return {default:`test-${dependency.split('/').pop()}`};
    if(dependency==='@/lib/use-swipe-dismiss')return {useSwipeDismiss(){}};
    if(dependency.startsWith('@/'))return pure(dependency.slice(2));
    return require(dependency);
  }});
  return {render(){cursor=0;return exports[name](props);}};
}
function options(tree){return elements(tree,node=>node.type==='button'&&node.props.className?.includes('text-left'));}
function openDropdown(view){elements(view.render(),node=>node.type==='button')[0].props.onClick();}
function queryDropdown(view,value){elements(view.render(),node=>node.type==='input')[0].props.onChange({target:{value}});return options(view.render());}

for(const locale of locales) test(`${locale}: the real shared role dropdown localizes old FILM aliases and emits their original values`,()=>{
  const writes=[];
  const view=fixture('components/RoleDropdown.tsx',{value:'Oberbeleuchter / Gaffer',options:['Oberbeleuchter / Gaffer','Best Boy Licht','Maskenbildner/in'],onChange:value=>writes.push(value)},{locale});
  openDropdown(view);
  const result=queryDropdown(view,'Oberbeleuchterin');
  assert.equal(result.length,1);
  assert.notEqual(text(result[0]),'Oberbeleuchter / Gaffer');
  if(locale==='de')assert.match(text(result[0]),/Oberbeleuchter\*in/);
  result[0].props.onClick();
  assert.deepEqual(writes,['Oberbeleuchter / Gaffer']);
});

test('the real role dropdown finds Best Girl with compact spelling and keeps an unknown member title intact',()=>{
  const view=fixture('components/RoleDropdown.tsx',{value:'',options:['Best Boy Licht','Eigene unbekannte Tätigkeit'],onChange(){}});
  openDropdown(view);
  const result=queryDropdown(view,'BestGirl');
  assert.equal(result.length,1);assert.match(text(result[0]),/Best Boy\/Girl/);
  const unknown=queryDropdown(view,'Eigene unbekannte');
  assert.equal(unknown.length,1);assert.equal(text(unknown[0]),'Eigene unbekannte Tätigkeit');
});

test('female exact job aliases resolve to the existing electric and Grip job IDs',()=>{
  const job=(roleLabel,category)=>jobOccupation({id:'test',title:'Test',location:'',roleLabel,category});
  for(const [label,department,role] of [
    ['Oberbeleuchterin','licht','oberbeleuchter'],
    ['Best Girl Licht','licht','best-boy-licht'],
    ['Best Girl Grip','grip','best-boy-grip'],
    ['Maskenbildnerin','maske','maskenbildner'],
  ]) {
    const value=job(label,department);assert.ok(value,label);assert.equal(value.department,department,label);assert.equal(value.role,role,label);
  }
});

test('job classification never turns an assistant or free description into a department head',()=>{
  for(const roleLabel of ['Assistentin der Oberbeleuchterin','Suche eine Oberbeleuchterin für den Dreh','Best Girl Assistant']) {
    assert.equal(jobOccupation({id:'test',title:'Test',location:'',category:'licht',roleLabel}),null,roleLabel);
  }
  const roleLabel='Assistentin der Produktionsleiterin';
  const value=jobOccupation({id:'test',title:'Test',location:'',category:'produktion',roleLabel});
  assert.ok(!value||value.role!=='produktionsleiter');
});

test('every unambiguous explicit job ID retains its original catalogue identity',()=>{
  for(const department of FILM_DEPARTMENTS) for(const role of department.roles) {
    if(department.roles.filter(candidate=>candidate.id===role.id).length!==1)continue;
    const actual=jobOccupation({id:'test',title:'Test',location:'',category:department.id,roleLabel:role.id});
    assert.ok(actual,`${department.id}/${role.id}`);assert.equal(actual.department,department.id);assert.equal(actual.role,role.id);
  }
});

test('the actual Crew role filter searches female aliases and compact BestGirl while preserving filter IDs',()=>{
  let selected;
  const props={label:'Rollen',placeholder:'Suchen',selected:new Set(),onChange:value=>{selected=value;},options:[
    {value:'licht/gaffer',label:'Gaffer',searchTerms:getOccupationSearchTerms('Gaffer')},
    {value:'licht/best-boy',label:'Best Boy Electric',searchTerms:getOccupationSearchTerms('Best Boy Electric')},
  ]};
  const view=fixture('components/MobileBrowseControls.tsx',props,{name:'BrowseRoleFilter'});
  const search=value=>{elements(view.render(),node=>node.type==='input'&&node.props.type==='search')[0].props.onChange({target:{value}});return view.render();};
  let tree=search('Oberbeleuchterin');
  let checks=elements(tree,node=>node.type==='input'&&node.props.type==='checkbox');
  assert.equal(checks.length,1);checks[0].props.onChange({target:{checked:true}});assert.equal(selected.has('licht/gaffer'),true);
  tree=search('BestGirl');checks=elements(tree,node=>node.type==='input'&&node.props.type==='checkbox');
  assert.equal(checks.length,1);checks[0].props.onChange({target:{checked:true}});assert.equal(selected.has('licht/best-boy'),true);
  assert.equal(resolveDepartmentRole('licht','Oberbeleuchterin'),'Gaffer (Oberbeleuchter)');
});


test('every FILM option displays the same catalogue label as its mapped profile department',()=>{
  const taxonomy=translate('de','Taxonomy'), animals=translate('de','FilmAnimals');
  const failures=[];
  for(const department of FILM_DEPARTMENTS) for(const role of department.roles) {
    const profileDepartment=FILM_TO_PROFILE_DEPARTMENT[department.id];
    const canonical=resolveDepartmentRole(profileDepartment,role.label);
    if(!canonical){failures.push(`${department.id}/${role.id}: unresolved ${role.label}`);continue;}
    const expected=getDepartmentRoleLabel(profileDepartment,canonical,'de',animals,taxonomy);
    const view=fixture('components/RoleDropdown.tsx',{value:role.label,options:[role.label],onChange(){}});
    const actual=text(elements(view.render(),node=>node.type==='button')[0]);
    if(actual!==expected)failures.push(`${department.id}/${role.id}: ${actual} !== ${expected}`);
  }
  assert.deepEqual(failures,[]);
});


test('the existing inserat/project role search uses shared aliases as well as compact BestGirl spelling',()=>{
  const {roleOptionMatchesSearch}=pure('lib/project-type-labels.ts');
  const display=value=>value;
  assert.equal(roleOptionMatchesSearch({label:'Oberbeleuchter / Gaffer'},'Oberbeleuchterin',display,'de',getOccupationSearchTerms('Oberbeleuchter / Gaffer')),true);
  assert.equal(roleOptionMatchesSearch({label:'Best Boy Licht'},'BestGirl',display,'de',getOccupationSearchTerms('Best Boy Licht')),true);
  assert.equal(roleOptionMatchesSearch({label:'Best Boy Licht'},'Köchin',display,'de'),false);
});


for(const locale of locales) test(`${locale}: the actual inserat role picker avoids untranslated male-only secondary metadata`,()=>{
  const option={id:'best-boy-licht',label:'Best Boy Licht',labelEn:'Best Boy Electric'};
  const view=fixture('app/inserat/page.tsx',{value:option.label,options:[option],onChange(){}},{locale,name:'RoleDropdown',fragment:true});
  openDropdown(view);
  const tree=view.render();
  const rows=elements(tree,node=>node.type==='button'&&node.props.role==='option');
  assert.equal(rows.length,1);
  assert.ok(text(rows[0]).startsWith(pure('lib/departments.ts').taxonomyLabel(option.label,translate(locale))),locale);
  const secondary=elements(rows[0],node=>node.type==='span'&&node.props.className?.includes('hidden sm:block'));
  assert.ok(secondary.every(node=>text(node)!=='Best Boy Electric'));
  elements(tree,node=>node.type==='input')[0].props.onChange({target:{value:'BestGirl'}});
  assert.equal(elements(view.render(),node=>node.type==='button'&&node.props.role==='option').length,1);
});

for (const locale of locales) test(`${locale}: localized masculine, feminine and neutral searches preserve shared and inserat role values`, () => {
  const taxonomy = translate(locale, 'Taxonomy');
  const {getDepartmentRoleFormLabels} = pure('lib/departments.ts');
  const canonical = resolveDepartmentRole('cast', 'Schauspieler');
  assert.ok(canonical);
  const terms = getDepartmentRoleFormLabels('cast', canonical, locale, undefined, taxonomy);
  const option = {id:'actor',label:canonical};
  for (const query of terms) {
    const changes=[];
    const shared=fixture('components/RoleDropdown.tsx',{value:'',options:[option.label,'Eigene unbekannte Tätigkeit'],onChange:value=>changes.push(value)},{locale});
    openDropdown(shared);
    const rows=queryDropdown(shared,query);
    assert.equal(rows.length,1,query);
    rows[0].props.onClick();
    assert.deepEqual(changes,[option.label]);
    const inserat=fixture('app/inserat/page.tsx',{value:'',options:[option],onChange:value=>changes.push(value)},{locale,name:'RoleDropdown',fragment:true});
    openDropdown(inserat);
    const input=elements(inserat.render(),node=>node.type==='input')[0];
    input.props.onChange({target:{value:query}});
    const matches=elements(inserat.render(),node=>node.type==='button'&&node.props.role==='option');
    assert.equal(matches.length,1,query);
    matches[0].props.onClick();
    assert.equal(changes[1],option.label);
  }
});

for(const locale of locales) test(`${locale}: saved canonical value stays localized when options still use a legacy alias`,()=>{
 const canonical=resolveDepartmentRole('licht','Oberbeleuchterin');
 const expected=getDepartmentRoleLabel('licht',canonical,locale,translate(locale,'FilmAnimals'),translate(locale,'Taxonomy'));
 const view=fixture('components/RoleDropdown.tsx',{value:canonical,options:['Oberbeleuchter / Gaffer'],onChange(){}},{locale});
 assert.equal(text(elements(view.render(),node=>node.type==='button')[0]),expected);
});
