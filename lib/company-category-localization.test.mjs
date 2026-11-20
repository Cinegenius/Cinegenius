import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {translatorFor} from './i18n-test-fixture.mjs';
import {SUPPORTED_LOCALES} from './i18n/locales.ts';
import {taxonomyLabel} from './departments.ts';
import {COMPANY_CATEGORIES} from './companyCategories.ts';
import {animalCategoryLabel} from './animal-taxonomy.ts';
import {safetyMedicalCompanyCategoryLabel} from './safety-medical-taxonomy.ts';
import * as catering from './catering-taxonomy.ts';

// Exercise the actual form/detail/review label resolver, not a copy of its logic.
function resolver(path, name, locale) {
 const text=readFileSync(new URL(path,import.meta.url),'utf8');
 const file=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let expression;
 const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(file)===name)expression=node.initializer.getText(file);ts.forEachChild(node,visit);};visit(file);
 assert.ok(expression, path);
 const js=ts.transpile(`const resolve = ${expression};`, {target:ts.ScriptTarget.ES2022});
 return new Function('taxonomyLabel','safetyMedicalCompanyCategoryLabel','animalCategoryLabel','animals','safetyMedical','uiText',`${js};return resolve;`)(taxonomyLabel,safetyMedicalCompanyCategoryLabel,animalCategoryLabel,translatorFor(locale,'FilmAnimals'),translatorFor(locale,'SafetyMedical'),translatorFor(locale));
}
for(const locale of SUPPORTED_LOCALES) test(`company editor, detail and setup review use translated categories: ${locale}`,()=>{
 const t=translatorFor(locale), animals=translatorFor(locale,'FilmAnimals'), safetyMedical=translatorFor(locale,'SafetyMedical');
 for(const [path,name] of [['../app/company-setup/page.tsx','categoryLabel'],['../app/companies/[slug]/CompanyDetail.tsx','categoryLabel'],['../components/ProfileSetupWizard.tsx','companyCategoryLabel']]) {
  const label=resolver(path,name,locale);
  for(const category of COMPANY_CATEGORIES) {
   const expected=taxonomyLabel(safetyMedicalCompanyCategoryLabel(category.id,animalCategoryLabel(category.id,category.label,animals),safetyMedical),t);
   assert.equal(label(category.id,category.label),expected,category.id);
  }
  if(locale==='es') {
   assert.equal(label('lichtverleih','Lichtverleih'),'Alquiler de iluminación');
   assert.equal(label('filmproduktion','Filmproduktion'),'Producción cinematográfica');
  }
  assert.equal(label('unknown','My own company wording'),'My own company wording');
 }
});

test('Spanish catering choices display translations but keep the canonical saved values',()=>{
 const path=new URL('../components/CateringCompanyFields.tsx',import.meta.url),require=createRequire(path);
 const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const mod={exports:{}},t=translatorFor('es');
 const mocks={'next-intl':{useTranslations:()=>t},'@/lib/departments':{taxonomyLabel},'@/lib/catering-taxonomy':catering};
 new Function('require','module','exports',code)(name=>mocks[name]??require(name),mod,mod.exports);
 let saved;
 const value={serviceTypes:[],dietaryOptions:[],mobileEquipment:[],serviceAreas:'Mi texto',capacity:null};
 const tree=mod.exports.default({value,onChange:next=>saved=next});
 const html=renderToStaticMarkup(tree);
 assert.ok(!html.includes('Film- und Setcatering'));
 const choices=[];
 const visit=node=>{if(!React.isValidElement(node))return;if(typeof node.type==='function'&&node.props.onClick)choices.push(node);React.Children.forEach(node.props.children,visit);};visit(tree);
 assert.equal(choices.length,catering.CATERING_COMPANY_SERVICES.length+catering.CATERING_DIETARY_OPTIONS.length+catering.CATERING_MOBILE_EQUIPMENT_OPTIONS.length);
 choices[0].props.onClick();
 assert.deepEqual(saved.serviceTypes,[catering.CATERING_COMPANY_SERVICES[0].label]);
 assert.equal(saved.serviceAreas,'Mi texto');
});
