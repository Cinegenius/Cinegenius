import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {verificationUI,verificationProfile} from './verification-ui-fixture.mjs';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const Profile=(await verificationUI('../app/profile/[slug]/ProfileView.tsx')).default;
for(const type of ['production','actor','model'])for(const photo of [false,true])test(`${type}, photo=${photo}: current badge is beside the name and disappears after revocation`,()=>{
 for(const verified of [true,false]) {
  const html=renderToStaticMarkup(React.createElement(Profile,{profile:verificationProfile(type,verified,photo),isOwner:false}));
  const heading=html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/)?.[0];assert.ok(heading);
  assert.equal(heading.includes('aria-label="Verifiziert"'),verified);
  assert.equal(heading.includes('role="img"'),verified);
 }
});
test('Smart grid/list and ordinary result titles use the same explicit profile flag',async()=>{
 for(const native of [false,true]) {
  const {default:Card}=await verificationUI('../components/SearchResultCard.tsx','de',{'@/lib/use-native-app-appearance':{useNativeAppAppearance:()=>native}});
  for(const row of [false,true])for(const verified of [true,false,undefined]) {
   const result={id:'synthetic',title:'Synthetic Crew',type:'profile',subtitle:'Camera',price:0,image:null,available:true,verified};
   const html=renderToStaticMarkup(React.createElement(Card,{result,row,compact:row}));
   assert.equal(html.includes('role="img" aria-label="Verifiziert"'),verified===true);
  }
 }
});
test('admin failure keeps the decision open; double submissions cannot approve twice',async()=>{
 const source=readFileSync(new URL('../app/admin/page.tsx',import.meta.url),'utf8');
 const ast=ts.createSourceFile('admin.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let node;const visit=n=>{if(ts.isFunctionDeclaration(n)&&n.name?.text==='saveVerificationDecision')node=n;ts.forEachChild(n,visit)};visit(ast);
 const body=ts.transpileModule(node.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 for(const failure of [false,true]) {
  const state={error:'',decision:{kind:'request',request:{id:'request-1',review_version:2,profile_revision:4},action:'approve'},calls:[],refresh:0};
  let finish;const waiting=new Promise(resolve=>finish=resolve);
  const fn=new Function('verificationDecision','verificationLock','mutate','setVerificationDecisionError','setVerificationActing','setProfileActing','setVerificationDecision','setActionMessage','setRefreshKey','verificationText','uiErrorMessage',body+';return saveVerificationDecision;')(
   state.decision,{current:false},async(url,payload)=>{state.calls.push({url,payload});await waiting;if(failure)throw Error('Save failed');},v=>state.error=v,()=>{},()=>{},v=>state.decision=v,()=>{},fn=>state.refresh=fn(state.refresh),key=>key,error=>error.message);
  const pending=fn('');await fn('');assert.equal(state.calls.length,1);assert.notEqual(state.decision,null);
  finish();await pending;
  assert.equal(state.calls[0].payload.profileRevision,4);
  assert.equal(state.decision===null,!failure);assert.equal(state.refresh,failure?0:1);assert.equal(state.error,failure?'Save failed':'');
 }
});

 test('Crew map cluster titles and opened previews show only the current explicit badge',async()=>{
 const {default:Map}=await verificationUI('../components/DirectoryMap.tsx','de',{'next/dynamic':()=>({locations,renderPreview})=>React.createElement('div',null,locations.map(row=>React.createElement('div',{key:row.id},React.createElement('header',null,row.titleContent),renderPreview(row))))});
 for(const verified of [true,false,undefined]){
 const html=renderToStaticMarkup(React.createElement(Map,{items:[{id:'fixture',title:'Synthetic Crew',city:'Berlin',subtitle:'Camera',href:'/profile/fixture',image:'',lat:52.5,lng:13.4,verified}],kind:'crew',bounds:null,onBoundsChange(){}}));
 assert.equal((html.match(/role="img" aria-label="Verifiziert"/g)||[]).length,verified===true?2:0);
 }
});
