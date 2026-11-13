import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createTranslator} from 'next-intl';
import * as contacts from './contact-connections.ts';
import {uiErrorMessage} from './ui-error-message.ts';
const require=createRequire(import.meta.url),source=readFileSync(new URL('../components/ConnectButton.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const id='11111111-1111-4111-8111-111111111111';
const connection=(sender='owner',status='pending')=>({id,sender_id:sender,receiver_id:sender==='owner'?'target':'owner',status});
const response=(body,status=200)=>({ok:status>=200&&status<300,json:async()=>body});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
function fixture({locale='de',fetch:request=async()=>response({friendship:null})}={}){
 let cursor=0,tree,owner='owner',target='target';const hooks=[],effects=[],layouts=[],calls=[],events=[],navigation=[];
 const t=createTranslator({locale,messages:JSON.parse(readFileSync(new URL('../messages/'+locale+'.json',import.meta.url),'utf8')),namespace:'Contacts',onError(error){throw error;}});
 const effect=(queue,work,deps)=>{const index=cursor++,old=hooks[index];if(!old||deps.some((value,i)=>value!==old.deps[i])){queue.push(()=>{old?.cleanup?.();hooks[index]={deps,cleanup:work()};});}};
 const mocks={react:{useState(initial){const index=cursor++;if(!(index in hooks))hooks[index]=typeof initial==='function'?initial():initial;return[hooks[index],value=>{hooks[index]=typeof value==='function'?value(hooks[index]):value;}];},useRef(initial){const index=cursor++;if(!(index in hooks))hooks[index]={current:initial};return hooks[index];},useLayoutEffect:(work,deps)=>effect(layouts,work,deps),useEffect:(work,deps)=>effect(effects,work,deps)},'@clerk/nextjs':{useUser:()=>({user:owner?{id:owner}:null,isLoaded:true})},'next-intl':{useTranslations:()=>t},'next/navigation':{useRouter:()=>({refresh:()=>navigation.push('refresh')}),usePathname:()=>'/profile/target'},'next/link':{__esModule:true,default:'a'},'lucide-react':new Proxy({},{get:()=> 'i'}),'@/lib/contact-connections':contacts,'@/lib/ui-error-message':{uiErrorMessage},'react/jsx-runtime':require('react/jsx-runtime')};
 const mod={exports:{}};new Function('require','module','exports','fetch','window',compiled)(name=>{assert.ok(name in mocks,name);return mocks[name];},mod,mod.exports,async(url,init)=>{calls.push({url,init});return request(url,init);},{dispatchEvent:event=>events.push(event.type)});
 const walk=node=>node==null||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(walk):[node,...walk(node.props?.children)];
 const text=node=>node==null||typeof node==='boolean'?'':typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):text(node.props?.children);
 function render(){cursor=0;tree=mod.exports.default({targetUserId:target});while(layouts.length)layouts.shift()();while(effects.length)effects.shift()();}
 async function settle(){for(let n=0;n<15;n++)await Promise.resolve();render();}
 render();return{calls,events,navigation,t,render,settle,text:()=>text(tree),nodes:()=>walk(tree),click:key=>{const button=walk(tree).find(node=>node.type==='button'&&text(node)===t(key));assert.ok(button,'Missing '+key);button.props.onClick();},switchOwner(value){owner=value;render();},switchTarget(value){target=value;render();}};
}
test('actual contact button honors {friendship}, exposes request sent and suppresses duplicate taps',async()=>{
 const pending=deferred();const f=fixture({fetch:async(_url,init)=>init?.method?pending.promise:response({friendship:null})});await f.settle();
 f.click('add');f.click('add');assert.equal(f.calls.filter(call=>call.init.method==='POST').length,1);
 assert.deepEqual(JSON.parse(f.calls.at(-1).init.body),{receiver_id:'target',accountId:'owner'});
 pending.resolve(response({success:true,friendship:connection(),changed:true}));await f.settle();assert.ok(f.text().includes(f.t('requestSent')));assert.ok(f.text().includes(f.t('cancelRequest')));
});
test('incoming requests require explicit acceptance and confirmed response; errors stay retryable',async()=>{
 let fail=true;const f=fixture({fetch:async(_url,init)=>!init?.method?response({friendship:connection('target')}):fail?response({error:'Controlled failure'},503):response({success:true,friendship:connection('target','accepted')})});await f.settle();
 f.click('accept');await f.settle();assert.ok(f.text().includes('Controlled failure'));assert.ok(f.text().includes(f.t('accept')));assert.equal(f.navigation.length,0);
 fail=false;f.click('accept');await f.settle();assert.ok(f.text().includes(f.t('inContacts')));assert.equal(f.navigation.length,1);
});
test('loading failures cannot show add contact until a successful status retry',async()=>{
 let fail=true;const f=fixture({fetch:async()=>fail?response({},503):response({friendship:null})});await f.settle();assert.ok(f.text().includes(f.t('loadError')));assert.ok(!f.text().includes(f.t('add')));
 fail=false;f.click('retry');f.render();await f.settle();assert.ok(f.text().includes(f.t('add')));
});
test('unconfirmed writes and late results after account change never claim a contact',async()=>{
 const first=fixture({fetch:async(_url,init)=>init?.method?response({id}):response({friendship:null})});await first.settle();first.click('add');await first.settle();assert.ok(first.text().includes(first.t('error')));assert.ok(!first.text().includes(first.t('requestSent')));
 const pending=deferred();const f=fixture({fetch:async(_url,init)=>init?.method?pending.promise:response({friendship:null})});await f.settle();f.click('add');f.switchOwner('different');pending.resolve(response({friendship:connection()}));await f.settle();assert.ok(!f.text().includes(f.t('requestSent')));assert.equal(f.events.length,0);
});
for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv'])test(locale+': contact action copy and touch targets render in the native catalog',async()=>{
 const f=fixture({locale});await f.settle();assert.ok(f.text().includes(f.t('add')));for(const button of f.nodes().filter(node=>node.type==='button'))assert.match(button.props.className,/min-h-11/);
 const add=f.nodes().find(node=>node.type==='button'&&node.props['aria-label']===f.t('addLabel'));assert.ok(add,'short add copy retains its full accessible action');assert.equal(add.props.title,f.t('addLabel'));assert.ok(add.props['aria-label'].toLocaleLowerCase(locale).includes(f.t('add').toLocaleLowerCase(locale)),'accessible action includes the visible label');
 f.switchOwner(null);assert.ok(f.text().includes(f.t('add')));const link=f.nodes().find(node=>node.type==='a');assert.equal(link.props.href,'/sign-in?redirect_url=%2Fprofile%2Ftarget');assert.equal(link.props['aria-label'],f.t('addLabel'));
 const accepted=fixture({locale,fetch:async()=>response({friendship:connection('target','accepted')})});await accepted.settle();const contact=accepted.nodes().find(node=>node.type==='a'&&node.props.href==='/dashboard?tab=friends');assert.ok(contact);assert.equal(contact.props['aria-label'],accepted.t('inContactsLabel'));assert.equal(contact.props.title,accepted.t('inContactsLabel'));assert.ok(contact.props['aria-label'].toLocaleLowerCase(locale).includes(accepted.t('inContacts').toLocaleLowerCase(locale)),'accessible contact name includes the visible label');assert.ok(accepted.text().includes(accepted.t('inContacts')));assert.ok(accepted.calls.every(call=>!call.init?.method),'rendering or opening an existing contact never sends an action');
});
