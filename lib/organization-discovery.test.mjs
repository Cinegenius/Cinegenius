import * as browseGeography from './browse-geography.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as taxonomy from './organization-taxonomy.ts';
import * as region from './news-region.ts';
import {UNASSIGNED_COUNTRY} from './places/core.ts';
import * as browseCountry from './browse-country.ts';
function fixture(data=[],error=null,index=[]){
 const calls=[];const query={};
 for(const method of ['select','eq','or','order','range','limit','in'])query[method]=(...args)=>{calls.push([method,...args]);return query;};
 query.then=(resolve,reject)=>Promise.resolve({data,error}).then(resolve,reject);
 const mod={exports:{}};
 const source=ts.transpileModule(readFileSync(new URL('./organization-discovery.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('require','module','exports',source)(name=>({'@/lib/browse-geography':browseGeography,'server-only':{},'@/lib/browse-country':browseCountry,'@/lib/organization-taxonomy':taxonomy,'@/lib/news-region':region,'@/lib/places/core':{UNASSIGNED_COUNTRY},'@/lib/news-discovery':{newsDiscoveryIndex:async()=>index,regionalNews:(rows,country)=>rows.filter(row=>region.newsEntryCountry(row)===country)},'@/lib/db':{db:{from:table=>{calls.push(['from',table]);return query;}}}}[name]),mod,mod.exports);
 return {...mod.exports,calls};
}
test('personal organization links require active membership, explicit consent and approved organization',async()=>{
 const f=fixture();await f.publicOrganizationLinks({userId:'person'});
 for(const expected of [['from','organization_members'],['eq','user_id','person'],['eq','status','active'],['eq','public_profile',true],['eq','organization.moderation_status','approved']])assert.ok(f.calls.some(c=>JSON.stringify(c)===JSON.stringify(expected)));
});
test('company links require accepted association and approved organization',async()=>{
 const f=fixture();await f.publicOrganizationLinks({companyId:'company'});
 for(const expected of [['from','organization_company_links'],['eq','company_id','company'],['eq','status','accepted'],['eq','organization.moderation_status','approved']])assert.ok(f.calls.some(c=>JSON.stringify(c)===JSON.stringify(expected)));
});
test('directory is bounded and paginated, never requests account details',async()=>{
 const f=fixture(Array.from({length:25},(_,i)=>({id:String(i)})));const result=await f.organizationDiscovery(2);
 assert.equal(result.organizations.length,24);assert.equal(result.hasMore,true);
 assert.ok(f.calls.some(c=>c[0]==='range'&&c[1]===24&&c[2]===48));
 assert.ok(!f.calls.find(c=>c[0]==='select')[1].includes('email'));
});
test('home posts require both approvals and exclude expired events',async()=>{
 const f=fixture();await f.latestOrganizationEntries();
 assert.ok(f.calls.some(c=>c[0]==='eq'&&c[1]==='moderation_status'&&c[2]==='approved'));
 assert.ok(f.calls.some(c=>c[0]==='eq'&&c[1]==='organization.moderation_status'&&c[2]==='approved'));
 assert.ok(f.calls.some(c=>c[0]==='or'&&c[1].startsWith('entry_type.eq.news,ends_at.gte.') && c[1].includes('and(ends_at.is.null,starts_at.gte.')));
});
test('default preview requests three entries and the dates displayed on cards',async()=>{
 const f=fixture();await f.latestOrganizationEntries();
 assert.ok(f.calls.some(c=>c[0]==='limit'&&c[1]===3));
 assert.ok(f.calls.some(c=>c[0]==='select'&&c[1].includes('starts_at,ends_at,created_at')));
 assert.ok(f.calls.some(c=>c[0]==='select'&&c[1].includes('image_url,image_gallery')));
});
test('query errors are not converted to public fallback lists',async()=>{
 const f=fixture([],{message:'unavailable'});await assert.rejects(()=>f.organizationDiscovery());await assert.rejects(()=>f.publicOrganizationLinks({userId:'person'}));
});

test('topic filters run before the three-row limit, with both approvals rechecked',async()=>{
 const f=fixture([{id:'tech',topic:'technology'},{id:'changed',topic:'industry'}]);
 assert.deepEqual((await f.latestOrganizationEntries('','technology')).map(row=>row.id),['tech']);
 assert.ok(f.calls.some(c=>c[0]==='eq'&&c[1]==='topic'&&c[2]==='technology'));
 assert.ok(f.calls.some(c=>c[0]==='limit'&&c[1]===3));
});
test('regional topic selection finds an older matching post beyond the first three news items',async()=>{
 const base={organization:{place_country_code:'DE'}};
 const rows=[...Array.from({length:5},(_,i)=>({...base,id:`other-${i}`,topic:'industry'})),{...base,id:'tech',topic:'technology'}];
 const f=fixture([{...base,id:'tech',topic:'technology'},{organization:{place_country_code:'CH'},id:'moved',topic:'technology'}],null,rows);
 assert.deepEqual((await f.latestOrganizationEntries('DE','technology')).map(row=>row.id),['tech']);
 assert.deepEqual(f.calls.find(c=>c[0]==='in'),['in','id',['tech']]);
 const empty=fixture([],null,rows);assert.deepEqual(await empty.latestOrganizationEntries('DE','funding'),[]);
 assert.equal(empty.calls.length,0,'empty selection must not accidentally query unfiltered posts');
});


test('news paging requests at most twelve rows while preserving regional and topic filters',async()=>{
 const base={organization:{place_country_code:'DE'},topic:'technology'};
 const rows=Array.from({length:20},(_,index)=>({...base,id:`tech-${index}`}));
 const f=fixture([...rows,{id:'other-country',organization:{place_country_code:'CH'},topic:'technology'}],null,rows);
 const result=await f.latestOrganizationEntries('DE','technology',1000);
 assert.equal(result.length,12);
 assert.deepEqual(f.calls.find(call=>call[0]==='in'),['in','id',rows.slice(0,12).map(row=>row.id)]);
 assert.ok(f.calls.some(call=>call[0]==='limit'&&call[1]===12));
 assert.ok(f.calls.some(call=>call[0]==='eq'&&call[1]==='topic'&&call[2]==='technology'));
 assert.ok(f.calls.some(call=>call[0]==='eq'&&call[1]==='moderation_status'&&call[2]==='approved'));
 assert.ok(f.calls.some(call=>call[0]==='eq'&&call[1]==='organization.moderation_status'&&call[2]==='approved'));
 for(const [input,limit]of [[Number.NaN,3],[0,1],[4.9,4]]){
  const bounded=fixture(rows);assert.equal((await bounded.latestOrganizationEntries('','technology',input)).length,limit);
  assert.ok(bounded.calls.some(call=>call[0]==='limit'&&call[1]===limit));
 }
});
