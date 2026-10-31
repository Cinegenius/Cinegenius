import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function fixture(){
 const calls=[];let visible=true,fail=false;
 const db={from(table){const filters=[];const q={select(){return q},eq(...args){filters.push(args);return q},maybeSingle:async()=>{calls.push({table,filters});return {error:fail?{}:null,data:table==='companies'?{id:'own-company',name:'Own Company',published:visible,slug:'own-company',owner_user_id:'real-owner'}:{user_id:'own-user',display_name:visible?'Own Person':'Updated Person',slug:'own-person',avatar_url:null}}}};return q}};
 const mocks={'server-only':{},'@/lib/db':{db},'@/lib/trust':{canViewProfile:async(user,viewer)=>{calls.push({permission:[user,viewer]});return visible}},'@/lib/responsible-person-server':{responsibleForCompany:async(value,company,owner)=>{calls.push({company,owner});return value},publicResponsiblePerson:async value=>{calls.push({responsible:value});return value?.public?{name:value.firstName,function:value.function,href:null}:null}}};
 const code=ts.transpileModule(readFileSync(new URL('./listing-provider.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',code)(name=>{if(!Object.hasOwn(mocks,name))throw Error('Unexpected dependency '+name);return mocks[name]},mod,mod.exports);
 return{...mod.exports,calls,setVisible:v=>{visible=v},setFailure:v=>{fail=v}};
}
test('repeated identical provider rows share one lookup within the batch, without changing list order or contacts',async()=>{
 const f=fixture();const row={user_id:'own-user',company_id:null,responsible_person:{userId:'own-user',firstName:'Own',public:true,function:'rental'}};
 const providers=await f.getListingProviders(Array.from({length:4},()=>({...row})),null);
 assert.equal(providers.length,4);assert.ok(providers.every(p=>p.name==='Own Person'&&p.responsible.name==='Own'&&p.href==='/profile/own-person'));
 assert.equal(f.calls.filter(c=>c.table==='profiles').length,1);assert.equal(f.calls.filter(c=>c.permission).length,1);
});
test('different privacy, roles, providers and company attribution never share a contact result',async()=>{
 const f=fixture();const base={userId:'own-user',firstName:'Own',public:true,function:'rental'};
 const providers=await f.getListingProviders([{user_id:'own-user',responsible_person:base},{user_id:'own-user',responsible_person:{...base,public:false}},{user_id:'own-user',responsible_person:{...base,function:'operator'}},{user_id:'technical-admin',company_id:'own-company',responsible_person:base}],'viewer');
 assert.equal(providers[0].responsible.function,'rental');assert.equal(providers[1].responsible,null);assert.equal(providers[2].responsible.function,'operator');
 assert.equal(providers[3].name,'Own Company');assert.equal(providers[3].contactUserId,'real-owner');assert.equal(providers[3].href,'/companies/own-company');
 assert.equal(f.calls.filter(c=>c.table==='profiles').length,3);assert.equal(f.calls.filter(c=>c.table==='companies').length,1);
 f.setVisible(false);const hidden=await f.getListingProviders([{user_id:'technical-admin',company_id:'own-company'}]);assert.equal(hidden[0].kind,'unassigned','private company never falls back to technical creator');
});
test('each new batch rechecks data and permissions; failures are not cached across requests',async()=>{
 const f=fixture();const rows=[{user_id:'own-user'},{user_id:'own-user'}];
 await f.getListingProviders(rows,'viewer-a');f.setVisible(false);const next=await f.getListingProviders(rows,'viewer-b');
 assert.equal(next[0].href,null);assert.equal(next[0].name,'Updated Person');assert.equal(f.calls.filter(c=>c.table==='profiles').length,2);
 assert.deepEqual(f.calls.filter(c=>c.permission).map(c=>c.permission[1]),['viewer-a','viewer-b']);
 f.setFailure(true);await assert.rejects(f.getListingProviders(rows),/could not be loaded/);f.setFailure(false);assert.equal((await f.getListingProviders(rows))[0].kind,'person');
});
