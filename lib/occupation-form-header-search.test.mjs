
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {runInNewContext} from 'node:vm';
import {createTranslator} from 'use-intl/core';
import * as occupations from './crew-occupations.ts';
import * as forms from './occupation-form.ts';
import * as search from './occupation-search.ts';
import * as departments from './departments.ts';
import * as privacy from './profile-privacy.ts';

const canonical='Gaffer (Oberbeleuchter)';
function fixture(locale, query) {
 const messages=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'));
 const translations=namespace=>createTranslator({locale,messages,namespace,onError(error){throw error;}});
 const publicPerson={user_id:'public',display_name:'Example',role:'lighting',positions:[canonical],crew:{occupationForm:'feminine'},location:'Private city',bio:'',avatar_url:null};
 const profiles=[publicPerson,{...publicPerson,user_id:'private',display_name:'Hidden'}];
 const filters=[];
 const db={from(table) {
  let rows=[],from=0,to=Infinity;
  const builder={
   select(){return builder;},eq(){return builder;},not(){return builder;},neq(){return builder;},order(){return builder;},limit(){return builder;},
   or(expression){if(table==='profiles'){filters.push(expression);if(expression.includes('positions.ov.{')&&expression.includes(JSON.stringify(canonical)))rows=profiles;}return builder;},
   range(a,b){from=a;to=b;return builder;},
   then(resolve,reject){return Promise.resolve({data:rows.slice(from,to+1),error:null}).then(resolve,reject);},
  };
  return builder;
 }};
 const exports={};
 const modules={
  '@clerk/nextjs/server':{auth:async()=>({userId:null})},
  '@/lib/departments':departments,'@/lib/occupation-form':forms,'@/lib/occupation-search':search,'@/lib/crew-occupations':occupations,
  '@/lib/profile-privacy':privacy,'@/lib/profile-privacy-server':{profileAccessFor:async ids=>new Map(ids.map(id=>[id,{profile:id==='public',location:false,map:false,activity:false,phone:false,email:false}]))},
  '@/lib/db':{db},'next-intl/server':{getTranslations:async namespace=>translations(namespace),getLocale:async()=>locale},
  'next/server':{NextResponse:{json:(body,init)=>({body,init})}},'@/lib/trust':{getPrivateProfileIds:async()=>new Set(['private'])},
  '@/lib/animal-taxonomy':{animalProfileSearchValues:()=>[],animalCompanySearchFilter:()=>''},
  '@/lib/catering-taxonomy':{getCateringProfileSearchValues:()=>[],isCateringSearchQuery:()=>false},
  '@/lib/safety-medical-taxonomy':{safetyMedicalProfileValues:()=>[],safetyMedicalSearchTerms:()=>false},
  '@/lib/marketplaceCategories':{marketplaceSearchCategories:()=>[]},'@/lib/places/catalog':{placeSearchFilter:()=>'',placeReadFields:()=>({})},
  '@/lib/places/core':{placeDisplay:()=>''},'@/lib/listing-price':{listingPriceLabel:()=>''},
 };
 const code=ts.transpileModule(readFileSync(new URL('../app/api/search/route.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 runInNewContext(code,{exports,require(name){assert.ok(name in modules,name);return modules[name];}});
 return {filters,expected:departments.taxonomyLabel(canonical,translations(), 'feminine'),get:()=>exports.GET({nextUrl:new URL(`https://fixture.invalid/api/search?q=${encodeURIComponent(query)}&type=profile`)})};
}
for(const locale of ['de','en','fr','nl','ja'])test(`${locale}: actual header route finds canonical stored work by chosen form without exposing hidden people or city`,async()=>{
 const messages=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'));
 const taxonomy=createTranslator({locale,messages,namespace:'Taxonomy'});
 const query=departments.getDepartmentRoleLabel('licht',canonical,locale,undefined,taxonomy,'feminine');
 const f=fixture(locale,query), response=await f.get();
 const people=Array.from(response.body.results);
 assert.equal(people.length,1);
 assert.equal(people[0].id,'public');
 assert.equal(people[0].subtitle,f.expected);
 assert.ok(!JSON.stringify(people).includes('Private city'));
 assert.ok(!JSON.stringify(people).includes('Hidden'));
 assert.ok(f.filters[0].includes('role.in.('));
 assert.ok(f.filters[0].includes('positions.ov.{'));
});
test('unknown header queries never gain broad occupation predicates',async()=>{
 const f=fixture('de','Unbekannter Beruf ohne Katalogtreffer');
 const result=await f.get();
 assert.equal(result.body.results.length,0);
 assert.ok(!f.filters[0].includes('positions.ov.'));
});
