import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function fixture(data=[],error=null){
 const calls=[];const query={};
 for(const method of ['select','eq','or','order','range','limit'])query[method]=(...args)=>{calls.push([method,...args]);return query;};
 query.then=(resolve,reject)=>Promise.resolve({data,error}).then(resolve,reject);
 const mod={exports:{}};
 const source=ts.transpileModule(readFileSync(new URL('./organization-discovery.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('require','module','exports',source)(name=>name==='server-only'?{}:{db:{from:table=>{calls.push(['from',table]);return query;}}},mod,mod.exports);
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
test('homepage requests at most three entries and the dates displayed on cards',async()=>{
 const f=fixture();await f.latestOrganizationEntries();
 assert.ok(f.calls.some(c=>c[0]==='limit'&&c[1]===3));
 assert.ok(f.calls.some(c=>c[0]==='select'&&c[1].includes('starts_at,ends_at,created_at')));
});
test('query errors are not converted to public fallback lists',async()=>{
 const f=fixture([],{message:'unavailable'});await assert.rejects(()=>f.organizationDiscovery());await assert.rejects(()=>f.publicOrganizationLinks({userId:'person'}));
});
