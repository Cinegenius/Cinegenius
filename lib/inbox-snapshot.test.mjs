import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {NextResponse} from 'next/server.js';
const require=createRequire(import.meta.url);
function load(file,mocks){
 const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',code)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);return mod.exports;
}
function fixture({userId='own-member',notificationError=false,countError=false}={}){
 const calls=[];let storedRead=false;
 const notification={id:'own-notice',type:'friend_request',title:'Own fixture',body:'Own test text',href:'/dashboard',read:false,created_at:'2026-10-31T12:00:00Z'};
 const db={from(table){const operations=[];const q={select(value){operations.push(['select',value]);return q},eq(...args){operations.push(['eq',...args]);return q},neq(...args){operations.push(['neq',...args]);return q},order(...args){operations.push(['order',...args]);return q},limit(...args){operations.push(['limit',...args]);return q},update(){storedRead=true;return q},then(resolve){calls.push({table,operations});return Promise.resolve({data:notificationError?null:[{...notification,read:storedRead}],error:notificationError?{}:null}).then(resolve)}};return q}};
 const getUnreadMessageCounts=async id=>{calls.push({rpc:'unread_message_counts',userId:id});if(countError)throw Error('fixture database failure');return{count:4,byConversation:{'own-conversation':4}}};
 const auth={getCurrentUser:async()=>userId?{userId}:null,requireAuth:async()=>userId?{userId}:NextResponse.json({}, {status:401})};
 const data=load('./inbox-data.ts',{'server-only':{},'@/lib/db':{db}});
 const deps={'@/lib/auth':auth,'@/lib/inbox-data':data,'@/lib/unread-message-counts':{getUnreadMessageCounts},'@/lib/db':{db},'next/server':{NextResponse}};
 return {GET:load('../app/api/inbox/route.ts',deps).GET,notifications:load('../app/api/notifications/route.ts',deps),calls};
}
test('one header response returns the same two indicators with one existing count RPC and one bounded notification query',async()=>{
 const f=fixture();const response=await f.GET();const data=await response.json();assert.equal(response.status,200);assert.equal(data.count,4);assert.equal(data.notifications.length,1);
 assert.deepEqual(Object.keys(data).sort(),['count','notifications']);assert.equal(f.calls.length,2);
 const q=f.calls.find(c=>c.table==='notifications');assert.ok(q.operations.some(op=>op[0]==='eq'&&op[1]==='user_id'&&op[2]==='own-member'));
 assert.ok(q.operations.some(op=>op[0]==='neq'&&op[1]==='type'&&op[2]==='new_message'));
 assert.ok(q.operations.some(op=>op[0]==='limit'&&op[1]===30));assert.ok(q.operations.some(op=>op[0]==='order'&&op[1]==='created_at'&&op[2].ascending===false));
 assert.deepEqual(f.calls.find(c=>c.rpc),{rpc:'unread_message_counts',userId:'own-member'});
 assert.match(response.headers.get('cache-control'),/private, no-store/);assert.equal(response.headers.get('cdn-cache-control'),'no-store');assert.equal(response.headers.get('vercel-cdn-cache-control'),'no-store');
});
test('guests are denied without a database call; either database failure is an error rather than a successful zero',async()=>{
 const guest=fixture({userId:null});const denied=await guest.GET();assert.equal(denied.status,401);assert.deepEqual(guest.calls,[]);
 for(const options of [{notificationError:true},{countError:true}]){
  const f=fixture(options);const response=await f.GET();assert.equal(response.status,500);assert.deepEqual(await response.json(),{code:'inbox_unavailable'});assert.match(response.headers.get('cache-control'),/no-store/);
 }
});
test('account switches and read acknowledgements keep account scope and reread the real data without a shared cache',async()=>{
 const a=fixture({userId:'own-a'}),b=fixture({userId:'own-b'});
 await a.GET();await b.GET();assert.equal(a.calls.find(c=>c.rpc).userId,'own-a');assert.equal(b.calls.find(c=>c.rpc).userId,'own-b');
 for(const c of b.calls.filter(c=>c.table))assert.ok(c.operations.some(op=>op[0]==='eq'&&op[1]==='user_id'&&op[2]==='own-b'));
 assert.equal((await (await a.GET()).json()).notifications[0].read,false);
 assert.equal((await a.notifications.PATCH()).status,200);
 const refreshed=await (await a.GET()).json();assert.equal(refreshed.notifications[0].read,true);assert.equal(refreshed.count,4,'notification reads do not clear message receipts');
 assert.equal(a.calls.filter(c=>c.rpc).length,3,'every snapshot rechecks stored counts');
 const old=await (await a.notifications.GET()).json();assert.deepEqual(old.notifications,refreshed.notifications,'legacy consumers retain their unchanged response');
});
