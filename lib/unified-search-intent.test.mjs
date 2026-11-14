import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {keywordSearchPlan,normalizeKeywordPlan} from './unified-search-intent.ts';
import {wishSearchTerms,wishMarketplaceCategories} from './unified-search-matching.ts';
import {departments,getDeptLabel} from './departments.ts';
import {occupationCatalogue} from './primary-occupation.ts';
import {SUPPORTED_LOCALES} from './i18n/locales.ts';
const place=(city='',country='')=>({city,country,continent:'',radiusKm:0});
const wish=(query,area='crew',department='')=>({query,area,department,places:[]});

test('keyword lists need neither commas nor conjunctions and keep a shared explicit place',()=>{
 for(const query of ['Beleuchter Kostüm','Beleuchter, Kostüm','Beleuchter und Kostüm','ich suche Beleuchter Kostüm']){
  const plan=keywordSearchPlan(query);assert.equal(plan.searches.length,2);
  assert.deepEqual(plan.searches.map(s=>[s.area,s.query,s.department]),[['crew','Beleuchter',''],['crew','','kostuem']]);
 }
 for(const city of ['Berlin','München','Hamburg']){
  const plan=keywordSearchPlan('Beleuchter Kostüm in '+city);
  assert.equal(plan.searches.length,2);assert.ok(plan.searches.every(w=>JSON.stringify(w.places)===JSON.stringify([place(city)])));
 }
 assert.deepEqual(keywordSearchPlan('Kostüm in der Schweiz').searches[0].places,[place('','CH')]);
 assert.deepEqual(keywordSearchPlan('OB Fahrer').searches.map(s=>s.query),['OB','Fahrer']);
});
test('generic costume keywords search across areas and match every saved department occupation',()=>{
 const expected=occupationCatalogue.filter(r=>r.departmentId==='kostuem').flatMap(r=>r.aliases);
 for(const query of ['Kostüm','kostum','kostuem','Costume']){
  const plan=keywordSearchPlan(query);assert.equal(plan.searches[0].area,'all');
  const terms=wishSearchTerms(wish(query));
  for(const alias of expected)assert.ok(terms.includes(alias),query+': '+alias);
  const categories=wishMarketplaceCategories(query,key=>key);
  assert.ok(categories.includes('kostuem-kleidung'));assert.ok(categories.includes('uniform'));
 }
});
test('all supported locale department labels resolve to the existing shared occupations',()=>{
 for(const locale of SUPPORTED_LOCALES){
  const catalog=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8')).Taxonomy;
  const t=key=>key.split('.').reduce((v,k)=>v?.[k],catalog)??key;
  const department=departments.find(d=>d.id==='kostuem'),label=getDeptLabel(department,locale,undefined,t);
  assert.equal(keywordSearchPlan(label,locale,t).searches[0].query,'Kostüm');
  for(const role of department.roles)assert.ok(wishSearchTerms(wish(label),locale,t).includes(role),locale+': '+role);
 }
});
test('multiword occupations and specific objects are not broadened or split',()=>{
 for(const query of ['Assistant Costume Designer','Model Maker','Production Driver','Social Media Manager'])assert.equal(keywordSearchPlan(query).searches.length,1,query);
 const terms=wishSearchTerms(wish('Assistant Costume Designer'));
 assert.ok(!terms.includes('Kostümbildner*in'));assert.ok(!wishSearchTerms(wish('Model')).includes('Model Maker'));
 for(const query of ['Boot','Motorrad','Auto'])assert.ok(!wishMarketplaceCategories(query,key=>key).includes('fahrzeuge-bild'));
 assert.ok(!wishMarketplaceCategories('Hut',key=>key).includes('kostuem-accessoires'));
 assert.ok(!wishMarketplaceCategories('Kleid',key=>key).includes('kostuem-kleidung'));
});
test('repair of a merged provider query keeps geography without losing other wishes',()=>{
 const model={...wish('Model'),places:[place('Berlin')]};
 const merged={...wish('Beleuchter Kostüm'),places:[place('Hamburg')]};
 const plan=normalizeKeywordPlan({version:1,searches:[model,merged]});
 assert.deepEqual(plan.searches[0],model);assert.equal(plan.searches.length,3);
 assert.ok(plan.searches.slice(1).every(s=>s.places[0].city==='Hamburg'));
 const mixed=normalizeKeywordPlan({version:1,searches:[wish('Kostüm Boot','all')]});
 assert.deepEqual(mixed.searches.map(s=>s.area),['all','marketplace']);
});
test('negations, unknown modifiers, names, different city attachments and excess wishes stay with the interpreter',()=>{
 for(const query of ['kein Kostüm','Beleuchter ohne Kostüm','Beleuchter erfahren','Beleuchter Kostüm irgendwo','Model in Berlin und in Hamburg Beleuchter','wie vorher Kostüm','Boot mieten','Kostümverleih München','Beleuchter Kostüm in UnknownVillage','OB OB OB OB OB OB OB'])assert.equal(keywordSearchPlan(query),null,query);
 const searches=[...Array.from({length:5},()=>wish('Model')),wish('Beleuchter Kostüm')];
 assert.equal(normalizeKeywordPlan({version:1,searches}),null);
});
