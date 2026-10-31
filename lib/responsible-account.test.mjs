import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {NextResponse} from 'next/server.js';
import * as model from './responsible-person.ts';
import {hasProfileBasics} from './profile-setup-flow.ts';
import {normalizeQuickStartDraft} from './quick-start-flow.ts';
const require=createRequire(import.meta.url);
function load(file,mocks){const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const m={exports:{}};new Function('require','module','exports',code)(n=>Object.hasOwn(mocks,n)?mocks[n]:require(n),m,m.exports);return m.exports;}
const own='own-test-account', name={firstName:'Alex',lastName:'Beispiel'};
const common={'server-only':{},'next/server':{NextResponse},'next-intl/server':{getTranslations:async()=>key=>key},'@/lib/responsible-person':model,'@/lib/profile-setup-flow':{hasProfileBasics},'@/lib/linked-profile-access':{visibleLinkedProfileIds:async()=>new Set()}};
function contactServer({user={},offers=[],companies=[],dataError=false,profile=null}={}){
 return load('./responsible-person-server.ts',{...common,'@clerk/nextjs/server':{clerkClient:async()=>({users:{getUser:async()=>user}})},'@/lib/db':{db:{from(table){const q={select(){return q},eq(){return q},limit:async()=>({data:table==='listings'?offers:companies,error:dataError}),maybeSingle:async()=>({data:profile,error:null})};return q}}}});
}
test('account identity is private, structured and preferred to an older Clerk name; no public profile is required',async()=>{
 const s=contactServer({user:{firstName:'Old',lastName:'Name',privateMetadata:{[model.ACCOUNT_RESPONSIBLE_PERSON_KEY]:name}}});
 const result=await s.accountResponsiblePerson(own);assert.equal(result.firstName,'Alex');assert.equal(result.lastName,'Beispiel');assert.equal(result.public,false);assert.equal(result.profileName,undefined);
 assert.equal((await s.validateResponsiblePerson(undefined,own)).person.public,false);
});
test('old owned offers can supply one unambiguous structured name, without changing their private snapshot',async()=>{
 const snapshot={...name,userId:own,public:false};
 const result=await contactServer({offers:[{responsible_person:snapshot}],companies:[{responsible_person:snapshot}]}).accountResponsiblePerson(own);
 assert.equal(result.firstName,'Alex');assert.equal(result.public,false);assert.deepEqual(snapshot,{...name,userId:own,public:false});
 for(const data of [
  {offers:[{responsible_person:snapshot},{responsible_person:{...snapshot,firstName:'Another'}}]},
  {offers:[{responsible_person:{...snapshot,userId:'foreign'}}]},
  {offers:Array.from({length:100},()=>({responsible_person:snapshot}))},
  {offers:[{responsible_person:snapshot}],dataError:true},
 ]) assert.equal((await contactServer(data).accountResponsiblePerson(own)).firstName,'');
});
test('new disclosed forms and old explicit private choices remain separate, including draft recovery',()=>{
 assert.equal(model.NEW_RESPONSIBLE_PERSON.public,true);assert.equal(model.EMPTY_RESPONSIBLE_PERSON.public,false);
 assert.equal(model.responsiblePersonDraft({...name,public:false}).public,false);
 const draft=normalizeQuickStartDraft({version:3,name:'Alex Beispiel',accountPerson:{...model.NEW_RESPONSIBLE_PERSON,...name},intents:['company','location'],sections:{company:{responsible:{...name,public:false}},location:{}}});
 assert.deepEqual(model.responsibleAccountName(draft.accountPerson),name);assert.equal(draft.sections.company.responsible.public,false);assert.equal(draft.sections.location.responsible.public,true);
 assert.equal(model.responsibleAccountName({firstName:'mail@example.invalid',lastName:'Person'}),null);
});
test('actual private account API authenticates, validates and stores only the current account name; failures never report success',async()=>{
 let actor=own,allowed=true,fail=false;const writes=[];
 const route=load('../app/api/responsible-person/route.ts',{...common,'@/lib/responsible-person-server':contactServer({user:name}),'@/lib/auth':{requireAuth:async()=>actor?{userId:actor}:NextResponse.json({}, {status:401})},'@/lib/rateLimit':{rateLimit:async()=>({allowed})},'@clerk/nextjs/server':{clerkClient:async()=>({users:{updateUserMetadata:async(id,patch)=>{if(fail)throw Error('own test failure');writes.push({id,patch});}}})}});
 const send=body=>route.PUT(new Request('http://localhost/api/responsible-person',{method:'PUT',body:JSON.stringify({userId:own,...body})}));
 actor=null;assert.equal((await send(name)).status,401);actor=own;
 assert.equal((await send({...name,userId:'foreign'})).status,403);
 assert.equal((await route.PUT(new Request('http://localhost/api/responsible-person',{method:'PUT',body:JSON.stringify(name)}))).status,403);
 assert.equal((await send({...name,lastName:''})).status,400);
 allowed=false;assert.equal((await send(name)).status,429);allowed=true;
 fail=true;const failed=await send(name);assert.equal(failed.status,503);assert.equal((await failed.json()).saved,undefined);fail=false;
 const success=await send({...name,public:true,function:'director',roles:['admin'],email:'private@example.invalid'});
 assert.equal(success.status,200);assert.equal(success.headers.get('cache-control'),'private, no-store');assert.equal((await success.json()).saved,true);
 assert.deepEqual(writes,[{id:own,patch:{privateMetadata:{[model.ACCOUNT_RESPONSIBLE_PERSON_KEY]:name}}}]);
 const get=await route.GET();assert.equal(get.headers.get('cache-control'),'private, no-store');assert.equal((await get.json()).person.public,false);
});
test('public offer projection uses the confirmed contact without inventing a Crew profile; private names remain hidden',async()=>{
 const s=contactServer();
 const provider=load('./listing-provider.ts',{...common,'@/lib/responsible-person-server':s,'@/lib/db':{db:{from(){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:null,error:null})};return q}}},'@/lib/trust':{canViewProfile:async()=>false}});
 const snapshot={...model.NEW_RESPONSIBLE_PERSON,...name,userId:own};
 const visible=await provider.getListingProvider(own,null,null,snapshot);
 assert.equal(visible.name,'Alex Beispiel');assert.equal(visible.href,null);assert.equal(visible.contactUserId,own);
 const privateContact=await provider.getListingProvider(own,null,null,{...snapshot,public:false});
 assert.notEqual(privateContact.name,'Alex Beispiel');assert.equal(privateContact.responsible,null);
 const list=await provider.getListingProviders([{user_id:own,responsible_person:snapshot}]);assert.equal(list[0].name,'Alex Beispiel');
});

test('existing real profile can identify a provider in every offer type; forged display names cannot be stored',async()=>{
 const profile={display_name:'Own Public Person',location:'Own city',positions:['Gaffer']};
 const s=contactServer({profile});
 for(const company of [false,true]) {
  const result=await s.validateResponsiblePerson({userId:own,public:false},own,company);
  assert.equal(result.person.profileName,'Own Public Person');assert.equal(result.person.public,false);assert.equal(result.person.userId,own);
  const requested=await s.validateResponsiblePerson({profileName:'Forged Other Name',public:true},own,company);
  assert.equal(requested.person.profileName,'Own Public Person');
 }
 assert.equal((await contactServer().validateResponsiblePerson({profileName:'Forged Other Name'},own)).response.status,400);
 assert.equal(model.responsibleAccountName({profileName:'Own Public Person'}),null);
});
