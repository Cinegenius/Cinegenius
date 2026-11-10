import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createTranslator} from 'next-intl';
import * as departmentLibrary from './departments.ts';
import * as occupations from './primary-occupation.ts';
import {findQuickStartRoles,getQuickStartDepartments} from './quick-start-flow.ts';
import {normalizeOccupation,gripSearchTerms} from './gripTaxonomy.ts';
import {SUPPORTED_LOCALES} from './i18n/locales.ts';

const {departments,getDepartmentRoleLabel,getDepartmentRoleSearchTerms,getDeptLabel,getOccupationSearchTerms}=departmentLibrary;
const require=createRequire(import.meta.url),ts=require('typescript');
const production=departments.find(item=>item.id==='produktion');
const canonicalProducer='Produzent/in';
const producerId=occupations.occupationId('produktion',canonicalProducer);
const departmentSnapshot=JSON.stringify(departments);
const catalogueSnapshot=JSON.stringify(occupations.occupationCatalogue);
const originalAliases=JSON.stringify(getOccupationSearchTerms('Producer'));
const source=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
function parsed(file){return ts.createSourceFile(file,source(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);}
function declaration(file,name,within){const sf=parsed(file);let found=null;function visit(node){if(within&&ts.isFunctionDeclaration(node)&&node.name?.text===within){found=find(node);return;}if(!within&&ts.isVariableDeclaration(node)&&node.name.getText(sf)===name)found=node;ts.forEachChild(node,visit);}function find(root){let result;function search(node){if(ts.isVariableDeclaration(node)&&node.name.getText(sf)===name)result=node;ts.forEachChild(node,search);}search(root);return result;}visit(sf);assert.ok(found,`${file}: ${name}`);return found.initializer.getText(sf);}
function makeMemo(){let previous,computed;return(callback,dependencies)=>{if(!previous||dependencies.some((value,index)=>!Object.is(value,previous[index]))){computed=callback();previous=dependencies;}return computed;};}
function compileExpression(expression,scope){return new Function(...Object.keys(scope),'return ('+expression+');')(...Object.values(scope));}
const guidedSource=parsed('components/GuidedProfileWizard.tsx');
const roleTermsDeclaration=guidedSource.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='roleSearchTerms');
const roleTermsJS=ts.transpileModule(roleTermsDeclaration.getText(guidedSource),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const guidedRoleTerms=new Function('getDepartmentRoleSearchTerms','gripSearchTerms',roleTermsJS+';return roleSearchTerms;')(getDepartmentRoleSearchTerms,gripSearchTerms);
const guidedSearch=declaration('components/GuidedProfileWizard.tsx','visibleDepartments');
const setupSearch=declaration('components/ProfileSetupWizard.tsx','filteredDepartments');
const editorSearch=declaration('app/profile/page.tsx','visibleDepartments','TypeChipPicker');
const pickerJS=ts.transpileModule(source('components/PrimaryOccupationPicker.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const baseScope={departments,getDeptLabel,getDepartmentRoleLabel,getDepartmentRoleSearchTerms,normalizeOccupation,gripSearchTerms,roleSearchTerms:guidedRoleTerms};
function scopeFor(locale){const messages=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'));const translate=namespace=>createTranslator({locale,messages,namespace,onError(error){throw error;}});const animals=translate('FilmAnimals'),taxonomyText=translate('Taxonomy');return{locale,animals,taxonomyText,displayLabel:(departmentId,role)=>getDepartmentRoleLabel(departmentId,role,locale,animals,taxonomyText),translate};}
function pickerFor(scope){const fixture={exports:{}};const localRequire=specifier=>specifier==='next-intl'?{useLocale:()=>scope.locale,useTranslations:scope.translate}:specifier==='@/lib/departments'?departmentLibrary:specifier==='@/lib/primary-occupation'?occupations:require(specifier);new Function('require','module','exports',pickerJS)(localRequire,fixture,fixture.exports);return fixture.exports.default;}
function allElements(node){if(!node||typeof node!=='object')return[];const children=Array.isArray(node.props?.children)?node.props.children:[node.props?.children];return[node,...children.flat(Infinity).flatMap(allElements)];}

for(const locale of SUPPORTED_LOCALES){
 const localized=scopeFor(locale);
 test(`${locale}: current role labels supplement canonical DE/EN and Grip aliases`,()=>{
  for(const department of departments)for(const role of department.roles){
   const before=getDepartmentRoleSearchTerms(department,role),display=localized.displayLabel(department.id,role);
   const result=getDepartmentRoleSearchTerms(department,role,display);
   assert.ok(result.includes(display),`${department.id}: ${role}`);
   for(const original of before)assert.ok(result.includes(original));
   assert.equal(result.length,new Set(result).size);
  }
  for(const query of [canonicalProducer,'Producer','1. Kamerabühne','1st Camera Grip','Head Grip']){
   const results=findQuickStartRoles(query,1000,undefined,localized.displayLabel);
   const target=query===canonicalProducer||query==='Producer'?['produktion',canonicalProducer]:['grip','Key Grip'];
   assert.ok(results.some(item=>item.departmentId===target[0]&&item.role===target[1]),query);
  }
 });
 test(`${locale}: native quick-start results retain canonical selections and IDs`,()=>{
  for(const [departmentId,role]of [['produktion',canonicalProducer],['regie','Regisseur/in'],['grip','Key Grip'],['kamera',departments.find(item=>item.id==='kamera').roles[0]],['filmtiere-tiertraining',departments.find(item=>item.id==='filmtiere-tiertraining').roles[0]]]){
   const display=localized.displayLabel(departmentId,role),candidates=findQuickStartRoles(display,1000,[departmentId],localized.displayLabel);
   const selected=candidates.find(item=>item.departmentId===departmentId&&item.role===role);
   assert.ok(selected,`${departmentId}: native ${display} resolves to ${role}`);
   assert.equal(selected.departmentLabel,departments.find(item=>item.id===departmentId).label);
   assert.equal(occupations.occupationById(occupations.occupationId(departmentId,selected.role)).label,role);
  }
  const selected=findQuickStartRoles(localized.displayLabel('produktion',canonicalProducer),1000,['produktion'],localized.displayLabel).find(item=>item.role===canonicalProducer);
  assert.equal(occupations.occupationReference(occupations.occupationById(occupations.occupationId(selected.departmentId,selected.role))).roleId,producerId);
  assert.equal(occupations.primaryOccupationForPositions({departmentId:'produktion',roleId:producerId},[canonicalProducer]).label,canonicalProducer);
 });
 test(`${locale}: actual setup, guided and editor search expressions find displayed role and department labels`,()=>{
  const query=localized.displayLabel('produktion',canonicalProducer),common={...baseScope,...localized};
  const guided=compileExpression(guidedSearch,{...common,normalizedSearch:normalizeOccupation(query),useMemo:makeMemo()});
  assert.ok(guided.some(({department,roles})=>department.id==='produktion'&&roles.includes(canonicalProducer)));
  const setup=compileExpression(setupSearch,{...common,departmentSearch:query,crewDepartments:getQuickStartDepartments('crew'),useMemo:makeMemo()});
  assert.ok(setup.some(department=>department.id==='produktion'));
  const editor=compileExpression(editorSearch,{...common,normalizedQuery:query.toLocaleLowerCase('de'),activeDepartmentIds:new Set()});
  assert.ok(editor.some(({dept,roles})=>dept.id==='produktion'&&roles.includes(canonicalProducer)));
  const departmentQuery=getDeptLabel(production,locale,localized.animals,localized.taxonomyText);
  const editorDepartment=compileExpression(editorSearch,{...common,normalizedQuery:departmentQuery.toLocaleLowerCase('de'),activeDepartmentIds:new Set()});
  assert.ok(editorDepartment.some(({dept,roles})=>dept.id==='produktion'&&roles.length===production.roles.length));
 });
 test(`${locale}: real native primary-occupation select keeps translated text and stable values`,()=>{
  const Picker=pickerFor(localized),changes=[];
  const rendered=Picker({positions:[canonicalProducer],value:{departmentId:'produktion',roleId:producerId},onChange:value=>changes.push(value)});
  const select=allElements(rendered).find(node=>node.type==='select');
  assert.ok(select);assert.equal(select.props.value,producerId);
  const option=allElements(select).find(node=>node.type==='option'&&node.props.value===producerId);
  assert.ok(option);const visible=option.props.children.flat().join('');
  assert.ok(visible.includes(localized.displayLabel('produktion',canonicalProducer)));
  assert.ok(visible.includes(getDeptLabel(production,locale,localized.animals,localized.taxonomyText)));
  select.props.onChange({target:{value:producerId}});
  assert.deepEqual(changes,[{departmentId:'produktion',roleId:producerId}]);
 });
}
test('same guided query is re-evaluated after an active-locale switch',()=>{
 const memo=makeMemo();
 for(const locale of ['en','nl','en','nl-BE','sv']){
  const localized=scopeFor(locale),results=compileExpression(guidedSearch,{...baseScope,...localized,normalizedSearch:normalizeOccupation('Producent'),useMemo:memo});
  const found=results.some(({department,roles})=>department.id==='produktion'&&roles.includes(canonicalProducer));
  assert.equal(found,['nl','nl-BE','sv'].includes(locale),locale);
 }
});
test('native searches never translate shared catalogues, persisted roles or global alias indices',()=>{
 assert.equal(JSON.stringify(departments),departmentSnapshot);
 assert.equal(JSON.stringify(occupations.occupationCatalogue),catalogueSnapshot);
 assert.equal(JSON.stringify(getOccupationSearchTerms('Producer')),originalAliases);
 assert.deepEqual(getOccupationSearchTerms('Producent'),['Producent']);
 assert.equal(occupations.occupationById('produktion/Producent'),null);
 assert.equal(findQuickStartRoles('Producent',1000,['produktion']).some(item=>item.role===canonicalProducer),false);
 assert.deepEqual(getDepartmentRoleSearchTerms(production,canonicalProducer),[canonicalProducer,'Producer']);
 assert.equal(occupations.occupationById(producerId).label,canonicalProducer);
 assert.equal(departments.some(department=>department.roles.includes('Producent')),false);
});
