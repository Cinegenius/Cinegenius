import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as connections from './contact-connections.ts';
const require=createRequire(import.meta.url),{NextRequest,NextResponse}=require('next/server');
const id='11111111-1111-4111-8111-111111111111',otherId='22222222-2222-4222-8222-222222222222';
const row={id,sender_id:'actor',receiver_id:'target',status:'pending',created_at:'2026-11-01'};
function fixture(options={}){
 const calls=[],mails=[],cache=new Map();
 const db={from(table){const ops=[];calls.push({table,ops});const query={};for(const name of ['select','eq','or','in','order'])query[name]=(...args)=>{ops.push([name,...args]);return query;};
 const result=()=>options.result?.(table,ops)??{data:table==='friendships'?(options.rows??[row]):table==='profiles'?(ops.some(op=>op[0]==='in')?[{user_id:'target',display_name:'Original name',avatar_url:'/original.jpg',role:'Original role'}]:{display_name:'Own sender name'}):null,error:options.databaseError??null};
 query.maybeSingle=async()=>result();query.then=(yes,no)=>Promise.resolve(result()).then(yes,no);return query;},rpc:async(name,args)=>{calls.push({rpc:name,args});return {data:options.rpcData??{status:'saved',changed:true,event:'friend_request',friendship:row},error:options.rpcError??null};}};
 const mocks={
  'server-only':{},'next/server':{NextRequest,NextResponse},'next-intl/server':{getTranslations:async()=>key=>key},'next/cache':{revalidateTag:()=>{}},
  '@/lib/auth':{requireAuth:async()=>options.denied?NextResponse.json({error:'denied'},{status:options.denied}):{userId:'actor'}},'@/lib/rateLimit':{rateLimit:async(...args)=>{calls.push({rate:args});return{allowed:options.allowed!==false};}},'@/lib/db':{db},'@/lib/trust':{anyBlockExists:async()=>Boolean(options.blocked)},'@/lib/linked-profile-access':{blockedMediaOwnerIds:async()=>options.blockedIds??[],visibleLinkedProfileIds:async ids=>new Set(options.visible??ids)},
  '@/lib/contact-connections':connections,'@/lib/i18n/notification-copy':{localizedNotification:value=>({title:'Controlled title',body:'Controlled body',localization:{version:1,...value}})},
  '@clerk/nextjs/server':{clerkClient:async()=>({users:{getUser:async()=>({primaryEmailAddressId:'primary',emailAddresses:[{id:'primary',emailAddress:'test@example.invalid'}]})}})},
  '@/lib/email':{sendFriendRequestEmail:async(...args)=>mails.push(['request',...args]),sendFriendAcceptedEmail:async(...args)=>mails.push(['accepted',...args])},
 };
 function load(file){if(cache.has(file))return cache.get(file);const code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,mod={exports:{}};
 new Function('require','module','exports',code)(name=>name==='@/lib/contact-mutations'?load('lib/contact-mutations.ts'):mocks[name]??require(name),mod,mod.exports);cache.set(file,mod.exports);return mod.exports;}
 return{list:load('app/api/friendships/route.ts'),detail:load('app/api/friendships/[id]/route.ts'),calls,mails};
}
const request=(body,method='POST',suffix='',headers={})=>new NextRequest('https://example.invalid/api/friendships'+suffix,{method,headers,...(method==='GET'?{}:{body:JSON.stringify(body)})});
const params={params:Promise.resolve({id})};
test('contact writes authenticate, validate and rate limit before atomic mutation',async()=>{
 for(const options of [{denied:401},{allowed:false}]){const api=fixture(options);assert.equal((await api.list.POST(request({receiver_id:'target'}))).status,options.denied??429);assert.equal(api.calls.some(call=>call.rpc),false);}
 for(const body of [null,{}, {receiver_id:123},{receiver_id:'actor'},{receiver_id:'invalid,filter'},{receiver_id:'target',accountId:'previous'}]){const api=fixture();assert.ok([400,409].includes((await api.list.POST(request(body))).status));assert.equal(api.calls.some(call=>call.rpc),false);}
});
test('only verified account, validated target and generated notification reach service RPC',async()=>{
 const api=fixture();const response=await api.list.POST(request({receiver_id:'target',sender_id:'forged',status:'accepted'}));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);
 const rpc=api.calls.find(call=>call.rpc);assert.equal(rpc.rpc,'contact_connection');assert.equal(rpc.args.p_actor,'actor');assert.equal(rpc.args.p_target,'target');assert.equal(rpc.args.p_action,'request');assert.equal(rpc.args.p_notification.localization.body.values.value0,'Own sender name');
 assert.deepEqual((await response.json()).friendship,connections.publicContactConnection(row));assert.equal(api.mails.length,1);
});
test('retries cannot repeat email; malformed or failed writes never claim success',async()=>{
 for(const status of ['accepted','pending']){const api=fixture({rpcData:{status:'existing',changed:false,friendship:{...row,status}}});assert.equal((await api.list.POST(request({receiver_id:'target'}))).status,200);assert.equal(api.mails.length,0);}
 for(const options of [{rpcError:{code:'offline'}},{rpcData:{}},{rpcData:{status:'saved',changed:true,friendship:{...row,id:'bad'}}},{databaseError:{code:'offline'}}]){const api=fixture(options);assert.equal((await api.list.POST(request({receiver_id:'target'}))).status,503);assert.equal(api.mails.length,0);}
});
test('repeated accepted transitions return the relationship without emailing again',async()=>{
 const accepted={...row,status:'accepted'};
 const first=fixture({rpcData:{status:'saved',changed:true,event:'friend_accepted',friendship:accepted}});
 assert.equal((await first.detail.PATCH(request({status:'accepted'},'PATCH'),params)).status,200);assert.equal(first.mails.length,1);assert.equal(first.mails[0][0],'accepted');
 const retry=fixture({rpcData:{status:'existing',changed:false,friendship:accepted}});
 assert.equal((await retry.detail.PATCH(request({status:'accepted'},'PATCH'),params)).status,200);assert.equal(retry.mails.length,0);
});
test('block, stale and busy outcomes stay private and cannot send mail',async()=>{
 for(const [status,expected] of [['blocked',403],['forbidden',403],['missing',404],['stale',409],['busy',409],['invalid',400]]){const api=fixture({rpcData:{status}});const response=await api.list.POST(request({receiver_id:'target'}));assert.equal(response.status,expected);assert.equal(api.mails.length,0);assert.match(response.headers.get('cache-control'),/private, no-store/);}
});
test('status errors cannot become a false no-contact result; canonical accepted edge wins',async()=>{
 const blocked=fixture({blocked:true});assert.equal((await blocked.list.GET(request(null,'GET','?userId=target'))).status,403);
 const failed=fixture({databaseError:{code:'offline'}});assert.equal((await failed.list.GET(request(null,'GET','?userId=target'))).status,503);
 const duplicate=fixture({rows:[row,{...row,id:otherId,sender_id:'target',receiver_id:'actor',status:'accepted'}]});assert.equal((await(await duplicate.list.GET(request(null,'GET','?userId=target'))).json()).friendship.id,otherId);
});
test('list deduplicates, excludes blocked identities and preserves private profile boundaries',async()=>{
 const rows=[row,{...row,id:otherId,status:'accepted'},{...row,id:'33333333-3333-4333-8333-333333333333',receiver_id:'blocked'}];
 const api=fixture({rows,blockedIds:['blocked'],visible:[]});const data=await(await api.list.GET(request(null,'GET'))).json();assert.equal(data.friends.length,1);assert.equal(data.incoming.length,0);assert.equal(data.outgoing.length,0);assert.equal(data.friends[0].display_name,'member');assert.equal(data.friends[0].avatar_url,null);assert.equal(api.calls.some(call=>call.table==='profiles'),false);
});
test('collaboration and removal reject unsafe input and share durable limits',async()=>{
 for(const body of [null,{status:'bad'},{action:'collab',label:{unsafe:true},is_public:true},{action:'collab',label:'x'.repeat(121),is_public:true},{action:'collab',label:'Own',is_public:'yes'}]){const api=fixture();assert.equal((await api.detail.PATCH(request(body,'PATCH'),params)).status,400);assert.equal(api.calls.some(call=>call.rpc),false);}
 for(const method of ['PATCH','DELETE']){const api=fixture({allowed:false});assert.equal((await api.detail[method](request({status:'accepted'},method),params)).status,429);assert.equal(api.calls.some(call=>call.rpc),false);}
 const changed=fixture();assert.equal((await changed.detail.DELETE(request(null,'DELETE','',{'X-Contact-Account':'previous'}),params)).status,409);assert.equal(changed.calls.some(call=>call.rpc),false);
});
