import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createTranslator} from 'next-intl';
import {OCCUPATION_FORMS, occupationFormFromCrew} from './occupation-form.ts';
import {START_QUICK_START_DRAFT, normalizeQuickStartDraft, createQuickStartIntentData, selectQuickStartOccupationForm, findQuickStartRoles} from './quick-start-flow.ts';
import {initializeSetupOccupationForm, setupProfilePayload} from './provider-profile-setup.ts';
import {normalizeGuidedProfileDraft} from './guided-profile-draft.ts';
import {departments,getDepartmentRoleLabel,getDepartmentRoleFormLabels,getDepartmentRoleSearchTerms,getDeptLabel} from './departments.ts';
import {gripSearchTerms} from './gripTaxonomy.ts';
import * as formHelpers from './occupation-form.ts';
import * as primary from './primary-occupation.ts';
import * as occupations from './crew-occupations.ts';
const require=createRequire(import.meta.url);
const locales=['de','en','es','it','cs','hu','nl','nl-BE','sv','fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk'];
const role='Gaffer (Oberbeleuchter)';
const selection={departmentId:'licht',role};
const draft=()=>({...structuredClone(START_QUICK_START_DRAFT),name:'Own profile',personCity:'Berlin',intents:['crew'],activeIntent:'crew',sections:{crew:{...createQuickStartIntentData(),departmentIds:['licht'],roles:[selection]}},completed:{profile:true,listings:{equipment:'own-saved-listing'},company:'own-company'}});
function elements(tree,predicate,result=[]){if(Array.isArray(tree))tree.forEach(child=>elements(child,predicate,result));else if(tree?.props){if(predicate(tree))result.push(tree);elements(tree.props.children,predicate,result);}return result;}
function text(tree){if(tree==null||typeof tree==='boolean')return '';if(Array.isArray(tree))return tree.map(text).join('');return typeof tree==='object'?text(tree.props?.children):String(tree);}
const compiled=new Map();
function component(file,locale){
 if(!compiled.has(file))compiled.set(file,ts.transpileModule(readFileSync(new URL('../components/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText);
 const messages=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'));
 const mocks={react:{useId:()=>':fixture:'},'react/jsx-runtime':require('react/jsx-runtime'),'next-intl':{useLocale:()=>locale,useTranslations:namespace=>createTranslator({locale,messages,namespace,onError(error){throw error;}})},'@/lib/occupation-form':formHelpers,'@/lib/departments':{departments,getDeptLabel,getDepartmentRoleLabel},'@/lib/primary-occupation':primary,'@/lib/crew-occupations':occupations};
 const loaded={exports:{}};new Function('require','module','exports',compiled.get(file))(name=>{assert.ok(Object.hasOwn(mocks,name),name);return mocks[name];},loaded,loaded.exports);return loaded.exports.default;
}

test('old setup drafts remain optional; presentation is not inferred from personal identity',()=>{
 for(const extra of [{},{pronouns:'she/her',gender:'female',name:'Anna',profileAvatarUrl:'/profile-art/feminine.webp'},{occupationForm:'invalid'}]){
  const old=normalizeQuickStartDraft({...draft(),...extra});assert.equal(old.occupationForm,undefined);assert.equal(occupationFormFromCrew(setupProfilePayload(old,null,[selection]).crew),'standard');
 }
});

test('a real presentation change invalidates just the completed personal profile and survives private resume',()=>{
 const before=draft();const roles=structuredClone(before.sections.crew.roles);
 assert.equal(selectQuickStartOccupationForm(before,'standard'),before);assert.equal(selectQuickStartOccupationForm(before,'invalid'),before);
 for(const form of ['masculine','feminine','neutral']){
  const changed=selectQuickStartOccupationForm(before,form);assert.equal(changed.completed.profile,false);assert.deepEqual(changed.completed.listings,before.completed.listings);assert.equal(changed.completed.company,before.completed.company);assert.deepEqual(changed.sections.crew.roles,roles);
  const resumed=normalizeQuickStartDraft(JSON.parse(JSON.stringify(changed)));assert.equal(resumed.occupationForm,form);assert.equal(selectQuickStartOccupationForm(resumed,form),resumed);
  const payload=setupProfilePayload(resumed,null,[selection]);assert.equal(payload.crew.occupationForm,form);assert.deepEqual(payload.positions,[role]);
 }
});

test('explicit reset survives resume and existing profile defaults never replace a draft choice',()=>{
 const existing={crew:{occupationForm:'feminine',kept:'owned-extension'}};
 const inherited=initializeSetupOccupationForm(draft(),existing);assert.equal(inherited.occupationForm,'feminine');assert.equal(draft().occupationForm,undefined);
 const reset=selectQuickStartOccupationForm(inherited,'standard');assert.equal(reset.completed.profile,false);
 const resumed=normalizeQuickStartDraft(JSON.parse(JSON.stringify(reset)));assert.equal(initializeSetupOccupationForm(resumed,existing),resumed);assert.equal(resumed.occupationForm,'standard');
 const payload=setupProfilePayload(resumed,existing,[selection]);assert.equal(payload.crew.occupationForm,'standard');assert.equal(payload.crew.kept,'owned-extension');
 for(const form of OCCUPATION_FORMS){const chosen={...draft(),occupationForm:form};assert.equal(initializeSetupOccupationForm(chosen,existing),chosen);}
});

test('provider-only setup omits crew updates and cannot clear or substitute an existing form',()=>{
 for(const form of [undefined,...OCCUPATION_FORMS]){
  const provider={...draft(),intents:['equipment'],sections:{equipment:{...createQuickStartIntentData(),offerLater:true}},occupationForm:form};
  const existing={profile_types:['lighting'],crew:{occupationForm:'feminine',kept:'owned-extension'}};
  const payload=setupProfilePayload(provider,existing,[]);assert.equal(Object.hasOwn(payload,'crew'),false);assert.equal(existing.crew.occupationForm,'feminine');
 }
});

test('guided profile drafts preserve selected wording, drop invalid values and retain role IDs',()=>{
 for(const form of OCCUPATION_FORMS){const value=normalizeGuidedProfileDraft({step:1,name:'Own person',departmentIds:['licht'],positions:[role],occupationForm:form});const resumed=normalizeGuidedProfileDraft(JSON.parse(JSON.stringify(value)));assert.equal(resumed.occupationForm,form);assert.deepEqual(resumed.positions,[role]);}
 for(const occupationForm of [undefined,null,'woman',false,{}])assert.equal(normalizeGuidedProfileDraft({positions:[role],occupationForm}).occupationForm,undefined);
});

for(const locale of locales)test(`${locale}: the actual optional selector changes one valid form and labels the primary role without changing its ID`,()=>{
 const Select=component('OccupationFormSelect.tsx',locale),Picker=component('PrimaryOccupationPicker.tsx',locale);let selected='standard';const changes=[];
 function tree(){return Select({value:selected,onChange:value=>{selected=value;changes.push(value);}});}
 let select=elements(tree(),node=>node.type==='select')[0];assert.equal(select.props.required,undefined);assert.match(select.props.className,/min-h-11/);assert.match(select.props.className,/(?:^| )h-11(?: |$)/);assert.match(select.props.className,/appearance-none/);assert.match(select.props.className,/pr-10/);const chevron=elements(tree(),node=>node.type==='svg')[0];assert.equal(chevron.props['aria-hidden'],'true');assert.match(chevron.props.className,/pointer-events-none/);assert.equal(elements(select,node=>node.type==='option').length,4);assert.ok(text(tree()).length>20);assert.ok(!text(tree()).includes('OccupationForm.'));
 select.props.onChange({target:{value:'standard'}});select.props.onChange({target:{value:'invalid'}});assert.deepEqual(changes,[]);
 const reference=primary.occupationReference(primary.primaryOccupationForPositions(null,[role]));assert.ok(reference);
 for(const form of ['feminine','masculine','neutral','standard']){
  select=elements(tree(),node=>node.type==='select')[0];select.props.onChange({target:{value:form}});assert.equal(selected,form);
  const rendered=Picker({positions:[role],selections:[reference],value:reference,onChange(){assert.fail('Changing label form must not select a different occupation');},occupationForm:selected});
  const option=elements(rendered,node=>node.type==='option'&&node.props.value===reference.roleId)[0];assert.ok(option);assert.equal(option.props.value,reference.roleId);
  const messages=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'));
  const translate=namespace=>createTranslator({locale,messages,namespace,onError(error){throw error;}});
  assert.ok(text(option).includes(getDepartmentRoleLabel('licht',role,locale,translate('FilmAnimals'),translate('Taxonomy'),form)));
  if(locale==='de'&&form==='feminine'){assert.match(text(option),/Oberbeleuchterin/);assert.doesNotMatch(text(option),/Oberbeleuchter\*in/);}
  if(locale==='de'&&form==='masculine')assert.doesNotMatch(text(option),/Oberbeleuchterin|Oberbeleuchter\*in/);
 }
 assert.deepEqual(changes,['feminine','masculine','neutral','standard']);
});


for(const locale of locales)test(`${locale}: setup and guided search accept every localized form with the same canonical role`,()=>{
 const messages=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'));
 const translate=namespace=>createTranslator({locale,messages,namespace,onError(error){throw error;}});
 const department=departments.find(item=>item.id==='produktion'),role=department.roles[0];
 const label=(departmentId,role,form)=>getDepartmentRoleLabel(departmentId,role,locale,translate('FilmAnimals'),translate('Taxonomy'),form);
 const forms=(departmentId,role)=>getDepartmentRoleFormLabels(departmentId,role,locale,translate('FilmAnimals'),translate('Taxonomy'));
 // Execute the guided wizard's own search adapter, including its established Grip aliases.
 const source=readFileSync(new URL('../components/GuidedProfileWizard.tsx',import.meta.url),'utf8');
 const ast=ts.createSourceFile('guided.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const declaration=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='roleSearchTerms');
 const compiled=ts.transpileModule(declaration.getText(ast),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const guidedSearchTerms=new Function('getDepartmentRoleSearchTerms','gripSearchTerms',compiled+';return roleSearchTerms;')(getDepartmentRoleSearchTerms,gripSearchTerms);
 for(const form of ['masculine','feminine','neutral']){
  const query=label(department.id,role,form);
  const matches=findQuickStartRoles(query,50,[department.id],(id,title)=>[label(id,title,'standard'),...forms(id,title)]);
  assert.ok(matches.some(value=>value.departmentId===department.id&&value.role===role),query);
  assert.ok(guidedSearchTerms(department,role,label(department.id,role,'standard'),forms(department.id,role)).includes(query),query);
 }
 const grip=departments.find(item=>item.id==='grip');
 assert.ok(guidedSearchTerms(grip,'Key Grip').includes('1. Kamerabühne'));
});
