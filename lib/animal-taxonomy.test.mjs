import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import * as animals from './animal-taxonomy.ts';
import {departments,getDeptLabel,getDepartmentRoleLabel} from './departments.ts';
import {FILM_DEPARTMENTS} from './filmRoles.ts';
import {occupationChoices,occupationById,readPrimaryOccupation,occupationReference} from './primary-occupation.ts';
import {crewOccupationIds,filterCrewOccupations} from './crew-occupations.ts';
import {createQuickStartIntentData,normalizeQuickStartDraft,START_QUICK_START_DRAFT,findQuickStartRoles,QUICK_START_CATEGORIES} from './quick-start-flow.ts';
import {normalizeListingImageGallery} from './listing-image-gallery.ts';
const dept=animals.ANIMAL_DEPARTMENT_ID;

test('every animal role exists once, in one shared department, with separate people and agency catalogues',()=>{
 const profile=departments.find(d=>d.id===dept),jobs=FILM_DEPARTMENTS.find(d=>d.id===dept);
 assert.equal(profile.roles.length,9);assert.equal(jobs.roles.length,9);
 for(const role of animals.ANIMAL_OCCUPATIONS){
  assert.equal(jobs.roles.filter(r=>r.id===role.id).length,1);
  assert.deepEqual(occupationChoices([role.label]).map(r=>r.departmentId),[dept]);
  assert.equal(FILM_DEPARTMENTS.flatMap(d=>d.roles).filter(r=>r.id===role.id).length,1);
 }
 assert.equal(animals.animalOccupation('Cable Wrangler'),null);assert.equal(animals.animalOccupation('Data Wrangler'),null);
 assert.ok(departments.find(d=>d.id==='cast').roles.includes('Stunt Rider'));
 for(const category of animals.ANIMAL_COMPANY_CATEGORIES)assert.ok(QUICK_START_CATEGORIES.company.some(c=>c.value===category.id));
});
test('saved legacy selections and explicit main references migrate on read without editing stored titles or losing secondary jobs',()=>{
 for(const title of ['Tiertrainer*in','Tierbetreuer*in','Horse Master','Horse Wrangler']){
  const original={positions:[title,'Gaffer (Oberbeleuchter)']};
  const ids=crewOccupationIds(original);assert.ok(ids.some(id=>occupationById(id)?.departmentId===dept));assert.ok(ids.some(id=>occupationById(id)?.departmentId==='licht'));
  const profiles=[{id:'own',occupationIds:ids}];assert.equal(filterCrewOccupations(profiles,dept).length,1);assert.equal(filterCrewOccupations(profiles,'licht').length,1);assert.equal(filterCrewOccupations(profiles,'kamera').length,0);
  assert.deepEqual(original.positions,[title,'Gaffer (Oberbeleuchter)']);
 }
 const old={departmentId:'set-logistik',roleId:'set-logistik/'+encodeURIComponent('Tiertrainer*in')};
 const resolved=readPrimaryOccupation(old);assert.equal(resolved.departmentId,dept);assert.equal(occupationReference(resolved).departmentId,dept);
 assert.equal(readPrimaryOccupation({...old,departmentId:'kamera'}),null);
 const draft=normalizeQuickStartDraft({...START_QUICK_START_DRAFT,name:'Own Trainer',intents:['crew','company'],sections:{crew:{...createQuickStartIntentData(),departmentIds:['set-logistik'],roles:[{departmentId:'set-logistik',role:'Tiertrainer*in'}]},company:{...createQuickStartIntentData(),categoryIds:['filmhundagentur'],animalDetails:{serviceTypes:['dog-training'],species:['dogs','horses'],otherSpecies:'Own fictional specialist'}}}});
 assert.equal(draft.sections.crew.roles[0].departmentId,dept);assert.deepEqual(draft.sections.company.animalDetails.species,['dogs','horses']);
});
test('training, handling and care remain distinct; synonyms find the canonical role and species aliases retain old horse listings',()=>{
 assert.equal(animals.animalOccupation('Tiertrainer/in für Film, Fernsehen und Werbung').id,'tiertrainer');
 assert.equal(animals.animalOccupation('Animal Handler').id,'tierbetreuer');assert.equal(animals.animalOccupation('Set-Tierbetreuung').id,'set-tierbetreuung');
 for(const q of ['Filmhund','Filmtier','Tiertrainer','Animal Trainer','Animal Handler'])assert.ok(findQuickStartRoles(q).some(role=>role.departmentId===dept),q);
 assert.equal(animals.animalSpecies('Pferde').id,animals.animalSpecies('Pferde & Ponys').id);
 assert.equal(animals.animalCompanySearchFilter('Filmhund'), 'categories.cs.{filmhundagentur},animal_details->species.cs.["dogs"]');
 assert.equal(animals.animalCompanySearchFilter('Horse Trainer'), 'animal_details->species.cs.["horses"]');
 assert.equal(animals.animalCompanySearchFilter('Filmhund),admin.eq.true'),animals.animalCompanySearchFilter('Filmhund'));
 assert.equal(animals.animalCompanySearchFilter('Cable Wrangler'),'');
 assert.doesNotMatch(animals.animalCompanySearchText({species:['horses']},['tiervermittlung']),/Film Dog Agency|Filmhundagentur/);
 const details=animals.normalizeAnimalCompanyDetails({species:['dogs','dogs','horses','admin'],serviceTypes:['animal-training','sale'],otherSpecies:' Own specialist '});
 assert.deepEqual(details.species,['dogs','horses']);assert.deepEqual(details.serviceTypes,['animal-training']);assert.equal(details.otherSpecies,'Own specialist');
});
test('six locale catalogs translate the same stable animal role/category/service/species IDs without modifying them',()=>{
 for(const locale of ['de','en','es','it','cs','hu']){
  const messages=JSON.parse(readFileSync(new URL('../messages/'+locale+'.json',import.meta.url),'utf8')).FilmAnimals;
  const t=key=>key.split('.').reduce((v,k)=>v?.[k],messages);
  assert.ok(getDeptLabel(departments.find(d=>d.id===dept),locale,t));
  for(const role of animals.ANIMAL_OCCUPATIONS)assert.equal(getDepartmentRoleLabel(dept,role.label,locale,t),messages.roles[role.id]);
  for(const cat of animals.ANIMAL_COMPANY_CATEGORIES)assert.ok(t('categories.'+cat.id));
  for(const id of animals.ANIMAL_SERVICE_IDS)assert.ok(t('services.'+id));
  for(const {id} of animals.ANIMAL_SPECIES)assert.ok(t('species.'+id));
 }
});
test('animal portfolios are never sale/rental offers and use the existing ordered ten-photo gallery',()=>{
 assert.equal(animals.animalPortfolioMetadata('Hunde',{},'kauf'),null);assert.equal(animals.animalPortfolioMetadata('Katzen',{rental_type:'kauf'}),null);
 assert.equal(animals.animalPortfolioMetadata('Equipment',{}),null);
 const metadata=animals.animalPortfolioMetadata('Pferde & Ponys',{special_skills:'Own fictional skills',count:'2',rental_type:'miete',handler_included:true});
 assert.equal(metadata.species,'horses');assert.equal(metadata.offer_kind,'animal_portfolio');assert.equal(metadata.rental_type,undefined);
 const images=Array.from({length:10},(_,i)=>`https://own-test.invalid/animal-${i}.jpg`);
 assert.equal(normalizeListingImageGallery(images[0],images.slice(1),10).ok,true);assert.equal(normalizeListingImageGallery(images[0],[...images.slice(1),'https://own-test.invalid/extra.jpg'],10).ok,false);
});
test('company species migration preserves existing firms and client boundaries without publishing or changing memberships',async()=>{
 const pg=new PGlite();try{
 await pg.exec("create role anon;create role authenticated;create role service_role;create table companies(id text,name text,published boolean);insert into companies values('own','Own fictional company',false);grant select(name) on companies to anon;grant select(name),update(name) on companies to authenticated;");
 const sql=readFileSync(new URL('../supabase/migrations/20261028220000_film_animal_company_details.sql',import.meta.url),'utf8');await pg.exec(sql);await pg.exec(sql);
 const original=(await pg.query('select id,name,published from companies')).rows;assert.deepEqual(original,[{id:'own',name:'Own fictional company',published:false}]);
 await pg.query('update companies set animal_details=$1 where id=$2',[animals.normalizeAnimalCompanyDetails({species:['dogs','cats']}),'own']);
 assert.equal((await pg.query(`select count(*)::int n from companies where animal_details->'species' @> '["dogs"]'::jsonb`)).rows[0].n,1);
 assert.equal((await pg.query(`select count(*)::int n from companies where animal_details->'species' @> '["birds"]'::jsonb`)).rows[0].n,0);
 for(const role of ['anon','authenticated'])assert.equal((await pg.query("select has_column_privilege($1,'companies','animal_details','update') ok",[role])).rows[0].ok,false);
 assert.equal((await pg.query("select has_column_privilege('service_role','companies','animal_details','update') ok")).rows[0].ok,true);
 }finally{await pg.close();}
});
