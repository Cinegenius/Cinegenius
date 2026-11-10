import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {setImmediate as nextTurn} from 'node:timers/promises';
import ts from 'typescript';
import {notificationCopy,translatorFor} from './i18n-test-fixture.mjs';
import {SUPPORTED_LOCALES} from './i18n/locales.ts';

const require=createRequire(import.meta.url),jsx=require('react/jsx-runtime');
const source=readFileSync(process.env.CINEGENIUS_NOTIFICATION_PAGE_SOURCE ?? new URL('../app/notifications/page.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const person='Zoë als Ana <member> 東京 & “Name”';
const privateText='Meine persönliche Nachricht: no automatic translation <private> 東京.';
const raw=[{id:'notice-booking',type:'booking_request',href:'/dashboard?tab=bookings&ref=opaque',read:true,created_at:'2026-11-01T12:00:00Z',...notificationCopy.localizedNotification({title:{key:'bookingSentTitle'},body:{key:'bookingSentBody',values:{title:person,ref:'CG-0001'}}})},
 {id:'notice-member',type:'friend_request',title:person,body:privateText,href:'/profile/member-id',read:false,created_at:'2026-11-01T11:00:00Z'}];
const chats=[{id:'chat-1',kind:'direct',otherName:person,unread_count:2,updated_at:'2026-11-01T13:00:00Z',messages:[{content:privateText}]}];
function apiRows(locale){return raw.map(row=>{const {localization,...item}=notificationCopy.localizeNotification(row,translatorFor(locale,'NotificationCopy'));return item;});}
function defer(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function elements(value,predicate,result=[]){if(Array.isArray(value))for(const child of value)elements(child,predicate,result);else if(value&&typeof value==='object'&&value.props){if(predicate(value))result.push(value);elements(value.props.children,predicate,result);}return result;}
function text(value){if(value==null||typeof value==='boolean')return'';if(Array.isArray(value))return value.map(text).join(' ');return typeof value==='object'?text(value.props?.children):String(value);}
function fixture({locale='de',handler}={}){
 let language=locale,auth={isSignedIn:true,isLoaded:true,userId:'member-a',sessionId:'session-a'},cursor=0,dirty=false,tree,disposed=false;
 const slots=[],pendingEffects=[],calls=[],translations=new Map();
 const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
 const hooks={
  useState(initial){const index=cursor++;if(!slots[index]){slots[index]={value:typeof initial==='function'?initial():initial};slots[index].set=next=>{const value=typeof next==='function'?next(slots[index].value):next;if(!Object.is(value,slots[index].value)){slots[index].value=value;dirty=true;}};}return[slots[index].value,slots[index].set];},
  useRef(initial){const index=cursor++;slots[index]??={current:initial};return slots[index];},
  useCallback(callback,deps){const index=cursor++;if(!same(slots[index]?.deps,deps))slots[index]={deps:[...deps],value:callback};return slots[index].value;},
  useEffect(callback,deps){const index=cursor++;if(!same(slots[index]?.deps,deps)){const prior=slots[index];slots[index]={deps:deps&&[...deps],cleanup:prior?.cleanup};pendingEffects.push(()=>{prior?.cleanup?.();slots[index].cleanup=callback();});}},
 };
 const translate=namespace=>{const key=language+':'+String(namespace);if(!translations.has(key))translations.set(key,translatorFor(language,namespace));return translations.get(key);};
 const fetch=async(url,init={})=>{const call={url:String(url),init,method:init.method??'GET',locale:language,userId:auth.userId};calls.push(call);
  if(call.url==='/api/friendships')return Response.json({incoming:[{friendship_id:'friendship-1',user_id:'friend-1',display_name:person}]});
  const fallback=()=>call.url==='/api/notifications'?Response.json({notifications:apiRows(call.locale)}):call.url==='/api/conversations'?Response.json({data:chats}):Response.json({success:true});
  return handler?handler(call,fallback):fallback();
 };
 const mocks={react:hooks,'react/jsx-runtime':jsx,'next/link':{default:'test-link'},'next-intl':{useLocale:()=>language,useTranslations:translate},'@clerk/nextjs':{useAuth:()=>auth},'lucide-react':new Proxy({},{get:(_object,name)=>`test-icon-${String(name)}`}), '@/lib/notifications':{timeAgo:()=>'',notificationMeta:{}}};
 const mod={exports:{}};new Function('require','module','exports','fetch',compiled)(name=>{assert.ok(Object.hasOwn(mocks,name),`Unexpected component import ${name}`);return mocks[name];},mod,mod.exports,fetch);
 function render(){assert.equal(disposed,false);cursor=0;dirty=false;tree=mod.exports.default();const effects=pendingEffects.splice(0);for(const effect of effects)effect();return tree;}
 const rows=()=>elements(tree,node=>typeof node.type==='function'&&node.type.name==='NotifRow').map(node=>node.props.notif);
 return{calls,render,rows,get text(){return text(tree);},loading:()=>text(tree).includes(translatorFor(language)('Ui.text_ba8a3775a261b9')),
  setLocale(next){language=next;dirty=true;return render();},setOwner(next){auth={...auth,userId:next,sessionId:next+'-session'};dirty=true;return render();},
  async settle(){for(let pass=0;pass<12;pass++){if(dirty)render();await nextTurn();}assert.equal(dirty,false);},
  filter(id){const button=elements(tree,node=>node.type==='button'&&node.key===id)[0];assert.ok(button,`Filter ${id}`);button.props.onClick();render();},
  selectedFilter:()=>elements(tree,node=>node.type==='button'&&['all','booking','message','job','money','social','system'].includes(node.key)&&node.props.className.includes('bg-gold/10'))[0]?.key,
  rowProps(id){const node=elements(tree,node=>typeof node.type==='function'&&node.type.name==='NotifRow'&&node.props.notif.id===id)[0];assert.ok(node,id);return node.props;},
  dispose(){disposed=true;for(const slot of slots)slot?.cleanup?.();},
 };
}

for(const locale of SUPPORTED_LOCALES){
 test(`${locale}: page immediately refreshes API notification copy, retaining opaque values and selected filter`,async t=>{
  const f=fixture();t.after(()=>f.dispose());f.render();await f.settle();
  f.filter('booking');assert.equal(f.selectedFilter(),'booking');
  const previous=f.calls.length;f.setLocale(locale);await f.settle();
  if(locale!=='de')assert.equal(f.calls.length,previous+2,'locale change immediately issues both GETs without a polling tick');
  assert.equal(f.selectedFilter(),'booking');const expected=apiRows(locale)[0];assert.deepEqual(f.rows(),[expected]);
  assert.ok(f.rows()[0].body.includes(person));assert.equal(f.rows()[0].read,true);assert.equal(f.rows()[0].href,raw[0].href);
  f.filter('all');const rows=f.rows();assert.equal(rows.find(row=>row.id==='notice-member').body,privateText);
  const chat=rows.find(row=>row.id==='chat-unread:chat-1');assert.equal(chat.title,person);
  const translate=translatorFor(locale);assert.equal(chat.body,translate('Ui.text_f6d5879b399536',{value1:'2',value2:translate('nav.messages')}));
  assert.ok(f.calls.every(call=>call.method==='GET'),'locale refresh never marks data read');
  assert.equal(f.calls.filter(call=>call.url==='/api/friendships').length,1,'personal friendship data is not reloaded merely for copy');
 });
}

test('late old-language failures and finally blocks cannot end current loading or commit old rows',async t=>{
 const pending=[];const f=fixture({handler(call,fallback){if(call.url==='/api/notifications'||call.url==='/api/conversations'){const value=defer();pending.push({call,value});return value.promise;}return fallback();}});t.after(()=>f.dispose());
 f.render();await f.settle();assert.equal(pending.length,2);
 f.setLocale('en');await f.settle();assert.equal(pending.length,4);assert.ok(pending.slice(0,2).every(item=>item.call.init.signal.aborted));
 pending[0].value.resolve(Response.json({error:'old session'}, {status:401}));pending[1].value.resolve(Response.json({data:[]}));await f.settle();
 assert.equal(f.loading(),true);assert.deepEqual(f.rows(),[]);
 pending[2].value.resolve(Response.json({notifications:apiRows('en')}));pending[3].value.resolve(Response.json({data:chats}));await f.settle();
 assert.equal(f.loading(),false);assert.equal(f.rows().find(row=>row.id==='notice-booking').body,apiRows('en')[0].body);
});

test('a response already parsing JSON cannot overwrite a newer locale or reintroduce an earlier same-locale generation',async t=>{
 const oldJson=defer(),pending=[];let initial=true;
 const f=fixture({handler(call,fallback){if(initial&&call.url==='/api/notifications')return {ok:true,status:200,json:()=>oldJson.promise};if(initial&&call.url==='/api/conversations'){initial=false;return Response.json({data:chats});}if(call.url==='/api/notifications'||call.url==='/api/conversations'){const value=defer();pending.push({call,value});return value.promise;}return fallback();}});t.after(()=>f.dispose());
 f.render();await f.settle();f.setLocale('en');await f.settle();f.setLocale('de');await f.settle();
 const current=pending.filter(item=>item.call.locale==='de');assert.equal(current.length,2);
 current.find(item=>item.call.url==='/api/notifications').value.resolve(Response.json({notifications:apiRows('de').map(row=>({...row,title:row.title+' CURRENT'}))}));current.find(item=>item.call.url==='/api/conversations').value.resolve(Response.json({data:chats}));await f.settle();
 oldJson.resolve(apiRows('de').length?{notifications:apiRows('de')}:{notifications:[]});for(const item of pending.filter(item=>item.call.locale==='en'))item.value.resolve(item.call.url==='/api/notifications'?Response.json({notifications:apiRows('en')}):Response.json({data:chats}));await f.settle();
 assert.ok(f.rows().find(row=>row.id==='notice-booking').title.endsWith(' CURRENT'));
});

test('switching owners masks previous private rows and late requests never restore the previous owner',async t=>{
 const pending=[];const f=fixture({handler(call,fallback){if(call.userId==='member-a'&&call.url==='/api/notifications'){const value=defer();pending.push(value);return value.promise;}return fallback();}});t.after(()=>f.dispose());
 f.render();await f.settle();f.setOwner('member-b');await f.settle();assert.ok(f.calls.some(call=>call.userId==='member-b'&&call.url==='/api/notifications'));
 pending[0].resolve(Response.json({notifications:apiRows('de').map(row=>({...row,title:'OLD PRIVATE ROW'}))}));await f.settle();assert.ok(f.rows().every(row=>row.title!=='OLD PRIVATE ROW'));
});

test('explicit read action retains its existing method and identifier; locale refresh adds no read writes',async t=>{
 const f=fixture({handler(call,fallback){if(call.method==='POST'){assert.equal(call.url,'/api/notifications');assert.deepEqual(JSON.parse(call.init.body),{id:'notice-member'});return Response.json({success:true});}return fallback();}});t.after(()=>f.dispose());
 f.render();await f.settle();await f.rowProps('notice-member').onRead('notice-member');await f.settle();assert.equal(f.rows().find(row=>row.id==='notice-member').read,true);
 const writes=f.calls.filter(call=>call.method!=='GET');assert.equal(writes.length,1);f.setLocale('sv');await f.settle();assert.equal(f.calls.filter(call=>call.method!=='GET').length,1);
});
