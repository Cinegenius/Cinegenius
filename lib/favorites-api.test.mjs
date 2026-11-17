import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {projectProfilePrivacy} from './profile-privacy.ts';
const require=createRequire(import.meta.url),{NextRequest,NextResponse}=require('next/server');
const compiled=ts.transpileModule(readFileSync(new URL('../app/api/favorites/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const dbError={data:null,error:{message:'database fixture failed',code:'XX000'}};
const success=data=>({data,error:null});
const publicAccess={profile:true,location:true,map:true,activity:true,phone:false,email:false};
function fixture(handler,{userId='owner',permissions=new Map()}={}){
 const calls=[],accessCalls=[];
 const db={from(table){const q={table,method:'GET',filters:[]};const chain={select(value){q.select=value;return this},eq(key,value){q.filters.push([key,value]);return this},in(key,value){q.filters.push([key,value]);return this},order(){return this},limit(){return this},maybeSingle(){return this},insert(value){q.method='POST';q.body=value;return this},delete(){q.method='DELETE';return this},then(yes,no){calls.push(structuredClone(q));return Promise.resolve(handler(q,calls.length)).then(yes,no)}};return chain}};
 const mocks={'@/lib/db':{db},'@/lib/auth':{getCurrentUser:async()=>userId?{userId}:null,requireAuth:async()=>userId?{userId}:NextResponse.json({error:'unauthorized'},{status:401})},'@/lib/rateLimit':{rateLimit:async()=>({allowed:true})},'@/lib/listing-price':{listingPriceLabel:()=> 'Current price'},'@/lib/places/catalog':{placeReadFields:city=>({city})},'@/lib/places/core':{PLACE_COLUMNS:'place_city_name',placeDisplay:(_place,city)=>city},'@/lib/profile-privacy-server':{profileAccessFor:async(ids,owner,options)=>{accessCalls.push({ids,owner,options});return permissions}},'@/lib/profile-privacy':{projectProfilePrivacy},'next-intl/server':{getLocale:async()=> 'de',getTranslations:async()=>key=>key}};
 const module={exports:{}};new Function('require','module','exports',compiled)(name=>mocks[name]??require(name),module,module.exports);
 return {calls,accessCalls,get(query='',headers={}){return module.exports.GET(new NextRequest('https://fixture.invalid/api/favorites'+query,{headers}))},post(body,headers={}){return module.exports.POST(new NextRequest('https://fixture.invalid/api/favorites',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)}))}};
}
for(const query of ['', '?id=offer', '?ids=offer,other'])test(`favorite read ${query||'list'} exposes a database failure instead of an empty or unsaved state`,async()=>{
 const f=fixture(()=>dbError),r=await f.get(query);assert.equal(r.status,503);assert.ok((await r.json()).error);assert.match(r.headers.get('Cache-Control'),/private.*no-store/);
 assert.ok(f.calls.every(q=>q.filters.some(([key,value])=>key==='user_id'&&value==='owner')));
});
test('explicit removal is idempotent and is constrained to the authenticated bookmark owner',async()=>{
 let exists=true;const f=fixture(q=>{if(q.method==='DELETE'){exists=false;return success(null)}return success(exists?{id:'own-bookmark'}:null)});
 for(let i=0;i<2;i++){const r=await f.post({listing_id:'offer',action:'remove'},{'X-Favorites-Account':'owner'});assert.equal(r.status,200);assert.deepEqual(await r.json(),{isFavorited:false,listingId:'offer'});}
 assert.equal(f.calls.filter(q=>q.method==='DELETE').length,1);assert.equal(f.calls.filter(q=>q.method==='POST').length,0);
 const deletion=f.calls.find(q=>q.method==='DELETE');assert.deepEqual(deletion.filters,[['id','own-bookmark'],['user_id','owner'],['listing_id','offer']]);
});
for(const phase of ['lookup','delete','insert'])test(`${phase} failure never returns a successful favorite mutation`,async()=>{
 const f=fixture(q=>{if(phase==='lookup')return dbError;if(q.method==='DELETE'||q.method==='POST')return dbError;if(q.table==='favorites')return success(phase==='delete'?{id:'own-bookmark'}:null);return success({type:'prop',title:'Real title'})});
 const r=await f.post({listing_id:'offer'});assert.equal(r.status,503);assert.equal((await r.json()).isFavorited,undefined);
});
test('malformed input, stale account headers and signed-out requests cannot mutate bookmarks',async()=>{
 const f=fixture(()=>{throw new Error('must not query')});
 for(const body of ['{bad',{},null,{listing_id:'bad/id'},{listing_id:'offer',action:'publish'}])assert.equal((await f.post(body)).status,400);
 assert.equal((await f.post({listing_id:'offer'},{'X-Favorites-Account':'other'})).status,409);
 assert.equal((await f.get('',{'X-Favorites-Account':'other'})).status,409);
 assert.equal(f.calls.length,0);
 const out=fixture(()=>{throw new Error('must not query')},{userId:null});assert.equal((await out.get()).status,401);assert.equal((await out.post({listing_id:'offer'})).status,401);
});
test('Crew saves use the existing privacy gate and never accept client identity snapshots',async()=>{
 const f=fixture(q=>q.table==='favorites'?q.method==='POST'?success(null):success(null):success({user_id:'crew-user'}),{permissions:new Map([['crew-user',publicAccess]])});
 const r=await f.post({listing_id:'crew-user',listing_type:'creator',listing_title:'Forged name',listing_city:'Private city',listing_image:'https://attacker.invalid/image'});assert.equal(r.status,200);
 assert.deepEqual(f.calls.find(q=>q.method==='POST').body,{user_id:'owner',listing_id:'crew-user',listing_type:'creator'});
 assert.deepEqual(f.accessCalls[0],{ids:['crew-user'],owner:'owner',options:{throwOnError:true}});
 const hidden=fixture(()=>success(null),{permissions:new Map([['crew-user',{...publicAccess,profile:false}]])});assert.equal((await hidden.post({listing_id:'crew-user',listing_type:'creator'})).status,404);assert.equal(hidden.calls.length,1);
});
test('the unified list refreshes current offer/profile data and excludes hidden Crew and private location fields',async()=>{
 const rows=[{id:'a',listing_id:'offer',listing_type:'location',listing_title:'Stale offer'}, {id:'b',listing_id:'crew-user',listing_type:'creator',listing_title:'Stale crew',listing_city:'Old private city'}, {id:'c',listing_id:'hidden-user',listing_type:'creator',listing_title:'Hidden name'}];
 const f=fixture(q=>q.table==='favorites'?success(rows):q.table==='profiles'?success([{user_id:'crew-user',slug:'crew-slug',display_name:'Current crew',location:'Secret current city',avatar_url:'/api/media/current'}]):success([{id:'offer',type:'location',title:'Current offer',city:'Current city',price:10,image_url:null}]),{permissions:new Map([['crew-user',{...publicAccess,location:false}],['hidden-user',{...publicAccess,profile:false}]])});
 const r=await f.get();assert.equal(r.status,200);const {favorites}=await r.json();assert.equal(favorites.length,2);assert.equal(favorites[0].listing_title,'Current offer');assert.equal(favorites[1].listing_title,'Current crew');assert.equal(favorites[1].listing_city,null);assert.equal(favorites[1].href,'/profile/crew-slug');assert.ok(!JSON.stringify(favorites).includes('Hidden name'));assert.ok(!JSON.stringify(favorites).includes('Secret current city'));
 assert.deepEqual(f.calls.find(q=>q.table==='profiles').filters,[['user_id',['crew-user']]]);
 assert.deepEqual(rows[1].listing_city,'Old private city','reading never rewrites the stored bookmark');
});


test('explicit add is idempotent and never deletes or reinserts an existing own bookmark',async()=>{
 let exists=false;const f=fixture(q=>{
  if(q.table==='favorites'){
   if(q.method==='POST'){exists=true;return success(null);}
   if(q.method==='DELETE')throw new Error('explicit add must never delete');
   return success(exists?{id:'own-bookmark',listing_type:'prop'}:null);
  }
  return success({type:'prop',title:'Current visible item'});
 });
 for(let i=0;i<2;i++){const r=await f.post({listing_id:'offer',action:'add'});assert.equal(r.status,200);assert.deepEqual(await r.json(),{isFavorited:true,listingId:'offer'});}
 assert.equal(f.calls.filter(q=>q.method==='POST').length,1);assert.equal(f.calls.filter(q=>q.method==='DELETE').length,0);
 assert.equal(f.calls.filter(q=>q.table==='privacy_visible_listings').length,2,'each add request rechecks current source visibility');
});
test('explicit duplicate add retains fresh source permissions without deleting an inaccessible bookmark',async()=>{
 const f=fixture(q=>q.table==='favorites'?success({id:'own-bookmark',listing_type:'prop'}):success(null));
 const r=await f.post({listing_id:'offer',action:'add'});assert.equal(r.status,404);assert.ok(f.calls.every(q=>q.method==='GET'));
});
test('explicit Crew add uses the stored source kind on retries that omit a type hint',async()=>{
 const f=fixture(q=>q.table==='favorites'?success({id:'crew-bookmark',listing_type:'creator'}):success({user_id:'crew-user'}),{permissions:new Map([['crew-user',publicAccess]])});
 const r=await f.post({listing_id:'crew-user',action:'add'});assert.equal(r.status,200);assert.equal((await r.json()).isFavorited,true);assert.ok(f.calls.every(q=>q.method==='GET'));assert.ok(f.calls.some(q=>q.table==='profiles'));assert.ok(!f.calls.some(q=>q.table==='privacy_visible_listings'));
});
test('a concurrent duplicate insert is acknowledged only after confirming the same own bookmark',async()=>{
 let reads=0;const f=fixture(q=>q.table==='favorites'?q.method==='POST'?{data:null,error:{code:'23505'}}:success(++reads===1?null:{id:'concurrent-own',listing_type:'prop'}):success({type:'prop',title:'Current item'}));
 const r=await f.post({listing_id:'offer',action:'add'});assert.equal(r.status,200);assert.equal((await r.json()).isFavorited,true);assert.deepEqual(f.calls.at(-1).filters,[['user_id','owner'],['listing_id','offer']]);
});
