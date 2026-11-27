import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {setImmediate as tick} from 'node:timers/promises';
import ts from 'typescript';
import {translatorFor} from './i18n-test-fixture.mjs';
import {watchContactRefresh} from './contact-refresh.ts';
import {uiErrorMessage} from './ui-error-message.ts';
import {inboxHomies,navigateInboxView} from './message-navigation.ts';
const require=createRequire(import.meta.url),jsx=require('react/jsx-runtime');
const source=readFileSync(new URL('../components/messaging/InboxFriends.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const friend={friendship_id:'friend-1',user_id:'peer',display_name:'Confirmed Person',role:'Camera',avatar_url:null};
const response=(body,status=200)=>Response.json(body,{status});
const defer=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return {promise,resolve}};
function elements(value,match,out=[]){if(Array.isArray(value))for(const child of value)elements(child,match,out);else if(value?.props){if(match(value))out.push(value);elements(value.props.children,match,out)}return out}
function fixture(handler,locale='de',initialHref='https://example.invalid/messages?view=friends',native=true,props={}){
 let cursor=0,dirty=true,tree,auth={userId:'owner',sessionId:'session'};const slots=[],effects=[],calls=[],entries=[initialHref];let index=0;const events=new EventTarget(),document=Object.assign(new EventTarget(),{visibilityState:'visible'});const browser={document,get location(){return new URL(entries[index])},history:{pushState(_state,_title,url){entries.splice(index+1);entries.push(new URL(url,entries[index]).href);index++;dirty=true},back(){if(index>0){index--;dirty=true}},forward(){if(index<entries.length-1){index++;dirty=true}}},addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events)};
 const same=(a,b)=>a?.length===b?.length&&a.every((value,i)=>Object.is(value,b[i]));
 const effect=(callback,deps)=>{const i=cursor++,old=slots[i];if(!old||!same(old.deps,deps)){slots[i]={deps,cleanup:old?.cleanup};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=callback()})}};
 const hooks={useEffect:effect,useLayoutEffect:effect,useRef(initial){const i=cursor++;return slots[i]??=( {current:initial})},useState(initial){const i=cursor++;if(!slots[i])slots[i]={value:typeof initial==='function'?initial():initial};return [slots[i].value,next=>{const value=typeof next==='function'?next(slots[i].value):next;if(!Object.is(value,slots[i].value)){slots[i].value=value;dirty=true}}]},useCallback(callback,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={deps,value:callback};return slots[i].value}};
 const mocks={'@/lib/contact-refresh':{watchContactRefresh},'@/lib/use-native-app-appearance':{useNativeAppAppearance:()=>native},react:hooks,'react/jsx-runtime':jsx,'@clerk/nextjs':{useAuth:()=>auth},'next/navigation':{useSearchParams:()=>browser.location.searchParams},'next-intl':{useLocale:()=>locale,useTranslations:namespace=>translatorFor(locale,namespace)},'lucide-react':{Search:'search-icon',Users:'users-icon',Star:'star-icon'},'@/components/ContactCard':{default:'contact-card'},'@/contexts/FormDraftContext':{useFormNavigation:()=>({leave:fn=>fn()})},'@/lib/message-navigation':{inboxHomies,navigateInboxView,navigateMessageView:()=>{}},'@/lib/ui-error-message':{uiErrorMessage}};
 const mod={exports:{}};new Function('require','module','exports','fetch','window',compiled)(name=>{assert.ok(name in mocks,name);return mocks[name]},mod,mod.exports,async(url,init={})=>{calls.push({url,init});const result=await handler(url,init,calls.length);const body=await result.clone().json();if(Array.isArray(body.friends)&&body.contract===undefined)return response({...body,contract:'cinegenius.friendships.v1',accountId:init.headers?.['X-Contact-Account']},result.status);return result}, browser);
 const render=()=>{cursor=0;dirty=false;tree=mod.exports.default(props);effects.splice(0).forEach(fn=>fn());return tree};
 return {calls,render,resume(event='focus'){events.dispatchEvent(new Event(event))},visibility(value){document.visibilityState=value;document.dispatchEvent(new Event('visibilitychange'))},appearance(value){native=value;render()},url:()=>browser.location,entries,back(){browser.history.back()},forward(){browser.history.forward()},all(){const label=translatorFor(locale,'Contacts')('title');const button=elements(tree,n=>n.type==='button'&&n.props.children===label)[0];assert.ok(button);button.props.onClick()},statuses:()=>elements(tree,n=>n.props.role==='status'),async settle(){for(let n=0;n<15;n++){if(dirty)render();await tick()}assert.equal(dirty,false)},homies(){const button=elements(tree,n=>n.type==='button'&&Array.isArray(n.props.children)&&n.props.children.includes('Homies'))[0];assert.ok(button);button.props.onClick()},cards:()=>elements(tree,n=>n.type==='contact-card'),alerts:()=>elements(tree,n=>n.props.role==='alert'),owner(id){auth={userId:id,sessionId:id+'-session'};render()},reload(){const retry=elements(tree,n=>n.type==='button')[0];assert.ok(retry);retry.props.onClick()},dispose(){for(const s of slots)s?.cleanup?.()}};
}
for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv','fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk'])test(`${locale}: friends contains only accepted connections, no incoming or sent views`,async t=>{
 const f=fixture(async()=>response({friends:[friend],incoming:[{...friend,display_name:'Pending incoming'}],outgoing:[{...friend,display_name:'Pending outgoing'}]}),locale);t.after(()=>f.dispose());await f.settle();assert.equal(f.cards().length,1);assert.equal(f.cards()[0].props.contact.display_name,'Confirmed Person');assert.match(f.cards()[0].props.messageHref,/^\/messages\?to=peer$/);assert.ok(f.calls.every(c=>(c.init.method??'GET')==='GET'));
});
test('failed removal retains contact; duplicate removal waits for the same server decision',async t=>{
 const decision=defer();const f=fixture(async(_url,init)=>init.method==='DELETE'?decision.promise:response({friends:[friend]}));t.after(()=>f.dispose());await f.settle();const first=f.cards()[0].props.onRemove('friend-1');assert.equal(await f.cards()[0].props.onRemove('friend-1'),false);assert.equal(f.calls.filter(c=>c.init.method==='DELETE').length,1);decision.resolve(response({error:'Rejected fixture removal'},503));assert.equal(await first,false);await f.settle();assert.equal(f.cards().length,1);assert.equal(f.alerts().length,1);
});
test('only an explicit success acknowledgement removes the selected connection',async t=>{
 const f=fixture(async(_url,init)=>init.method==='DELETE'?response({success:true}):response({friends:[friend]}));t.after(()=>f.dispose());await f.settle();assert.equal(await f.cards()[0].props.onRemove('friend-1'),true);await f.settle();assert.equal(f.cards().length,0);assert.equal(f.calls.at(-1).init.headers['X-Contact-Account'],'owner');
});
test('account change immediately hides previous contacts and late responses cannot restore them',async t=>{
 const old=defer();const f=fixture(async(_u,_i,n)=>n===1?old.promise:response({friends:[{...friend,display_name:'New account contact'}]}));t.after(()=>f.dispose());await f.settle();f.owner('different');assert.equal(f.cards().length,0);await f.settle();old.resolve(response({friends:[friend]}));await f.settle();assert.equal(f.cards()[0].props.contact.display_name,'New account contact');
});
test('late removal cannot alter the next account or claim success there',async t=>{
 const decision=defer();const f=fixture(async(_url,init)=>init.method==='DELETE'?decision.promise:response({friends:[friend]}));t.after(()=>f.dispose());await f.settle();const operation=f.cards()[0].props.onRemove('friend-1');f.owner('different');await f.settle();decision.resolve(response({success:true}));assert.equal(await operation,false);await f.settle();assert.equal(f.cards().length,1);
});
test('initial failure offers retry without claiming the list is empty',async t=>{
 const f=fixture(async(_u,_i,n)=>n===1?response({},503):response({friends:[friend]}));t.after(()=>f.dispose());await f.settle();assert.equal(f.cards().length,0);assert.equal(f.alerts().length,1);f.reload();await f.settle();assert.equal(f.alerts().length,0);assert.equal(f.cards().length,1);
});

const capability={favoriteFriendsRead:true,favoriteFriendsWrite:true};
const starred={...friend,is_favorite:false,profile_visible:true};
test('Homies uses the shared private contract, explicit target and confirmed acknowledgement',async t=>{
 const f=fixture(async(_url,init)=>init.method==='PUT'?response({...JSON.parse(init.body),success:true,friendship_id:friend.friendship_id}):response({friends:[starred],capabilities:capability}));t.after(()=>f.dispose());await f.settle();
 assert.equal(f.calls[0].init.headers['X-CineGenius-Native-Contract'],'cinegenius.friendships.v1');
 assert.equal(f.cards()[0].props.favorite,false);await f.cards()[0].props.onFavorite();await f.settle();assert.equal(f.cards()[0].props.favorite,true);
 const put=f.calls.find(c=>c.init.method==='PUT');assert.equal(JSON.parse(put.init.body).is_favorite,true);assert.equal(JSON.parse(put.init.body).accountId,'owner');
 f.homies();await f.settle();assert.equal(f.cards().length,1);
});
test('failed favorite changes retain the confirmed selection and duplicate presses send once',async t=>{
 const pending=defer();const f=fixture(async(_url,init)=>init.method==='PUT'?pending.promise:response({friends:[starred],capabilities:capability}));t.after(()=>f.dispose());await f.settle();f.cards()[0].props.onFavorite();f.cards()[0].props.onFavorite();await f.settle();assert.equal(f.calls.filter(c=>c.init.method==='PUT').length,1);assert.equal(f.cards()[0].props.favorite,false);
 pending.resolve(response({},503));await f.settle();assert.equal(f.cards()[0].props.favorite,false);assert.equal(f.alerts().length,1);
});
test('missing favorite capability is not a saved false star and a false capability blocks writes',async t=>{
 const f=fixture(async()=>response({friends:[friend],capabilities:{favoriteFriendsRead:false,favoriteFriendsWrite:false}}));t.after(()=>f.dispose());await f.settle();assert.equal(f.cards()[0].props.favorite,undefined);f.cards()[0].props.onFavorite();await f.settle();assert.equal(f.calls.length,1);
});
test('late favorite acknowledgement cannot update another account',async t=>{
 const pending=defer();const f=fixture(async(_url,init)=>init.method==='PUT'?pending.promise:response({friends:[starred],capabilities:capability}));t.after(()=>f.dispose());await f.settle();f.cards()[0].props.onFavorite();await f.settle();f.owner('different');await f.settle();pending.resolve(response({contract:'cinegenius.friendships.v1',accountId:'owner',success:true,friendship_id:friend.friendship_id,is_favorite:true}));await f.settle();assert.equal(f.cards()[0].props.favorite,false);assert.equal(f.alerts().length,0);
});

test('direct Homies URL uses only confirmed favorites and toggles preserve real history without mutations',async t=>{
 const favorite={...friend,is_favorite:true},ordinary={...friend,friendship_id:'friend-2',user_id:'other',display_name:'Ordinary accepted',is_favorite:false};
 const f=fixture(async()=>response({friends:[favorite,ordinary],incoming:[{...favorite,user_id:'pending'}],capabilities:capability}),'de','https://example.invalid/messages?view=friends&homies=1&locale=de');t.after(()=>f.dispose());await f.settle();
 assert.equal(f.cards().length,1);assert.equal(f.cards()[0].props.contact.user_id,'peer');assert.equal(f.calls.length,1);
 f.all();await f.settle();assert.equal(f.cards().length,2);assert.equal(f.url().searchParams.get('homies'),null);assert.equal(f.entries.length,2);
 f.homies();await f.settle();assert.equal(f.cards().length,1);assert.equal(f.entries.length,3);f.homies();await f.settle();assert.equal(f.entries.length,3);
 f.back();await f.settle();assert.equal(f.cards().length,2);f.forward();await f.settle();assert.equal(f.cards().length,1);
 assert.equal(f.calls.length,1,'URL filtering must not request, accept, mutate, or mark anything read');assert.ok(f.calls.every(c=>(c.init.method??'GET')==='GET'));
});
test('Homies without read capability is unavailable rather than an empty success, and all contacts stay reachable',async t=>{
 const f=fixture(async()=>response({friends:[friend],capabilities:{favoriteFriendsRead:false,favoriteFriendsWrite:false}}),'en','https://example.invalid/messages?view=friends&homies=1');t.after(()=>f.dispose());await f.settle();
 assert.equal(f.cards().length,0);assert.equal(f.statuses().length,1);assert.match(JSON.stringify(f.statuses()),/currently unavailable/);assert.doesNotMatch(JSON.stringify(f.statuses()),/No contacts yet/);
 f.all();await f.settle();assert.equal(f.cards().length,1);assert.equal(f.url().searchParams.get('homies'),null);assert.equal(f.calls.length,1);
});
test('direct Homies account change hides old favorites before a new account response',async t=>{
 const next=defer();const favorite={...friend,is_favorite:true};const f=fixture(async(_u,_i,n)=>n===1?response({friends:[favorite],capabilities:capability}):next.promise,'de','https://example.invalid/messages?view=friends&homies=1');t.after(()=>f.dispose());await f.settle();assert.equal(f.cards().length,1);
 f.owner('other-owner');assert.equal(f.cards().length,0);await f.settle();next.resolve(response({friends:[{...favorite,display_name:'New owner favorite'}],capabilities:capability}));await f.settle();assert.equal(f.cards().length,1);assert.equal(f.cards()[0].props.contact.display_name,'New owner favorite');
});


test('ordinary website contacts expose the same confirmed private stars and Homies filter as the app',async t=>{
 const f=fixture(async(_url,init)=>init.method==='PUT'?response({...JSON.parse(init.body),success:true,friendship_id:friend.friendship_id}):response({friends:[starred],capabilities:capability}),'de','https://example.invalid/messages?view=friends',false);t.after(()=>f.dispose());await f.settle();
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].init.headers['X-CineGenius-Native-Contract'],'cinegenius.friendships.v1');assert.equal(f.cards()[0].props.favorite,false);
 await f.cards()[0].props.onFavorite();await f.settle();assert.equal(f.cards()[0].props.favorite,true);f.homies();await f.settle();assert.equal(f.cards().length,1);assert.equal(f.url().searchParams.get('homies'),'1');
});
test('an explicit Homies URL uses current favorite capability even outside the native shell',async t=>{
 const f=fixture(async()=>response({friends:[{...friend,is_favorite:true}],capabilities:capability}),'de','https://example.invalid/messages?view=friends&homies=1',false);t.after(()=>f.dispose());await f.settle();
 assert.equal(f.calls[0].init.headers['X-CineGenius-Native-Contract'],'cinegenius.friendships.v1');assert.equal(f.cards().length,1);
});

test('appearance changes retain the shared confirmed favorites without another read',async t=>{
 const f=fixture(async()=>response({friends:[starred],capabilities:capability}));t.after(()=>f.dispose());await f.settle();
 assert.equal(f.cards()[0].props.favorite,false);f.appearance(false);await f.settle();assert.equal(f.cards()[0].props.favorite,false);assert.equal(f.calls.length,1);f.appearance(true);await f.settle();assert.equal(f.calls.length,1);
});

test('web and app share one saved selection and refresh both ways on return without polling',async t=>{
 let saved=false;
 const handler=async(_url,init)=>{
  if(init.method==='PUT'){const body=JSON.parse(init.body);saved=body.is_favorite;return response({...body,success:true,friendship_id:friend.friendship_id})}
  return response({friends:[{...starred,is_favorite:saved}],capabilities:capability});
 };
 const web=fixture(handler,'de','https://example.invalid/messages?view=friends',false),app=fixture(handler);t.after(()=>{web.dispose();app.dispose()});await web.settle();await app.settle();
 await web.cards()[0].props.onFavorite();await web.settle();assert.equal(saved,true);assert.equal(app.cards()[0].props.favorite,false);
 app.resume('cinegenius:app-resume');app.resume('focus');app.resume('pageshow');await app.settle();assert.equal(app.cards()[0].props.favorite,true);assert.equal(app.calls.length,2,'wake events share one read');
 await app.cards()[0].props.onFavorite();await app.settle();assert.equal(saved,false);web.visibility('hidden');await web.settle();assert.equal(web.calls.length,2);
 web.visibility('visible');await web.settle();assert.equal(web.cards()[0].props.favorite,false);assert.equal(web.calls.length,3);await web.settle();assert.equal(web.calls.length,3);
 web.dispose();web.resume();await web.settle();assert.equal(web.calls.length,3);
});
for(const invalid of [{contract:'wrong-contract',accountId:'owner'},{contract:'cinegenius.friendships.v1',accountId:'other-owner'}])test(`website rejects contacts from invalid response scope ${JSON.stringify(invalid)}`,async t=>{
 const f=fixture(async()=>response({...invalid,friends:[starred],capabilities:capability}),'de','https://example.invalid/messages?view=friends',false);t.after(()=>f.dispose());await f.settle();assert.equal(f.cards().length,0);assert.equal(f.alerts().length,1);
});

test('closing the view aborts its pending private contact read',async()=>{
 const waiting=defer();const f=fixture(async()=>waiting.promise);await f.settle();assert.equal(f.calls.length,1);const signal=f.calls[0].init.signal;assert.equal(signal.aborted,false);f.dispose();assert.equal(signal.aborted,true);waiting.resolve(response({friends:[friend]}));
});


test('controlled panel Homies reuse current accepted contacts and delegate chat opening to real route navigation',async t=>{
 const opened=[];const f=fixture(async()=>response({friends:[{...friend,is_favorite:true},{...friend,user_id:'other',friendship_id:'friend-2',is_favorite:false}],capabilities:{favoriteFriendsRead:true,favoriteFriendsWrite:false}}),'de','https://example.invalid/search',true,{homiesOnly:true,hideTabs:true,onOpenMessage:id=>opened.push(id)});t.after(()=>f.dispose());await f.settle();assert.equal(f.cards().length,1);f.cards()[0].props.onMessage();assert.deepEqual(opened,['peer']);assert.equal(f.url().pathname,'/search');assert.ok(f.calls.every(call=>(call.init.method??'GET')==='GET'));
});
