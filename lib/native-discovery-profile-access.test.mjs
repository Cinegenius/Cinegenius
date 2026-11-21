import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as privacy from './profile-privacy.ts';

function load(file,mocks){
 const module={exports:{}};
 const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',source)(id=>{assert.ok(id in mocks,id);return mocks[id]},module,module.exports);
 return module.exports;
}
const uuid=i=>`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`;
function fixture(tables={},options={}){
 const queries=[];
 const db={from(table){
  let from=0,to=Infinity,signal;const constraints=[];
  const q={select(value){constraints.push(['select',value]);return q},eq(...v){constraints.push(['eq',...v]);return q},in(...v){constraints.push(['in',...v]);return q},gt(...v){constraints.push(['gt',...v]);return q},order(...v){constraints.push(['order',...v]);return q},range(a,b){from=a;to=b;return q},abortSignal(value){signal=value;return q},then(resolve,reject){return Promise.resolve().then(async()=>{
   const query={table,from,to,constraints,index:queries.length};queries.push(query);signal?.throwIfAborted();
   const error=await options.beforeQuery?.(query,tables);
   signal?.throwIfAborted();if(error)return{data:null,error};
   let data=[...(tables[table]??[])];
   for(const[method,key,value]of constraints){
    if(method==='eq')data=data.filter(row=>row[key]===value);
    if(method==='in')data=data.filter(row=>value.includes(row[key]));
    if(method==='gt')data=data.filter(row=>row[key]>value);
    if(method==='order')data.sort((a,b)=>String(a[key]).localeCompare(String(b[key])));
   }
   data=data.slice(from,to+1);
   if(table!=='user_settings'&&options.relationshipResponseLimit)data=data.slice(0,options.relationshipResponseLimit);
   const selected=constraints.find(c=>c[0]==='select')[1].split(',');
   data=data.map(row=>Object.fromEntries(selected.filter(key=>key in row).map(key=>[key,row[key]])));
   await options.afterQuery?.(query,tables,data);signal?.throwIfAborted();
   return{data,error:null};
  }).then(resolve,reject)}};return q;
 }};
 const mocks={'server-only':{},'@/lib/db':{db},'@/lib/profile-privacy':privacy};
 return{...load('./native-discovery-profile-access.ts',mocks),...load('./profile-privacy-server.ts',mocks),queries,tables};
}
const chunks=(ids,size=60)=>Array.from({length:Math.ceil(ids.length/size)},(_,i)=>ids.slice(i*size,(i+1)*size));
const readAll=async(reader,ids)=>new Map((await Promise.all(chunks(ids).map(reader))).flatMap(value=>[...value]));
const relationQueries=f=>f.queries.filter(q=>q.table!=='user_settings');

test('complete viewer relationships match the canonical checker beyond 1,000 rows in all four directions',async()=>{
 const viewer='viewer';let id=0;
 const tables={user_settings:[
  {user_id:'ghost',ghost_mode:true},{user_id:viewer,ghost_mode:true,profile_visibility:'private'},
  ...['friend-from','friend-to','not-a-friend'].map(user_id=>({user_id,profile_visibility:'private'})),
  {user_id:'hidden-location',location_visibility:'hidden'},
  {user_id:'hidden-map',map_visibility:'hidden'},
 ],blocks:[],friendships:[]};
 for(let i=0;i<1001;i++){
  tables.blocks.push({id:uuid(++id),blocker_id:`incoming-${i}`,blocked_id:viewer});
  tables.blocks.push({id:uuid(++id),blocker_id:viewer,blocked_id:`outgoing-${i}`});
  tables.friendships.push({id:uuid(++id),sender_id:viewer,receiver_id:`from-${i}`,status:'accepted'});
  tables.friendships.push({id:uuid(++id),sender_id:`to-${i}`,receiver_id:viewer,status:'accepted'});
 }
 tables.blocks.push({id:uuid(++id),blocker_id:'blocked-in',blocked_id:viewer},{id:uuid(++id),blocker_id:viewer,blocked_id:'blocked-out'});
 tables.friendships.push({id:uuid(++id),sender_id:viewer,receiver_id:'friend-from',status:'accepted'},{id:uuid(++id),sender_id:'friend-to',receiver_id:viewer,status:'accepted'},
  {id:uuid(++id),sender_id:viewer,receiver_id:'friend-from',status:'accepted'}, // legacy duplicate pair
  {id:uuid(++id),sender_id:viewer,receiver_id:'not-a-friend',status:'pending'});
 const ids=[viewer,'public','ghost','friend-from','friend-to','not-a-friend','blocked-in','blocked-out','hidden-location','hidden-map',...Array.from({length:1100},(_,i)=>`person-${i}`)];
 const current=fixture(structuredClone(tables));
 const actual=await readAll(current.createNativeDiscoveryProfileAccess(viewer,new AbortController().signal),ids);
 const legacy=fixture(structuredClone(tables));
 const expected=await readAll(ids=>legacy.profileAccessFor(ids,viewer,{throwOnError:true}),ids);
 assert.deepEqual(actual,expected);
 assert.equal(actual.get('friend-from').profile,true);assert.equal(actual.get('friend-to').profile,true);
 for(const name of ['blocked-in','blocked-out','ghost','not-a-friend'])assert.equal(actual.get(name).profile,false,name);
 assert.equal(actual.get(viewer).profile,true);assert.equal(actual.get('hidden-location').map,false);assert.equal(actual.get('hidden-map').location,true);
 // Each direction has six nonempty pages plus the terminating empty page.
 assert.equal(relationQueries(current).length,28);
 assert.ok(relationQueries(current).every(q=>q.from===0&&q.to===199));
 assert.ok(relationQueries(current).every(q=>!q.constraints.some(c=>c[0]==='in')),'relationship URLs never embed the catalogue IDs');
 assert.ok(current.queries.filter(q=>q.table==='user_settings').every(q=>q.constraints.find(c=>c[0]==='in')[2].length<=60));
 assert.ok(relationQueries(current).every(q=>q.constraints.some(c=>c[0]==='eq'&&c[2]===viewer)));
 assert.ok(relationQueries(current).filter(q=>q.table==='friendships').every(q=>q.constraints.some(c=>c[0]==='eq'&&c[1]==='status'&&c[2]==='accepted')));
});

test('an API response cap and an exact page boundary cannot truncate permissions',async()=>{
 const tables={blocks:Array.from({length:400},(_,i)=>({id:uuid(i+1),blocker_id:`other-${i}`,blocked_id:'viewer'})),friendships:[],user_settings:[]};
 for(const relationshipResponseLimit of [undefined,37]){
  const f=fixture(structuredClone(tables),{relationshipResponseLimit});
  const access=await f.createNativeDiscoveryProfileAccess('viewer',new AbortController().signal)(['other-399','public']);
  assert.equal(access.get('other-399').profile,false);assert.equal(access.get('public').profile,true);
  const incoming=relationQueries(f).filter(q=>q.table==='blocks'&&q.constraints.some(c=>c[0]==='eq'&&c[1]==='blocked_id'));
  assert.equal(incoming.length,relationshipResponseLimit?12:3);
  assert.ok(incoming.slice(1).every(q=>q.constraints.some(c=>c[0]==='gt'&&c[1]==='id')));
 }
});

test('concurrent pages share only one relationship read; a new request or viewer reads fresh permissions',async()=>{
 const tables={blocks:[],friendships:[{id:uuid(1),sender_id:'a',receiver_id:'private',status:'accepted'}],user_settings:[{user_id:'private',profile_visibility:'private'}]};
 const f=fixture(tables);const read=f.createNativeDiscoveryProfileAccess('a',new AbortController().signal);
 assert.deepEqual(await read([]),new Map());assert.equal(f.queries.length,0);
 const pages=await Promise.all([read(['private']),read(['public']),read(['private','public'])]);
 assert.equal(pages[0].get('private').profile,true);assert.equal(relationQueries(f).length,5);
 const before=f.queries.length;tables.friendships.length=0;tables.blocks.push({id:uuid(2),blocker_id:'a',blocked_id:'public'});
 const fresh=await f.createNativeDiscoveryProfileAccess('a',new AbortController().signal)(['private','public']);
 assert.equal(fresh.get('private').profile,false);assert.equal(fresh.get('public').profile,false);assert.ok(f.queries.length>before);
 const other=await f.createNativeDiscoveryProfileAccess('b',new AbortController().signal)(['public']);
 assert.equal(other.get('public').profile,true);
 tables.user_settings.push({user_id:'public',ghost_mode:true});
 assert.equal((await f.createNativeDiscoveryProfileAccess('b',new AbortController().signal)(['public'])).get('public').profile,false);
});

test('settings remain fresh on every page, while anonymous reads never fetch relationships',async()=>{
 const tables={user_settings:[]};const f=fixture(tables),read=f.createNativeDiscoveryProfileAccess(null,new AbortController().signal);
 assert.equal((await read(['person','person',''])).get('person').profile,true);
 tables.user_settings.push({user_id:'person',ghost_mode:true});
 assert.equal((await read(['person'])).get('person').profile,false);
 assert.equal(relationQueries(f).length,0);assert.equal(f.queries.length,2);
});

test('later relationship errors, malformed pages, settings errors and aborts never produce permissive partial sets',async()=>{
 const blocks=Array.from({length:201},(_,i)=>({id:uuid(i+1),blocker_id:`blocked-${i}`,blocked_id:'viewer'}));
 const failing=fixture({blocks},{beforeQuery:q=>q.table==='blocks'&&q.constraints.some(c=>c[0]==='gt')?{code:'TEST'}:null});
 const read=failing.createNativeDiscoveryProfileAccess('viewer',new AbortController().signal);
 await assert.rejects(()=>read(['blocked-200']),/permissions unavailable/);
 await assert.rejects(()=>read(['public']),/permissions unavailable/,'a failed shared promise is not converted into empty sets');
 const malformed=fixture({blocks:[{id:null,blocker_id:'blocked',blocked_id:'viewer'}]});
 await assert.rejects(()=>malformed.createNativeDiscoveryProfileAccess('viewer',new AbortController().signal)(['public']),/permissions unavailable/);
 const settings=fixture({},{beforeQuery:q=>q.table==='user_settings'?{code:'TEST'}:null});
 await assert.rejects(()=>settings.createNativeDiscoveryProfileAccess('viewer',new AbortController().signal)(['public']),/permissions unavailable/);
 const controller=new AbortController();const aborted=fixture({blocks},{afterQuery:q=>{if(q.table==='blocks')controller.abort()}});
 await assert.rejects(()=>aborted.createNativeDiscoveryProfileAccess('viewer',controller.signal)(['public']),{name:'AbortError'});
 const early=new AbortController();early.abort();const unused=fixture();
 await assert.rejects(()=>unused.createNativeDiscoveryProfileAccess('viewer',early.signal)(['public']),{name:'AbortError'});assert.equal(unused.queries.length,0);
});

test('keyset pagination does not skip a late block when an earlier page is deleted',async()=>{
 const tables={blocks:Array.from({length:201},(_,i)=>({id:uuid(i+1),blocker_id:`blocked-${i}`,blocked_id:'viewer'}))};
 let removed=false;
 const f=fixture(tables,{afterQuery:q=>{if(!removed&&q.table==='blocks'&&q.constraints.some(c=>c[0]==='eq'&&c[1]==='blocked_id')){tables.blocks.splice(0,100);removed=true}}});
 const access=await f.createNativeDiscoveryProfileAccess('viewer',new AbortController().signal)(['blocked-200']);
 assert.equal(access.get('blocked-200').profile,false);
});
