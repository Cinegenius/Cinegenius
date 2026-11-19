import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const load=(file,mocks={},extra={})=>{const m={exports:{}};const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new vm.Script('(function(require,module,exports){'+code+'\n})').runInNewContext({AbortController,AbortSignal,Response,Request,URL,setTimeout,clearTimeout,...extra})(id=>{assert.ok(id in mocks,id);return mocks[id]},m,m.exports);return m.exports};
const locales=load('lib/i18n/locales.ts');
const core=load('lib/content-translation.ts',{'@/lib/i18n/locales':locales});
const id='10000000-0000-4000-8000-000000000001',ref={kind:'listing',id};
const plain=v=>JSON.parse(JSON.stringify(v));
const tick=async()=>{for(let n=0;n<12;n++)await Promise.resolve()};

for(const locale of locales.LANGUAGE_OPTIONS.map(l=>l.code))test('accept canonical target '+locale,()=>{
 assert.deepEqual(plain(core.translationRequest({locale,items:[ref,ref]})),{locale,items:[ref]});
});
for(const [label,input] of Object.entries({empty:null,unknownLocale:{locale:'xx',items:[ref]},unsupportedKind:{locale:'en',items:[{kind:'messages',id}]},urlInsteadOfId:{locale:'en',items:[{kind:'listing',id:'https://private.test/secret'}]},emptyBatch:{locale:'en',items:[]},tooMany:{locale:'en',items:[ref,ref,ref,ref]},wrongAccountId:{locale:'en',items:[{kind:'profile',id}]}}))test('reject '+label,()=>assert.equal(core.translationRequest(input),null));
test('source projection only admits explicit text fields; not contacts or arbitrary metadata',()=>{
 assert.deepEqual(plain(core.publicTranslationFields('company',{name:'Name',description:'Text',phone:'PRIVATE',email:'PRIVATE',owner_user_id:'PRIVATE',metadata:{secret:1}})),{description:'Text'});
 assert.throws(()=>core.publicTranslationFields('listing',{title:'a'.repeat(20001)}));
 assert.throws(()=>core.publicTranslationFields('news',{title:'[[CG_LOCK_x]]'}));
});
test('protect and restore names, prices, dates, links, models and contact facts without changing originals',()=>{
 const original={title:'München Studio ARRI M18',description:'Ada Test · Acme GmbH · 12.11.2026 · 1.200 € · https://example.test/a?b=2 · test@example.test · +49 89 12345678'};
 const protectedValue=core.protectTranslationFields(original,'test',['Ada Test','Acme GmbH','München','ARRI M18']);
 const sent=JSON.stringify(protectedValue.fields);
 for(const fact of ['Ada Test','Acme GmbH','München','ARRI M18','test@example.test','+49 89'])assert.equal(sent.includes(fact),false,fact);
 assert.deepEqual(plain(core.restoreTranslationFields(protectedValue.fields,protectedValue.fields,protectedValue.tokens)),original);
 assert.equal(original.title,'München Studio ARRI M18');
});
test('reject lost, duplicate and invented facts or provider fields',()=>{
 const p=core.protectTranslationFields({title:'Studio 123'},'x');const token=[...p.tokens.keys()][0];
 for(const fields of [{title:'Studio'},{title:`Studio ${token} ${token}`},{title:'Studio 124'},{title:`<img src=x> ${token}`},{title:`Studio ${token}`,secret:'extra'}])assert.throws(()=>core.restoreTranslationFields(fields,p.fields,p.tokens));
});
function clientFixture(){
 let now=0,n=0;const timers=new Map(),requests=[];
 const api=load('lib/content-translation-client.ts',{'@/lib/content-translation':core},{setTimeout:(fn,ms)=>{timers.set(++n,{fn,time:now+ms});return n},clearTimeout:id=>timers.delete(id)});
 const client=api.createContentTranslationClient('en',(url,init)=>new Promise(resolve=>requests.push({url,init,resolve})));
 const advance=async(ms=100)=>{now+=ms;for(const [id,item]of [...timers])if(item.time<=now){timers.delete(id);item.fn()}await tick()};
 const answer=(index,items,status=200)=>requests[index].resolve(Response.json({locale:'en',items},{status}));
 return {client,requests,advance,answer,timers};
}
const result=(extra={})=>({...ref,locale:'en',fingerprint:'x',status:'translated',fields:{title:'Light'},originals:{title:'Lampe'},...extra});
test('same visible source is deduplicated across card and map; only references leave the browser',async()=>{
 const f=clientFixture();let a=0,b=0;const offA=f.client.subscribe(ref,()=>a++),offB=f.client.subscribe(ref,()=>b++);
 await f.advance();assert.equal(f.requests.length,1);assert.deepEqual(JSON.parse(f.requests[0].init.body),{locale:'en',items:[ref]});
 f.answer(0,[result()]);await tick();assert.equal(f.client.get(ref).fields.title,'Light');assert.equal(a,1);assert.equal(b,1);
 offA();assert.ok(f.client.get(ref));offB();assert.equal(f.client.get(ref),undefined);f.client.dispose();
});
test('refresh aborts previous generation and discards a late success',async()=>{
 const f=clientFixture();f.client.subscribe(ref,()=>{});await f.advance();f.client.refresh();assert.equal(f.requests[0].init.signal.aborted,true);
 await f.advance();f.answer(1,[result({fields:{title:'Fresh'}})]);await tick();f.answer(0,[result({fields:{title:'Stale'}})]);await tick();assert.equal(f.client.get(ref).fields.title,'Fresh');f.client.dispose();
});
test('disposal stops requests and prevents stale private display on account/page change',async()=>{
 const f=clientFixture();f.client.subscribe(ref,()=>{});await f.advance();f.client.dispose();assert.equal(f.requests[0].init.signal.aborted,true);f.answer(0,[result()]);await tick();assert.equal(f.client.get(ref),undefined);assert.equal(f.timers.size,0);
});
test('batch size remains bounded and an unsubscribed source is not requested',async()=>{
 const f=clientFixture();for(let n=1;n<=8;n++){const item={kind:'listing',id:id.slice(0,-1)+n};const off=f.client.subscribe(item,()=>{});if(n===8)off()}
 await f.advance();assert.equal(JSON.parse(f.requests[0].init.body).items.length,3);f.answer(0,[]);await tick();await f.advance();assert.equal(JSON.parse(f.requests[1].init.body).items.length,3);f.client.dispose();
});
for(const status of [429,503])test('backend '+status+' keeps original and pauses automatic calls until explicit refresh',async()=>{
 const f=clientFixture();f.client.subscribe(ref,()=>{});await f.advance();f.answer(0,[],status);await tick();assert.equal(f.client.get(ref).status,'unavailable');await f.advance(30000);assert.equal(f.requests.length,1);
 f.client.refresh();await f.advance();assert.equal(f.requests.length,2);f.client.dispose();
});
test('pending provider work is retried at most twice',async()=>{
 const f=clientFixture();f.client.subscribe(ref,()=>{});await f.advance();for(let n=0;n<3;n++){assert.equal(f.requests.length,n+1);f.answer(n,[result({status:'pending',fields:{},originals:{}})]);await tick();await f.advance(20000)}assert.equal(f.requests.length,3);f.client.dispose();
});
test('unexpected language and absent source never replace an existing original',async()=>{
 const f=clientFixture();f.client.subscribe(ref,()=>{});await f.advance();f.requests[0].resolve(Response.json({locale:'uk',items:[result()]}));await tick();assert.equal(f.client.get(ref).status,'unavailable');f.client.dispose();
});
