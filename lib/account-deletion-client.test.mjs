import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const file=ts.createSourceFile('dashboard.tsx',readFileSync(new URL('../app/dashboard/page.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let clickSource;
function visit(node){
 if(ts.isJsxOpeningElement(node)&&node.tagName.getText(file)==='button'&&node.attributes.properties.some(attr=>ts.isJsxAttribute(attr)&&attr.name.getText(file)==='aria-busy'&&attr.initializer?.getText(file)==='{deletingAccount}')){
  const attribute=node.attributes.properties.find(attr=>ts.isJsxAttribute(attr)&&attr.name.getText(file)==='onClick');clickSource=attribute.initializer.expression.getText(file);
 }
 ts.forEachChild(node,visit);
}
visit(file);assert.ok(clickSource,'real account-deletion handler');
function fixture({confirm=true,response=()=>Response.json({success:true}),user={id:'original-account'}}={}){
 const calls=[],alerts=[],busy=[];const lock={current:false},window={confirm(){calls.push({type:'confirm'});return confirm;},location:{href:null}};
 const make=ts.transpileModule('const handler='+clickSource+'; export {handler};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};new Function('module','exports','user','accountDeleteLock','window','fetch','uiText','setDeletingAccount','alert',make)(mod,mod.exports,user,lock,window,async(url,init)=>{calls.push({type:'fetch',url,init});return response();},key=>key,value=>busy.push(value),value=>alerts.push(value));
 return {click:mod.exports.handler,calls,alerts,busy,lock,window};
}
test('declining the destructive confirmation performs no request',async()=>{const f=fixture({confirm:false});await f.click();assert.equal(f.calls.filter(c=>c.type==='fetch').length,0);assert.equal(f.window.location.href,null);});
test('only confirmed removal navigates away and carries the original account binding',async()=>{const f=fixture();await f.click();assert.equal(f.window.location.href,'/');assert.deepEqual(f.calls.find(c=>c.type==='fetch').init,{method:'DELETE',headers:{'X-Account-Id':'original-account'}});assert.deepEqual(f.busy,[true,false]);});
for(const [name,response] of [
 ['network rejection',()=>{throw new Error('PRIVATE network failure')}],
 ['server failure',()=>Response.json({error:'PRIVATE backend failure'},{status:503})],
 ['invalid JSON',()=>new Response('PRIVATE invalid response')],
 ['unconfirmed success',()=>Response.json({success:false})],
 ['changed account',()=>Response.json({error:'unavailable'},{status:409})]
])test(`${name} never claims deletion, clears the busy state and offers retry`,async()=>{
 const f=fixture({response});await f.click();assert.equal(f.window.location.href,null);assert.deepEqual(f.alerts,['Ui.text_4049adacc8fd2f']);assert.equal(f.lock.current,false);assert.deepEqual(f.busy,[true,false]);
});
test('a double click cannot submit two destructive requests',async()=>{let finish;const pending=new Promise(resolve=>{finish=resolve});const f=fixture({response:()=>pending});const first=f.click();await f.click();assert.equal(f.calls.filter(c=>c.type==='fetch').length,1);finish(Response.json({success:true}));await first;});
test('an unavailable account never opens a destructive confirmation',async()=>{const f=fixture({user:null});await f.click();assert.deepEqual(f.calls,[]);});
