import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {PGlite} from '@electric-sql/pglite';
import {homeCrewFixture} from './home-crew-fixture.mjs';
import {orderHomeCrew} from './home-crew-selection.ts';
import {profileAccess} from './profile-privacy.ts';
import {normalizeQuickStartDraft, START_QUICK_START_DRAFT} from './quick-start-flow.ts';
import {saveHomeCrewPreference} from './home-crew-preference.ts';

const now=Date.parse('2026-11-21T15:00:00Z');
function fixture() {
  const rows=Array.from({length:80},(_,i)=>({user_id:`person-${i}`,display_name:`Person ${i}`,profile_type:'lighting',profile_types:['lighting'],created_at:new Date(now-i*1000).toISOString()}));
  const preferences=new Map();let fail=false;
  const db=createClient('https://own-home-crew-fixture.invalid','own-fixture-key',{auth:{persistSession:false},global:{fetch:async(input)=>{
    const url=new URL(input),ids=url.searchParams.get('user_id')?.slice(4,-1).split(',');
    if(url.pathname.endsWith('/user_settings')) return fail
      ? Response.json({code:'08006',message:'unavailable'},{status:500})
      : Response.json([...preferences].filter(([id])=>ids.includes(id)).map(([user_id,show_in_home_crew])=>({user_id,show_in_home_crew})));
    const data=ids?rows.filter(row=>ids.includes(row.user_id)):rows.slice(Number(url.searchParams.get('offset')??0),Number(url.searchParams.get('offset')??0)+Number(url.searchParams.get('limit')??500));
    return Response.json(data);
  }}});
  const privacy=new Map();
  return {...homeCrewFixture(db,async ids=>new Map(ids.map(id=>[id,profileAccess(privacy.get(id),id,null)]))),rows,preferences,privacy,setFail:value=>fail=value};
}

test('homepage opt-out is enforced before serialization, backfills the rail and refreshes on the next request',async()=>{
 const f=fixture(),order=orderHomeCrew(f.rows,now);
 for(const row of order.slice(0,40))f.preferences.set(row.user_id,false);
 let result=await f.homeCrewProfiles(now);
 assert.equal(result.data.length,10);
 assert.deepEqual(result.data.map(row=>row.user_id),order.slice(40,50).map(row=>row.user_id));
 assert.ok(result.data.every(row=>f.preferences.get(row.user_id)!==false));
 const id=result.data[0].user_id;f.preferences.set(id,false);
 result=await f.homeCrewProfiles(now);assert.ok(!result.data.some(row=>row.user_id===id));
 f.preferences.set(id,true);result=await f.homeCrewProfiles(now);assert.equal(result.data[0].user_id,id);
});
test('homepage eligibility never overrides members-only, friends-only or Ghost, and fails closed on lookup errors',async()=>{
 const f=fixture(),order=orderHomeCrew(f.rows,now);
 const hidden=[{profile_visibility:'members'},{profile_visibility:'private'},{ghost_mode:true}];
 hidden.forEach((value,index)=>{f.privacy.set(order[index].user_id,value);f.preferences.set(order[index].user_id,true)});
 f.preferences.set(order[3].user_id,null);
 const result=await f.homeCrewProfiles(now);
 assert.equal(result.data.length,10);
 assert.ok(order.slice(0,4).every(row=>!result.data.some(item=>item.user_id===row.user_id)));
 f.setFail(true);await assert.rejects(()=>f.homeCrewProfiles(now),/preferences unavailable/);
});
test('setup keeps an explicit opt-out across draft recovery and refuses unconfirmed saves',async context=>{
 const draft={...START_QUICK_START_DRAFT,showInHomeCrew:false};
 assert.equal(normalizeQuickStartDraft(JSON.parse(JSON.stringify(draft))).showInHomeCrew,false);
 assert.equal(normalizeQuickStartDraft({...draft,showInHomeCrew:'true'}).showInHomeCrew,undefined);
 let valid=true;const sent=[];
 context.mock.method(globalThis,'fetch',async(url,options)=>{
   sent.push({url,body:JSON.parse(options.body)});
   return Response.json({success:valid,settings:{show_in_home_crew:valid?false:true}});
 });
 await saveHomeCrewPreference('owner',false);
 assert.deepEqual(sent[0],{url:'/api/user-settings',body:{accountId:'owner',show_in_home_crew:false}});
 valid=false;await assert.rejects(()=>saveHomeCrewPreference('owner',false));
 const wizard=readFileSync(new URL('../components/ProfileSetupWizard.tsx',import.meta.url),'utf8');
 assert.ok(wizard.indexOf('await saveHomeCrewPreference(user.id')<wizard.indexOf('const profilePayload = setupProfilePayload'));
});
test('database migration preserves existing audiences and opt-outs, with no public settings access',async()=>{
 const pg=new PGlite();
 try {
  await pg.exec(`create role anon; create role authenticated; create role service_role;
   create table user_settings(user_id text primary key,profile_visibility text not null default 'public',ghost_mode boolean not null default false);
   alter table user_settings enable row level security;grant all on user_settings to service_role;
   insert into user_settings values ('old-private','members',true);`);
  const sql=readFileSync(new URL('../supabase/migrations/20261121145336_home_crew_visibility.sql',import.meta.url),'utf8');
  await pg.exec(sql);
  let row=(await pg.query('select * from user_settings')).rows[0];
  assert.equal(row.show_in_home_crew,true);assert.equal(row.profile_visibility,'members');assert.equal(row.ghost_mode,true);
  await pg.exec("update user_settings set show_in_home_crew=false; insert into user_settings(user_id,show_in_home_crew) values('new',false)");
  await pg.exec(sql);assert.ok((await pg.query('select * from user_settings')).rows.every(row=>row.show_in_home_crew===false));
  for(const role of ['anon','authenticated']) assert.equal((await pg.query('select has_table_privilege($1,$2,$3) allowed',[role,'user_settings','SELECT'])).rows[0].allowed,false);
  await assert.rejects(()=>pg.exec("update user_settings set show_in_home_crew=null where user_id='new'"));
 } finally {await pg.close();}
});
