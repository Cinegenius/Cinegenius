import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
import * as policy from './profile-privacy.ts';
import {publicMapPoint} from './places/public-map-point.ts';
import {projectProfileContacts} from './contact-visibility.ts';
import {NextResponse,NextRequest} from 'next/server.js';
function load(path,deps){const m={exports:{}};const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(name=>{if(name in deps)return deps[name];throw Error('Unexpected import '+name);},m,m.exports);return m.exports;}

test('app capability requires every privacy field with a supported value, never defaults a partial response',()=>{
 assert.equal(policy.isPrivacySettings(policy.DEFAULT_PRIVACY),true);
 assert.equal(policy.isPrivacySettings({...policy.DEFAULT_PRIVACY,ghost_mode:true,map_visibility:'friends',profile_visibility:'private'}),true);
 for(const key of Object.keys(policy.DEFAULT_PRIVACY)){
  const partial={...policy.DEFAULT_PRIVACY};delete partial[key];
  assert.equal(policy.isPrivacySettings(partial),false,key);
  assert.equal(policy.isPrivacySettings({...policy.DEFAULT_PRIVACY,[key]:null}),false,key);
 }
 for(const value of [null,[],true,'settings',{}, {...policy.DEFAULT_PRIVACY,ghost_mode:'false'}, {...policy.DEFAULT_PRIVACY,map_visibility:'everyone'}, {...policy.DEFAULT_PRIVACY,profile_visibility:'friends'}, {...policy.DEFAULT_PRIVACY,message_permission:'friends'}])assert.equal(policy.isPrivacySettings(value),false);
 assert.equal(policy.isPrivacySettings({...policy.DEFAULT_PRIVACY,future_field:'ignored'}),true);
});

test('ghost overrides every saved audience for strangers and friends without mutating saved preferences',()=>{
 const saved={...policy.DEFAULT_PRIVACY,ghost_mode:true,phone_visibility:'friends'};
 for(const viewer of [null,'stranger','friend'])assert.deepEqual(policy.profileAccess(saved,'owner',viewer,true),policy.HIDDEN_PROFILE_ACCESS);
 assert.ok(Object.values(policy.profileAccess(saved,'owner','owner')).every(Boolean));
 assert.equal(saved.phone_visibility,'friends');assert.equal(policy.profileAccess({...saved,ghost_mode:false},'owner','friend',true).phone,true);
});
test('accepted friends, membership and blocks intersect profile, field and map permissions',()=>{
 const settings={...policy.DEFAULT_PRIVACY,profile_visibility:'private',location_visibility:'friends',map_visibility:'hidden',activity_visibility:'friends',phone_visibility:'friends'};
 assert.deepEqual(policy.profileAccess(settings,'owner','pending'),policy.HIDDEN_PROFILE_ACCESS);
 const friend=policy.profileAccess(settings,'owner','friend',true);assert.equal(friend.location,true);assert.equal(friend.map,false);assert.equal(friend.activity,true);assert.equal(friend.phone,true);assert.equal(friend.email,false);
 assert.deepEqual(policy.profileAccess(settings,'owner','friend',true,true),policy.HIDDEN_PROFILE_ACCESS);
 assert.equal(policy.profileAccess({location_visibility:'hidden',map_visibility:'public'},'owner','member').map,false);
 assert.equal(policy.profileAccess({location_visibility:'members'},'owner',null).location,false);
 assert.equal(policy.profileAccess({location_visibility:'members'},'owner','member').location,true);
});
test('hidden city and coordinates cannot survive serialization or be reconstructed by the public city map fallback',()=>{
 const row={user_id:'owner',city:'München',location:'München',place_city_id:'city:2867714',place_country_code:'DE',place_city_name:'München',place_status:'resolved',lat:48.13,lng:11.58,last_seen_at:'now',phone:'private',contact_email:'private@example.invalid',display_name:'Own test'};
 const projected=policy.projectProfilePrivacy(row,policy.profileAccess({location_visibility:'hidden',activity_visibility:'hidden'},'owner',null));
 for(const key of ['city','location','place_city_id','place_country_code','lat','lng','last_seen_at','phone','contact_email'])assert.equal(projected[key],null,key);
 assert.deepEqual(publicMapPoint(projected),{lat:null,lng:null});assert.equal(row.city,'München');
 const offMap=policy.projectProfilePrivacy(row,policy.profileAccess({map_visibility:'hidden'},'owner',null));assert.equal(offMap.city,'München');assert.deepEqual(publicMapPoint(offMap),{lat:null,lng:null});
 assert.equal(projectProfileContacts(row,{phone:'friends',contact_email:'friends'},'friend',false,true).phone,'private');assert.equal(projectProfileContacts(row,{phone:'friends',contact_email:'friends'},'pending').phone,null);
});
function fixture(){
 let ghost=false,accepted=true,failed=false;const calls=[];
 const db=createClient('https://privacy-fixture.invalid','own-fixture-key',{auth:{persistSession:false},global:{fetch:async(input)=>{
  const u=new URL(input);calls.push(u);let rows=[];
  if(failed)return Response.json({message:'unavailable',code:'08006'},{status:400});
  if(u.pathname.endsWith('/user_settings'))rows=[{user_id:'owner',...policy.DEFAULT_PRIVACY,ghost_mode:ghost,profile_visibility:'private',phone_visibility:'friends'}];
  if(accepted&&u.pathname.endsWith('/friendships')&&u.searchParams.get('sender_id')==='eq.viewer')rows=[{receiver_id:'owner'}];
  if(u.pathname.endsWith('/privacy_visible_listings'))rows=ghost?[]:[{id:'offer'}];
  return Response.json(rows);
 }}});
 return {...load('./profile-privacy-server.ts',{'server-only':{},'@/lib/db':{db},'@/lib/profile-privacy':policy}),calls,setGhost:v=>ghost=v,setFriends:v=>accepted=v,setFailed:v=>failed=v};
}
test('server authorization is fresh after ghost, friendship removal and failure; cached listing content cannot bypass it',async()=>{
 const f=fixture();assert.equal((await f.profileAccessFor(['owner'],'viewer')).get('owner').phone,true);
 f.setFriends(false);assert.equal((await f.profileAccessFor(['owner'],'viewer')).get('owner').profile,false);
 f.setFriends(true);f.setGhost(true);assert.equal((await f.profileAccessFor(['owner'],'viewer')).get('owner').profile,false);
 assert.deepEqual(await f.filterPublicListings([{id:'offer',title:'cached'}]),[]);
 f.setGhost(false);assert.equal((await f.filterPublicListings([{id:'offer'}])).length,1);
 f.setFailed(true);assert.deepEqual((await f.profileAccessFor(['owner'],'viewer')).get('owner'),policy.HIDDEN_PROFILE_ACCESS);await assert.rejects(()=>f.publicListingIds(['offer']));
 assert.ok(Object.values((await f.profileAccessFor(['viewer'],'viewer')).get('viewer')).every(Boolean));
});
function settingsFixture(){
 let actor='owner',fail=false;const stored=new Map(),writes=[],invalidations=[];
 const db=createClient('https://privacy-fixture.invalid','own-fixture-key',{auth:{persistSession:false},global:{fetch:async(input,options)=>{
  const url=new URL(input);if(fail)return Response.json({code:'08006',message:'unavailable'},{status:400});
  let id=url.searchParams.get('user_id')?.slice(3);
  if(options.method==='POST'){const body=JSON.parse(options.body);id=body.user_id;writes.push(body);stored.set(id,{...policy.DEFAULT_PRIVACY,...stored.get(id),...body});}
  return Response.json(stored.get(id)??null);
 }}});
 const route=load('../app/api/user-settings/route.ts',{'@/lib/profile-privacy':policy,'@/lib/db':{db},'@/lib/auth':{requireAuth:async()=>actor?{userId:actor}:NextResponse.json({}, {status:401})},'next/server':{NextResponse},'next-intl/server':{getTranslations:async()=>key=>key},'next/cache':{revalidateTag:(...v)=>invalidations.push(v),revalidatePath:()=>{}}});
 return {...route,writes,invalidations,setActor:v=>actor=v,setFail:v=>fail=v,stored};
}
const req=body=>new NextRequest('http://localhost/api/user-settings',{method:'PATCH',body:JSON.stringify(body)});
test('settings are own-account only, reject stale-account and unknown writes, preserve choices during ghost, expire public caches',async()=>{
 const f=settingsFixture();let r=await f.PATCH(req({accountId:'owner',map_visibility:'friends',phone_visibility:'friends'}));assert.equal(r.status,200);
 r=await f.PATCH(req({accountId:'owner',ghost_mode:true}));assert.equal((await r.json()).settings.map_visibility,'friends');
 r=await f.PATCH(req({ghost_mode:false}));assert.equal((await r.json()).settings.phone_visibility,'friends');
 assert.ok(f.invalidations.every(([,mode])=>mode.expire===0));assert.match(r.headers.get('cache-control'),/no-store/);
 const count=f.writes.length;for(const body of [{accountId:'other',ghost_mode:true},{user_id:'other',ghost_mode:true},{ghost_mode:'true'},{map_visibility:'admins'},{}])assert.ok((await f.PATCH(req(body))).status>=400);assert.equal(f.writes.length,count);
 f.setActor(null);assert.equal((await f.GET()).status,401);assert.equal((await f.PATCH(req({ghost_mode:true}))).status,401);
 f.setActor('other');assert.equal((await f.GET()).status,200);assert.equal((await f.GET()).headers.get('cache-control'),'private, no-store, max-age=0');
 f.setFail(true);assert.equal((await f.GET()).status,500);assert.equal((await f.PATCH(req({ghost_mode:true}))).status,500);
});
