import {nativeContractFixture, nativeFriendsFixture} from './native-contract-fixture.mjs';
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
  '@/lib/native-contact-contract':nativeContractFixture,'@/lib/native-friends':nativeFriendsFixture(db),
  'server-only':{},'next/server':{NextRequest,NextResponse},'next-intl/server':{getTranslations:async()=>key=>key},'next/cache':{revalidateTag:()=>{}},
  '@/lib/auth':{requireAuth:async()=>options.denied?NextResponse.json({error:'denied'},{status:options.denied}):{userId:'actor'}},'@/lib/rateLimit':{rateLimit:async(...args)=>{calls.push({rate:args});return{allowed:options.allowed!==false};}},'@/lib/db':{db},'@/lib/trust':{anyBlockExists:async()=>Boolean(options.blocked)},'@/lib/linked-profile-access':{blockedMediaOwnerIds:async()=>options.blockedIds??[],visibleLinkedProfileIds:async ids=>new Set(options.visible??ids)},
  '@/lib/contact-connections':connections,'@/lib/i18n/notification-copy':{localizedNotification:value=>({title:'Controlled title',body:'Controlled body',localization:{version:1,...value}})},
  '@clerk/nextjs/server':{clerkClient:async()=>({users:{getUser:async()=>({primaryEmailAddressId:'primary',emailAddresses:[{id:'primary',emailAddress:'test@example.invalid'}]})}})},
  '@/lib/email':{sendFriendRequestEmail:async(...args)=>mails.push(['request',...args]),sendFriendAcceptedEmail:async(...args)=>mails.push(['accepted',...args])},
 };
 function load(file){if(cache.has(file))return cache.get(file);const code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,mod={exports:{}};
 new Function('require','module','exports',code)(name=>name==='@/lib/contact-mutations'?load('lib/contact-mutations.ts'):mocks[name]??require(name),mod,mod.exports);cache.set(file,mod.exports);return mod.exports;}
 return{list:load('app/api/friendships/route.ts'),detail:load('app/api/friendships/[id]/route.ts'),favorite:load('app/api/native/v1/friendships/[id]/favorite/route.ts'),calls,mails};
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

const nativeHeaders={'X-CineGenius-Native-Contract':'cinegenius.friendships.v1','X-Contact-Account':'actor'};
const favoriteData=(is_favorite=false)=>({contract:'cinegenius.friendships.v1',writable:true,favorites:[{friendship_id:id,is_favorite}]});
const favoriteBody={contract:'cinegenius.friendships.v1',accountId:'actor',is_favorite:true};
function privateResponse(response){for(const header of ['cache-control','cdn-cache-control','vercel-cdn-cache-control'])assert.match(response.headers.get(header),/no-store/);}
test('native friend reads reject missing/stale actors and unsupported contracts before lookup; legacy remains opt-out',async()=>{
 for(const [headers,status] of [[{...nativeHeaders,'X-Contact-Account':''},409],[{...nativeHeaders,'X-Contact-Account':'old'},409],[{...nativeHeaders,'X-CineGenius-Native-Contract':'future'},400]]){
  const f=fixture();const r=await f.list.GET(request(null,'GET','',headers));assert.equal(r.status,status);privateResponse(r);assert.equal(f.calls.length,0);
 }
 const guest=fixture({denied:401});const r=await guest.list.GET(request(null,'GET','',nativeHeaders));assert.equal(r.status,401);privateResponse(r);assert.equal(guest.calls.length,0);
 const legacy=fixture();const data=await(await legacy.list.GET(request(null,'GET'))).json();assert.equal('contract' in data,false);assert.equal(legacy.calls.some(c=>c.rpc),false);
});
test('native friend list exposes canonical saved roles, own favorites and private media references only',async()=>{
 const profile={user_id:'target',display_name:'Stored name',avatar_url:'/api/media/private-ref',positions:['Oberbeleuchter','Costume Designer'],role:'Oberbeleuchter'};
 const f=fixture({rows:[{...row,status:'accepted'}],rpcData:favoriteData(true),result:table=>table==='profiles'?{data:[profile],error:null}:null});
 const r=await f.list.GET(request(null,'GET','',nativeHeaders)),data=await r.json();assert.equal(r.status,200);privateResponse(r);
 assert.equal(data.contract,'cinegenius.friendships.v1');assert.equal(data.accountId,'actor');assert.equal(data.capabilities.favoriteFriendsWrite,true);
 const friend=data.friends[0];assert.equal(friend.profile_visible,true);assert.equal(friend.avatar_url,profile.avatar_url);assert.equal(friend.is_favorite,true);
 assert.equal(friend.department_ids.length,2);assert.equal(friend.occupation_ids.length,2);assert.ok(friend.occupation_ids.includes(friend.primary_occupation.roleId));
 assert.deepEqual(f.calls.find(c=>c.rpc).args,{p_actor:'actor'});assert.equal(f.mails.length,0);
 const hidden=fixture({rows:[{...row,status:'accepted'}],visible:[],rpcData:favoriteData(true)});
 const concealed=(await(await hidden.list.GET(request(null,'GET','',nativeHeaders))).json()).friends[0];
 assert.equal(concealed.profile_visible,false);assert.equal(concealed.avatar_url,null);assert.equal(concealed.display_name,'member');assert.deepEqual(concealed.occupation_ids,[]);assert.deepEqual(concealed.department_ids,[]);assert.equal(concealed.primary_occupation,null);assert.equal(concealed.is_favorite,true);
});
test('favorite capability is explicitly absent before migration; failures never erase a saved favorite',async()=>{
 for(const code of ['PGRST202','42883']){
  const f=fixture({rows:[{...row,status:'accepted'}],rpcError:{code}});const r=await f.list.GET(request(null,'GET','',nativeHeaders)),d=await r.json();assert.equal(r.status,200);assert.equal(d.capabilities.favoriteFriendsRead,false);assert.equal(d.capabilities.favoriteFriendsWrite,false);assert.equal('is_favorite' in d.friends[0],false);
 }
 for(const rpcData of [{}, {...favoriteData(),favorites:[]}, {...favoriteData(),favorites:[{friendship_id:id,is_favorite:'false'}]}, {...favoriteData(),favorites:[...favoriteData().favorites,...favoriteData().favorites]}]){
  const f=fixture({rows:[{...row,status:'accepted'}],rpcData});const r=await f.list.GET(request(null,'GET','',nativeHeaders));assert.equal(r.status,503);privateResponse(r);assert.equal('friends' in await r.json(),false);
 }
 const unavailable=fixture({rpcError:{code:'offline'}});assert.equal((await unavailable.list.GET(request(null,'GET','',nativeHeaders))).status,503);
 const pending=fixture({rpcData:favoriteData()});const d=await(await pending.list.GET(request(null,'GET','',nativeHeaders))).json();assert.equal(d.friends.length,0);assert.equal(d.outgoing.length,1);assert.equal('is_favorite' in d.outgoing[0],false);
});
test('favorite writes require exact account, contract, desired boolean, current relationship and shared limit',async()=>{
 for(const [patch,status] of [[{contract:undefined},400],[{accountId:'previous'},409],[{is_favorite:'true'},400],[{is_favorite:undefined},400]]){
  const f=fixture();const r=await f.favorite.PUT(request({...favoriteBody,...patch},'PUT'),params);assert.equal(r.status,status);privateResponse(r);assert.equal(f.calls.length,0);
 }
 const limited=fixture({allowed:false});assert.equal((await limited.favorite.PUT(request(favoriteBody,'PUT'),params)).status,429);assert.deepEqual(limited.calls[0].rate,['contact-change:actor',40,60]);assert.equal(limited.calls.some(c=>c.rpc),false);
 for(const [status,expected] of [['missing',404],['blocked',403],['busy',409],['invalid',400]]){
  const f=fixture({rpcData:{status}});const r=await f.favorite.PUT(request(favoriteBody,'PUT'),params);assert.equal(r.status,expected);privateResponse(r);assert.equal(f.mails.length,0);
 }
 for(const rpcData of [{status:'saved',friendship_id:otherId,is_favorite:true,changed:true},{status:'saved',friendship_id:id,is_favorite:false,changed:true},{}]){
  const f=fixture({rpcData});assert.equal((await f.favorite.PUT(request(favoriteBody,'PUT'),params)).status,503);
 }
 for(const changed of [true,false]){
  const f=fixture({rpcData:{status:'saved',friendship_id:id,is_favorite:true,changed}}),r=await f.favorite.PUT(request(favoriteBody,'PUT'),params);assert.equal(r.status,200);privateResponse(r);
  assert.deepEqual(await r.json(),{contract:favoriteBody.contract,success:true,accountId:'actor',friendship_id:id,is_favorite:true,changed});
  assert.deepEqual(f.calls.find(c=>c.rpc),{rpc:'set_contact_favorite_v1',args:{p_actor:'actor',p_id:id,p_favorite:true}});assert.equal(f.mails.length,0);
 }
});

test('native occupation projection keeps uncertainty explicit and never guesses from display roles',()=>{
 const helpers=nativeFriendsFixture({});
 assert.deepEqual(helpers.friendOccupations(),{department_ids:[],occupation_ids:[],primary_occupation:null});
 assert.deepEqual(helpers.friendOccupations({positions:['Not in the catalogue'],role:'Crew'}),{department_ids:[],occupation_ids:[],primary_occupation:null});
 const multiple=helpers.friendOccupations({positions:['Costume Designer','Oberbeleuchter']});assert.equal(multiple.primary_occupation,null);assert.equal(multiple.department_ids.length,2);
 const chosen=helpers.friendOccupations({positions:['Costume Designer','Oberbeleuchter'],crew:{primaryOccupation:{departmentId:'kostuem',roleId:'kostuem/Costume%20Designer'}}});assert.equal(chosen.primary_occupation.roleId,'kostuem/Costume%20Designer');
});

test('native favorite UUIDs are normalized before mutation and confirmed echo comparison',async()=>{
 const normalized='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';const f=fixture({rpcData:{status:'saved',friendship_id:normalized,is_favorite:true,changed:true}});
 const r=await f.favorite.PUT(request(favoriteBody,'PUT'),{params:Promise.resolve({id:normalized.toUpperCase()})});assert.equal(r.status,200);assert.equal((await r.json()).friendship_id,normalized);assert.equal(f.calls.find(c=>c.rpc).args.p_id,normalized);
});
