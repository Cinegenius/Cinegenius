import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cateringSearch,matchesCateringSearch} from './unified-search-catering.ts';
import {keywordSearchPlan,normalizeKeywordPlan} from './unified-search-intent.ts';
import {departmentHeadRoles,matchingDepartmentHead,DEPARTMENT_HEADS_QUERY,PRODUCTION_CREW_QUERY,productionCrewSegments,productionCrewTerms,matchingProductionRole} from './unified-search-production.ts';
import {wishSearchTerms} from './unified-search-matching.ts';
import {getDepartmentRoleLabel} from './departments.ts';
import {SUPPORTED_LOCALES} from './i18n/locales.ts';
const company=(extra={})=>({name:'Setküche',categories:['catering-setverpflegung'],catering_details:{dietaryOptions:['Vegan'],serviceTypes:['Film- und Setcatering']},...extra});

test('a film brief offers declared occupations across departments and separate themed suppliers, without making the theme a crew requirement',()=>{
 for(const input of ['Ich drehe in Berlin einen Polizei Film','ich drehe einen Polizeifilm in Berlin','Ich plane in Berlin einen Polizeifilm.','I am shooting a police film in Berlin']){
  const p=keywordSearchPlan(input);assert.ok(p,input);assert.ok(p.searches.length<=6);assert.ok(p.searches.every(w=>w.places[0].city==='Berlin'));
  const crew=p.searches.find(w=>w.area==='crew');assert.equal(crew.query,PRODUCTION_CREW_QUERY);
  const terms=productionCrewSegments.flatMap(segment=>productionCrewTerms(segment));for(const role of ['Gaffer','Tonmeister / Sound Mixer','Head of Make-up & Hair','Director of Photography (DoP)','Costume Designer'])assert.ok(terms.includes(role),role);
  assert.ok(!terms.includes('Polizei'));assert.ok(terms.includes('Licht Praktikant*in'));assert.ok(terms.includes('Make-up Assistant'));
  for(const area of ['marketplace','locations','companies'])assert.ok(p.searches.some(w=>w.area===area&&w.query==='Polizei'));
  assert.ok(p.searches.every(w=>w.recommended));
  assert.ok(p.searches.some(w=>w.area==='companies'&&w.query==='Catering'));
 }
 for(const input of ['Ich drehe keinen Polizeifilm in Berlin','Ich drehe in Berlin einen Polizeifilm ohne Catering','Ich drehe einen Film in Berlin und Hamburg','Ich drehe einen Film in UnknownVillage','Ich drehe in Berlin einen Film in Hamburg'])assert.equal(keywordSearchPlan(input),null,input);
});

test('lead status comes from an exact declared role, not a biography or assistant title; localized titles use the same catalogue',()=>{
 assert.ok(departmentHeadRoles.some(r=>r.departmentId==='licht'));
 assert.equal(matchingDepartmentHead({role:'Make-up Assistant',bio:'I work with heads of department'}),undefined);
 assert.equal(matchingDepartmentHead({role:'Gaffer Assistant',positions:['Assistant Costume Designer']}),undefined);
 assert.equal(matchingDepartmentHead({role:'Camera Operator',positions:['Gaffer']}).label,'Gaffer (Oberbeleuchter)');
 assert.equal(matchingDepartmentHead({role:'Gaffer',positions:['Line Producer','Gaffer']}).label,'Gaffer (Oberbeleuchter)');
 for(const locale of SUPPORTED_LOCALES){
  const catalog=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'));
  const t=k=>k.split('.').reduce((v,p)=>v[p],catalog.Taxonomy);
  assert.ok(catalog.UnifiedSearch.departmentHeads);
  for(const role of departmentHeadRoles)assert.ok(wishSearchTerms({area:'crew',query:DEPARTMENT_HEADS_QUERY,department:'',places:[]},locale,t).includes(getDepartmentRoleLabel(role.departmentId,role.label,locale,undefined,t)));
 }
});

test('catering requests bind service, dietary requirements and place; specializations and negations are not discarded',()=>{
 for(const input of ['ich suche ein veganes catering in berlin','veganes Catering Berlin','Berlin veganes Catering','Catering vegan in Berlin']){
  const p=keywordSearchPlan(input);assert.ok(p,input);assert.equal(p.searches.length,1);assert.equal(p.searches[0].area,'companies');assert.equal(p.searches[0].places[0].city.toLowerCase(),'berlin');assert.deepEqual(cateringSearch(p.searches[0].query).dietary,['Vegan']);
 }
 const normalized=normalizeKeywordPlan({version:1,searches:[{area:'all',query:'Vegan Catering',department:'',places:[]}]});assert.equal(normalized.searches[0].area,'companies');
 assert.equal(keywordSearchPlan('Catering-Leitung').searches[0].area,'crew');
 for(const input of ['nicht veganes Catering in Berlin','vegan oder vegetarisch Catering','zertifiziert veganes Catering','vegan catering without nuts'])assert.equal(keywordSearchPlan(input),null,input);
 const both=cateringSearch('glutenfreies veganes Catering');assert.deepEqual(both.dietary,['Vegan','Glutenfrei']);
 assert.equal(matchesCateringSearch(company(),both),false);
 assert.equal(matchesCateringSearch(company({catering_details:{dietaryOptions:['Vegan','Glutenfrei']}}),both),true);
});

test('dietary and catering-type matching requires declared support, and does not mistake vegetarian, unrelated or negative mentions for vegan catering',()=>{
 const search=cateringSearch('veganes Catering');
 assert.ok(matchesCateringSearch(company(),search));
 for(const row of [company({catering_details:{dietaryOptions:['Vegetarisch']}}),{name:'Vegan Studio',categories:['fotostudio'],description:'Vegan film studio'},company({description:'Wir bieten kein veganes Catering.'}),company({description:'Vegan is not available.'}),company({description:'No vegan options available.'})])assert.equal(matchesCateringSearch(row,search),false,JSON.stringify(row));
 assert.ok(matchesCateringSearch(company({catering_details:null,description:'Wir bieten veganes Catering und Filmverpflegung.'}),search));
 assert.ok(matchesCateringSearch(company({catering_details:null,description:'Vegan ohne Fleisch.'}),search));
 assert.ok(matchesCateringSearch(company({catering_details:null,description:'Keine Filmproduktion. Veganes Catering.'}),search));
 assert.equal(matchesCateringSearch(company({description:'Wir bieten kein Catering. Nur veganes Restaurant.'}),search),false);
 assert.equal(matchesCateringSearch(company({description:'Geen veganistische opties beschikbaar.'}),search),false);
 assert.ok(matchesCateringSearch(company(),cateringSearch('veganes Setcatering')));
 assert.ok(matchesCateringSearch(company(),cateringSearch('vegan Film- und Setcatering')));
 assert.equal(matchesCateringSearch(company(),cateringSearch('veganes Eventcatering')),false);
 assert.equal(matchesCateringSearch(company(),cateringSearch('vegan foodtruck')),false);
 assert.ok(matchesCateringSearch(company({catering_details:{serviceTypes:['Mobiles Catering / Foodtruck'],dietaryOptions:['Vegan']}}),cateringSearch('vegan foodtruck')));
});

test('all supported languages retain the same dietary requirement with real city scope',()=>{
 for(const [locale,input] of [['de','veganes Catering in Berlin'],['en','vegan catering in Berlin'],['es','catering vegano en Berlin'],['it','catering vegano in Berlin'],['cs','vegansky catering v Berlin'],['hu','vegán catering Berlin'],['nl','veganistisch catering in Berlin'],['nl-BE','vegan catering in Berlin'],['sv','veganskt catering i Berlin']]){
  const p=keywordSearchPlan(input,locale);assert.ok(p,locale);assert.equal(p.searches.length,1);assert.deepEqual(cateringSearch(p.searches[0].query).dietary,['Vegan']);assert.equal(p.searches[0].places[0].city,'Berlin');
 }
});


test('unqualified filming opens the full production selection in every supported language without consuming wishes per department',()=>{
 const cases=[['de','ich drehe in münchen'],['en','I am filming in München'],['es','Estoy rodando en München'],['it','Sto girando a München'],['cs','Natáčím v München'],['hu','Münchenben forgatok'],['nl','Ik film in München'],['nl-BE','Ik draai in München'],['sv','Jag ska filma i München']];
 for(const [locale,text] of cases){
  const p=keywordSearchPlan(text,locale);assert.ok(p,text);assert.equal(p.searches.length,5,text);
  assert.equal(p.searches[0].query,PRODUCTION_CREW_QUERY);assert.ok(p.searches.every(w=>w.recommended&&w.places[0].city.toLowerCase()==='münchen'));
  assert.deepEqual(new Set(p.searches.map(w=>w.area)),new Set(['crew','locations','marketplace','companies']));
  assert.ok(p.searches.some(w=>w.query==='Catering'));assert.ok(p.searches.some(w=>w.query==='Firma'));
  const catalog=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'));assert.ok(catalog.UnifiedSearch.productionCrew);
 }
 for(const text of ['Ich möchte in München drehen.','Ich will in München filmen','Ich drehe einen Film in München'])assert.equal(keywordSearchPlan(text).searches[0].query,PRODUCTION_CREW_QUERY);
 for(const text of ['Ich drehe nicht in München','Ich drehe nur ein kleines Interview in München','Ich drehe in München ohne Catering','Ich drehe in München und Berlin','Ich drehe in UnknownVillage','Ich brauche nur einen Kameramann in München'])assert.ok(!keywordSearchPlan(text)?.searches.some(w=>w.query===PRODUCTION_CREW_QUERY),text);
 assert.equal(matchingProductionRole({role:'Make-up Assistant'},'maske')?.departmentId,'maske');
 assert.equal(matchingDepartmentHead({role:'Make-up Assistant'}),undefined);
 assert.equal(matchingProductionRole({role:'Locationanbieter',bio:'Ich kenne Kameraleute'}),undefined);
});
