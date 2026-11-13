import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {browsePlace} from './browse-geography.ts';
function load(file,deps){const mod={exports:{}};const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports','module',code)(name=>{assert.ok(name in deps,`Unmocked I/O: ${name}`);return deps[name];},mod.exports,mod);return mod.exports;}
test('only the current authenticated account supplies a preference; guests make no database read',async()=>{
 let account=null,failed=false;const reads=[];
 const db={from(table){assert.equal(table,'profiles');const query={select(columns){assert.ok(!columns.includes('*'));return query;},eq(column,id){reads.push([column,id]);return query;},async maybeSingle(){return {data:{location:'ignored ambiguous label',place_country_code:account==='A'?'DE':'AT',place_city_id:null},error:failed?{code:'offline'}:null};}};return query;}};
 const {ownBrowsePlace}=load('./browse-geography-server.ts',{'server-only':{},'@clerk/nextjs/server':{auth:async()=>({userId:account})},'@/lib/db':{db},'@/lib/browse-geography':{browsePlace},'@/lib/places/core':{PLACE_COLUMNS:'place_country_code,place_city_id'},'@/lib/places/catalog':{placeReadFields:(_,row)=>row}});
 assert.deepEqual(await ownBrowsePlace(),{userId:null,place:null});assert.equal(reads.length,0);
 account='A';assert.equal((await ownBrowsePlace()).place.country,'DE');account='B';assert.equal((await ownBrowsePlace()).place.country,'AT');
 assert.deepEqual(reads,[['user_id','A'],['user_id','B']]);failed=true;await assert.rejects(ownBrowsePlace(),/unavailable/);
});
test('application recovery rechecks public job access and rejects own or withdrawn jobs',async()=>{
 let job={type:'job',published:true,user_id:'owner'},error=null;
 const query={select(){return query;},eq(column,value){assert.equal(column,'id');assert.equal(value,'11111111-1111-4111-8111-111111111111');return query;},async maybeSingle(){return {data:job,error};}};
 const {canUseFormDraft}=load('./form-draft-access.ts',{'server-only':{},'@/lib/organization-access':{},'@/lib/company-access':{},'@/lib/listing-access':{},'@/lib/db':{db:{from(table){assert.equal(table,'listings');return query;}}}});
 const key='application:11111111-1111-4111-8111-111111111111';assert.equal(await canUseFormDraft('applicant',key),true);assert.equal(await canUseFormDraft('owner',key),false);
 job={...job,published:false};assert.equal(await canUseFormDraft('applicant',key),false);job={...job,published:true,type:'prop'};assert.equal(await canUseFormDraft('applicant',key),false);job=null;assert.equal(await canUseFormDraft('applicant',key),false);
 error={code:'offline'};await assert.rejects(canUseFormDraft('applicant',key),/unavailable/);
});
