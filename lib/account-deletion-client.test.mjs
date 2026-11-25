import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {erasureSummary} from './account-erasure.ts';
const file=ts.createSourceFile('AccountErasurePanel.tsx',readFileSync(new URL('../components/AccountErasurePanel.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let source;function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='requestDeletion')source=node.getText(file);ts.forEachChild(node,visit);}visit(file);assert.ok(source);
const summary={id:'64e2fb52-a72d-4a8d-8640-c43b010e93c7',state:'pending',requestedAt:new Date().toISOString()};
const accepted=()=>Response.json({accepted:true,accountId:'owner',request:summary},{status:202});
function fixture({confirm=true,response=accepted,userId='owner',loaded=true}={}){
 const calls=[],errors=[],results=[],busy=[],lock={current:false},current={current:userId},epoch={current:0};
 const code=ts.transpileModule(source+';export {requestDeletion};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};new Function('module','exports','userId','result','lock','current','epoch','window','fetch','t','setBusy','setError','setResult','erasureSummary',code)(mod,mod.exports,userId,loaded?{account:userId,request:null}:null,lock,current,epoch,{confirm:()=>confirm},async(url,init)=>{calls.push({url,init});return response();},key=>key,v=>busy.push(v),v=>errors.push(v),v=>results.push(v),erasureSummary);
 return{click:mod.exports.requestDeletion,calls,errors,results,busy,lock,current,epoch};
}
test('declining confirmation or missing loaded account status never submits',async()=>{for(const options of [{confirm:false},{userId:null},{loaded:false}]){const f=fixture(options);await f.click();assert.deepEqual(f.calls,[]);}});
test('202 acknowledgement is displayed as a request without navigating or claiming completion',async()=>{const f=fixture();await f.click();assert.deepEqual(f.results,[{account:'owner',request:summary}]);assert.equal(f.calls[0].init.headers['X-Account-Id'],'owner');assert.deepEqual(f.busy,[true,false]);});
for(const [name,response] of [['network',()=>{throw Error('private')}],['server',()=>Response.json({error:'private'},{status:503})],['invalid JSON',()=>new Response('private')],['old success',()=>Response.json({success:true})],['wrong account',()=>Response.json({accepted:true,accountId:'other',request:summary},{status:202})]])test(name+' never pretends deletion is confirmed',async()=>{const f=fixture({response});await f.click();assert.deepEqual(f.results,[]);assert.equal(f.errors.at(-1),'owner');assert.equal(f.lock.current,false);});
test('double click submits once and a late account-switch response is discarded',async()=>{let finish;const f=fixture({response:()=>new Promise(resolve=>{finish=resolve;})});const first=f.click();await f.click();assert.equal(f.calls.length,1);f.current.current='other';f.epoch.current++;finish(accepted());await first;assert.deepEqual(f.results,[]);assert.equal(f.errors.at(-1),null);});
