import test from 'node:test';
import assert from 'node:assert/strict';
import { keywordSearchPlan, normalizeKeywordPlan } from './unified-search-intent.ts';
import { readSearchPlan, unifiedSearchHref, searchPlanFromHref } from './unified-search.ts';
import { matchesSearchRequirements } from './unified-search-requirements.ts';
import { validateGenieRequest } from './genie.ts';

const place=city=>({city,country:'',continent:'',radiusKm:0});
const wish=(query,area='crew')=>({area,query,department:'',places:[place('Berlin')]});

test('new links retain quantities, explicit requirements and suggestions; old links stay readable',()=>{
 const searches=[{...wish('Studio','locations'),quantity:2,recommended:true,requirements:[['rollstuhlgerecht','wheelchair accessible'],['Tageslicht','daylight']],exclude:['Keller']}];
 const plan=readSearchPlan({version:2,searches});assert.deepEqual(plan,{version:2,searches});
 assert.deepEqual(searchPlanFromHref(unifiedSearchHref(plan)),plan);
 assert.deepEqual(normalizeKeywordPlan(plan),plan);
 assert.ok(readSearchPlan({version:1,searches:[wish('Model')]}));
 assert.equal(readSearchPlan({version:1,searches}),null);
 for(const patch of [{quantity:0},{quantity:1000},{quantity:1.5},{requirements:[[]]},{requirements:[['']]},{exclude:['']},{recommended:'yes'},{places:[place('')]},{ownerId:'admin'}])assert.equal(readSearchPlan({version:2,searches:[{...wish('Model'),...patch}]}),null);
});

test('recognized clauses preserve independent and shared places without a paid interpretation',()=>{
 const cases=[
  ['OB und Produktionsfahrer in München',[['crew','München'],['crew','München']]],
  ['Model in Berlin und in Hamburg einen Beleuchter',[['crew','Berlin'],['crew','Hamburg']]],
  ['Jemand vom Kostüm und ein Boot in Berlin',[['crew','Berlin'],['marketplace','Berlin']]],
  ['Fahrer in München und Fahrer in Berlin',[['crew','München'],['crew','Berlin']]],
  ['Model in Berlin und Boot in Hamburg',[['crew','Berlin'],['marketplace','Hamburg']]],
 ];
 for(const [input,expected]of cases)assert.deepEqual(keywordSearchPlan(input)?.searches.map(w=>[w.area,w.places[0]?.city]),expected,input);
 assert.deepEqual(keywordSearchPlan('Beleuchter in Berlin und Hamburg')?.searches[0].places,[place('Berlin'),place('Hamburg')]);
 assert.deepEqual(keywordSearchPlan('zwei Beleuchter und drei Fahrer in München')?.searches.map(w=>w.quantity),[2,3]);
 for(const input of ['Model in Berlin und Fahrer','vegan oder vegetarisch Catering Berlin','Beleuchter ohne Führerschein München'])assert.equal(keywordSearchPlan(input),null,input);
});

test('requirements are AND, aliases are OR, negatives and unsupported/private claims never qualify',()=>{
 const query={...wish('Studio','locations'),requirements:[['rollstuhlgerecht','wheelchair accessible'],['daylight','Tageslicht']],exclude:['Keller','basement']};
 assert.ok(matchesSearchRequirements({title:'Studio',description:'Wheelchair accessible. Viel Tageslicht.'},query));
 assert.ok(matchesSearchRequirements({special_skills:'Auf Kommando bellen'}, {...wish('Hund','animals'),requirements:[['Auf Kommando bellen']]}));
 for(const row of [
  {description:'Viel Tageslicht.'},
  {description:'Nicht rollstuhlgerecht. Viel Tageslicht.'},
  {description:'Wheelchair accessible, no daylight.'},
  {description:'Rollstuhlgerecht mit Tageslicht im Keller.'},
  {description:'Nicht rollstuhlgerecht.',services:['wheelchair accessible','Tageslicht']},
  {metadata:{description:'Rollstuhlgerecht mit Tageslicht'},private_notes:'wheelchair accessible daylight'},
 ])assert.equal(matchesSearchRequirements(row,query),false,JSON.stringify(row));
 assert.ok(matchesSearchRequirements({description:'Kein Keller. Rollstuhlgerecht mit Tageslicht.'},query));
 assert.equal(matchesSearchRequirements({description:'Vegan'}, {...wish('Catering','companies'),requirements:[['vegan'],['glutenfrei']]}),false);
});

test('search context is bounded data, cannot grant account access and is excluded from writing',()=>{
 const base={area:'general',locale:'de',messages:[{role:'user',content:'lieber Hamburg'}]};
 const searchContext={plan:{version:2,searches:[wish('Model'),{...wish('Boot','marketplace'),quantity:2}]},wishIndex:1};
 assert.deepEqual(validateGenieRequest({...base,searchContext}).value.searchContext,searchContext);
 for(const context of [{...searchContext,wishIndex:2},{...searchContext,accountId:'admin'},{...searchContext,plan:{...searchContext.plan,searches:[]}}])assert.equal(validateGenieRequest({...base,searchContext:context}).ok,false);
 assert.equal(validateGenieRequest({...base,area:'profile',writing:{maxLength:200},searchContext}).ok,false);
});

test('localized complete production starters preserve the full selection and leave extra requirements to interpretation',()=>{
 for(const request of ['Je tourne à Berlin','Kręcę w Berlin','Estou a filmar em Berlin','我计划在Berlin拍摄。','Berlinで撮影を計画しています。','Berlin에서 촬영을 계획하고 있어요','Я планирую съёмки в Berlin','Я планую зйомки у Berlin']){
  const p=keywordSearchPlan(request);assert.ok(p,request);assert.equal(p.searches[0].query,'Production Crew');assert.ok(p.searches.every(w=>w.places[0].city==='Berlin'));
 }
 assert.equal(keywordSearchPlan('Je tourne à Berlin sans équipe'),null);
 assert.equal(keywordSearchPlan('Я планирую съёмки в Berlin только ночью'),null);
});
