import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { browsePlace, geographicRank, prioritizeGeographically, geographicBuckets, geographicPage } from './browse-geography.ts';
import { jobFacts, jobRecord, jobRateLabel, jobSchedule, parseJobDescription, jobDateLabel } from './job-metadata.ts';
import { jobOccupation } from './job-occupation.ts';
import { jobEditValue, jobEditDescription } from './job-editor.ts';
import { validFormDraftKey } from './form-draft.ts';
import { createTranslator } from 'use-intl/core';
import { readFileSync } from 'node:fs';
const home={country:'DE',region:'DE:BY',city:'geonames:2867714'};
const row=(id,country,region=null,city=null)=>({id,place_country_code:country,place_region_id:region,place_city_id:city});
const records=[row('vienna','AT','AT:W','geonames:2761369'),row('unknown',null),row('berlin','DE','DE:BE','geonames:2950159'),row('munich2','DE','DE:BY',home.city),row('augsburg','DE','DE:BY','geonames:2954172'),row('munich1','DE','DE:BY',home.city),row('country-only','DE')];
test('profile preference ranks complete results stably without losing foreign or missing-place records',()=>{
 const original=JSON.stringify(records);
 assert.deepEqual(prioritizeGeographically(records,home).map(row=>row.id),['munich2','munich1','augsburg','berlin','country-only','vienna','unknown']);
 assert.deepEqual(prioritizeGeographically(records,null),records);
 assert.equal(JSON.stringify(records),original);
 assert.equal(browsePlace({location:'Berlin',language:'de'}),null);
 assert.deepEqual(browsePlace({place_country_code:'Deutschland',place_region_id:'DE:BY',place_city_id:home.city}),home);
 assert.equal(browsePlace({place_country_code:'not-a-country'}),null);
});
// Parse the generated PostgREST predicate into SQL and execute its NULL semantics
// in Postgres. Page boundaries must cover each public row exactly once.
function sql(expression){
 if(expression.startsWith('and(')||expression.startsWith('or(')){
  const kind=expression.startsWith('and(')?'AND':'OR',inner=expression.slice(kind==='AND'?4:3,-1),parts=[];let depth=0,start=0;
  for(let i=0;i<inner.length;i++){if(inner[i]==='(')depth++;if(inner[i]===')')depth--;if(inner[i]===','&&!depth){parts.push(inner.slice(start,i));start=i+1;}}
  parts.push(inner.slice(start));return '('+parts.map(sql).join(` ${kind} `)+')';
 }
 const [,column,op,value]=expression.match(/^(place_country_code|place_region_id|place_city_id)\.(eq|neq|is)\.(.+)$/);
 return op==='is'?`${column} IS NULL`:`${column} ${op==='eq'?'=':'<>'} '${value.replaceAll("'","''")}'`;
}
test('database priority precedes pagination, with complete country/region/city and NULL coverage',async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE TABLE places (id text, place_country_code text, place_region_id text, place_city_id text, ordinal int);');
 for(const [i,r] of records.entries())await db.query('INSERT INTO places VALUES ($1,$2,$3,$4,$5)',[r.id,r.place_country_code,r.place_region_id,r.place_city_id,i]);
 for(const preferred of [home,{...home,city:''},{...home,region:'',city:''},null]){
 const calls=[];const read=async(clause,range)=>{calls.push({clause,range});const where=clause?' WHERE '+sql(clause):'';return {data:range?(await db.query(`SELECT * FROM places${where} ORDER BY ordinal LIMIT $1 OFFSET $2`,[range.to-range.from+1,range.from])).rows:null,count:Number((await db.query(`SELECT count(*) FROM places${where}`)).rows[0].count),error:null};};
 const pages=[];for(let offset=0;offset<records.length;offset+=2){const result=await geographicPage(read,offset,offset+1,preferred);assert.equal(result.count,records.length);pages.push(...result.data);}
 assert.deepEqual(pages.map(row=>row.id),prioritizeGeographically(records,preferred).map(row=>row.id));assert.equal(new Set(pages.map(row=>row.id)).size,records.length);
 if(preferred)assert.ok(calls.some(call=>call.range===null));
 }
 for(const clause of geographicBuckets({...home,city:'x),id.neq.secret'}))assert.ok(!clause.includes('secret'));
 }finally{await db.close();}
});
test('failed priority counts cannot become an empty successful directory',async()=>{
 const result=await geographicPage(async()=>({data:null,count:null,error:{code:'offline'}}),0,23,home);
 assert.equal(result.error.code,'offline');assert.equal(result.data,null);
});
test('plain paragraphs, unpaid pay and legacy employment are represented honestly',()=>{
 const raw='A member introduction.\n\nSecond paragraph.\n\nThird paragraph.';
 assert.equal(parseJobDescription(raw).description,raw);
 const job=jobRecord({id:'job',title:'Real role',description:'Rolle: 1. Regieassistenz · Vergütung: Ehrenamtlich / Übung\n\nOriginal prose',price:400,created_at:'2026-01-01'});
 assert.equal(jobFacts(job).jobType,'');assert.equal(job.createdAt,'2026-01-01');
 assert.equal(jobOccupation(job).role,'1-regieassistenz');assert.notEqual(jobOccupation(job).role,'regisseur');
 assert.equal(jobOccupation({...job,description:'A job mentioning director and camera'}),null);
 for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv']){
 const messages=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url)));const t=createTranslator({locale,messages,onError(e){throw e;}});
 assert.equal(jobRateLabel(job,t,locale),t('jobs.payVoluntary'));assert.ok(!jobRateLabel(job,t,locale).includes('400'));
 const scheduled={...job,schedule:jobSchedule({startDate:'2026-11-13',endDate:'2026-11-14',employmentType:'freelance'})};assert.ok(jobDateLabel(scheduled,locale));
 assert.ok(t('BrowseGeography.preferred',{country:messages.CountryNames.DE}));assert.ok(t('JobsRefresh.published',{date:'2026-11-13'}));
 }
});
test('job edits retain warnings and legacy dates while private drafts accept only valid application keys',()=>{
 const raw='Rolle: Regisseur/in · Produktion: Member company · Typ: Kurzfilm · Drehtage: Member dates · Vergütung: Bezahlt · Inhalt: Original warning\n\nMember body';
 const edit=jobEditValue(raw);const next=jobEditDescription(edit,'New member body','de');
 assert.equal(parseJobDescription(next).company,'Member company');assert.deepEqual(parseJobDescription(next).contentWarnings,['Original warning']);assert.equal(parseJobDescription(next).shootDates,'Member dates');assert.equal(parseJobDescription(next).description,'New member body');
 assert.equal(jobSchedule({startDate:'2026-02-30'}),null);assert.equal(jobSchedule({startDate:'2026-11-14',endDate:'2026-11-13'}),null);assert.equal(jobSchedule({employmentType:'invented'}),null);
 assert.equal(validFormDraftKey('application:11111111-1111-4111-8111-111111111111'),true);assert.equal(validFormDraftKey('application:another-account:anything'),false);
});
