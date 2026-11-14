import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration='20261112213000_messaging_atomic_sends.sql';
const compatibility='20261114182622_direct_message_listing_compatibility.sql';
let pg;
before(async()=>{
 pg=new PGlite();
 await pg.exec(`create role anon;create role authenticated;create role service_role;
 create table profiles(user_id text primary key,display_name text);
 create table user_settings(user_id text primary key,message_permission text default 'everyone',profile_visibility text default 'public');
 create table friendships(id uuid primary key default gen_random_uuid(),sender_id text,receiver_id text,status text);
 create table blocks(blocker_id text,blocked_id text);
 create table companies(id uuid primary key default gen_random_uuid(),owner_user_id text,published boolean,slug text,name text);
 create table listings(id uuid primary key default gen_random_uuid(),user_id text,company_id uuid,published boolean,responsible_person jsonb);
 create table conversations(id uuid primary key default gen_random_uuid(),sender_id text,receiver_id text not null,listing_id text,listing_title text,listing_type text,created_at timestamptz default now(),updated_at timestamptz default now());
 create table messages(id uuid primary key default gen_random_uuid(),conversation_id uuid references conversations(id),sender_id text,content text,read_at timestamptz,created_at timestamptz default now());
 insert into profiles select name,name from unnest(array['actor','peer','other','third','legacy-a','legacy-b']) name;
 insert into profiles select 'member-'||n,'Own member '||n from generate_series(1,55) n;
 insert into conversations(id,sender_id,receiver_id,created_at) values('10000000-0000-4000-8000-000000000001','legacy-a','legacy-b','2026-01-01');
 insert into messages(id,conversation_id,sender_id,content,read_at,created_at) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','legacy-a','Own preserved legacy message','2026-01-03','2026-01-02');`);
 for(const file of ['message_read_receipts.sql','20261024120000_admin_support_messaging.sql','20261024170000_fix_support_conversation_conflict.sql','20261025110000_hide_own_messages.sql','20261028180000_private_form_drafts.sql','20261030150000_nonblocking_private_form_drafts.sql',migration,compatibility]) await pg.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
});
after(async()=>pg?.close());
const rows=async(sql,args=[])=>(await pg.query(sql,args)).rows;
const scalar=async(sql,args=[])=>(await rows(sql,args))[0].result;
async function tx(fn){await pg.exec('begin');try{await fn();}finally{await pg.exec('rollback');}}
async function denied(fn,code){await pg.exec('savepoint expected_failure');try{await assert.rejects(fn,error=>error.code===code);}finally{await pg.exec('rollback to savepoint expected_failure');await pg.exec('release savepoint expected_failure');}}
const direct=(key='direct-own-key',content='Own direct message',actor='actor',recipient='peer')=>scalar('select start_direct_conversation($1,$2,$3,$4) result',[actor,recipient,content,key]);
const group=(members=['peer'],key='group-own-key',name='Own group')=>scalar('select create_group_conversation($1,$2,$3::text[],$4) result',['actor',name,members,key]);
const manage=(id,action,target=null,actor='actor')=>pg.query('select manage_group_conversation($1,$2,$3,$4,null)',[id,actor,action,target]);
const send=(id,key='send-own-key',content='Own group message',actor='actor')=>scalar('select send_conversation_message($1,$2,$3,$4) result',[id,actor,content,key]);
const count=async(table)=>(await rows('select count(*)::int n from '+table))[0].n;

test('migration reruns without merging legacy chats, changing read receipts or exposing operations',async()=>{
 const legacy=await rows('select * from messages order by id');const receipts=await rows('select * from message_reads order by message_id,user_id');
 for(const file of [migration,compatibility]) await pg.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 assert.deepEqual(await rows('select * from messages order by id'),legacy);assert.deepEqual(await rows('select * from message_reads order by message_id,user_id'),receipts);
 assert.equal(await count('conversations'),1);
 const signatures=['set_member_block(text,text,boolean)','start_direct_conversation(text,text,text,text,uuid,text,text)','send_conversation_message(uuid,text,text,text)','create_group_conversation(text,text,text[],text)','manage_group_conversation(uuid,text,text,text,text)','messaging_recipient_available(text,text)','messaging_available_recipients(text,text[])'];
 for(const role of ['anon','authenticated']){
  for(const privilege of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await rows("select has_table_privilege($1,'messaging_operations',$2) allowed",[role,privilege]))[0].allowed,false);
  for(const signature of signatures)assert.equal((await rows("select has_function_privilege($1,$2,'execute') allowed",[role,signature]))[0].allowed,false);
 }
 for(const signature of signatures)assert.equal((await rows("select has_function_privilege('service_role',$1,'execute') allowed",[signature]))[0].allowed,true);
 const config=(await rows("select proconfig from pg_proc where oid='send_conversation_message(uuid,text,text)'::regprocedure"))[0].proconfig;
 assert.ok(config.includes('lock_timeout=2s'));
});

test('parallel retry calls confirm one direct message, one conversation and the exact stored result',()=>tx(async()=>{
 const results=await Promise.all([direct(),direct()]);
 assert.deepEqual(results.map(x=>x.created).sort(),[false,true]);assert.equal(results[0].conversationId,results[1].conversationId);assert.equal(results[0].message.id,results[1].message.id);
 assert.equal(await count('conversations'),2);assert.equal(await count('messages'),2);assert.equal(await count('messaging_operations'),1);
 await denied(()=>direct('direct-own-key','Changed text'),'PT409');await denied(()=>direct('direct-own-key','Own direct message','actor','other'),'PT409');
 const next=await direct('next-own-key','A second own message');assert.equal(next.conversationId,results[0].conversationId);assert.notEqual(next.message.id,results[0].message.id);
 assert.equal(await count('conversations'),2);assert.equal(await count('messages'),3);
}));

test('failed first sends roll back empty conversation creation and leave the original request key retryable',()=>tx(async()=>{
 await pg.exec(`create function pg_temp.fail_own_message() returns trigger language plpgsql as $$ begin raise exception 'own synthetic failure';end $$;
 create trigger fail_own_message before insert on messages for each row execute function pg_temp.fail_own_message();`);
 await denied(()=>direct(),'P0001');assert.equal(await count('conversations'),1);assert.equal(await count('messaging_operations'),0);
 await pg.exec('drop trigger fail_own_message on messages');assert.equal((await direct()).created,true);
}));

test('direct retries and account-only accepted contacts preserve authorization without a public directory entry',()=>tx(async()=>{
 await pg.exec("insert into friendships(sender_id,receiver_id,status) values('actor','account-only','accepted');insert into user_settings values('account-only','friends_only','private')");
 assert.equal(await scalar("select messaging_recipient_available('actor','account-only') result"),true);
 const first=await direct('account-only-key','Own text','actor','account-only');assert.equal(first.created,true);
 await pg.query("update conversation_members set left_at=now() where conversation_id=$1 and user_id='actor'",[first.conversationId]);
 await denied(()=>direct('account-only-key','Own text','actor','account-only'),'PT404');
 assert.equal(await count('messages'),2);
}));

test('public company and offer contacts need no personal profile, while private sources and contact restrictions remain effective',()=>tx(async()=>{
 await pg.exec("insert into companies(owner_user_id,published,slug,name) values('company-owner',true,'own-company','Own company');insert into user_settings values('company-owner','everyone','private')");
 assert.equal((await direct('own-company-key','Own company inquiry','actor','company-owner')).created,true);
 await pg.exec("update companies set published=false where owner_user_id='company-owner'");
 assert.equal(await scalar("select messaging_recipient_available('actor','company-owner') result"),false);
 await pg.exec("insert into listings(user_id,published,responsible_person) values('offer-owner',true,'{\"userId\":\"offer-owner\"}')");
 assert.equal((await direct('own-offer-key','Own listing inquiry','actor','offer-owner')).created,true);
 await pg.exec("insert into user_settings values('offer-owner','friends_only','public')");
 assert.equal(await scalar("select messaging_recipient_available('actor','offer-owner') result"),false);
 await denied(()=>direct('restricted-offer-key','Own text','actor','offer-owner'),'42501');
 await pg.exec("update user_settings set message_permission='everyone' where user_id='offer-owner';insert into blocks values('offer-owner','actor')");
 assert.equal(await scalar("select messaging_recipient_available('actor','offer-owner') result"),false);
}));

test('group creation checks blocks in both directions and consent between all selected members',()=>tx(async()=>{
 for(const [a,b] of [['actor','peer'],['peer','actor'],['peer','other']]){
  await pg.query('insert into blocks values($1,$2)',[a,b]);await denied(()=>group(['peer','other']),'42501');await pg.exec('delete from blocks');
 }
 await pg.exec("insert into user_settings values('peer','friends_only','public');insert into friendships(sender_id,receiver_id,status) values('actor','peer','accepted')");
 await denied(()=>group(['peer','other']),'42501');
 await pg.exec("insert into friendships(sender_id,receiver_id,status) values('other','peer','accepted')");
 const first=await group(['peer','other']);const replay=await group(['other','peer','peer']);assert.equal(replay.created,false);assert.equal(replay.conversationId,first.conversationId);
 await denied(()=>group(['peer','other'],'group-own-key','Changed group name'),'PT409');
 assert.equal((await rows('select role from conversation_members where conversation_id=$1 and user_id=\'actor\'',[first.conversationId]))[0].role,'admin');
}));

test('a private creator explicitly shares only their own identity without exposing another private member to strangers',()=>tx(async()=>{
 await pg.exec("insert into user_settings values('actor','everyone','private')");
 const g=await group(['peer']);assert.equal(g.created,true);
 await manage(g.conversationId,'add','other');
 await pg.exec("insert into user_settings values('peer','everyone','private')");
 await denied(()=>manage(g.conversationId,'add','third'),'42501');
 await denied(()=>group(['peer'],'private-other-key'),'42501');
}));

test('new group messages enforce current recipient settings and blocks, without altering old history or membership',()=>tx(async()=>{
 const g=await group(['peer','other']);const first=await send(g.conversationId);
 await pg.exec("insert into user_settings values('peer','friends_only','public')");await denied(()=>send(g.conversationId,'new-send-key'),'42501');
 assert.equal(await count('messages'),2);assert.equal((await send(g.conversationId)).message.id,first.message.id);
 await pg.exec("insert into friendships(sender_id,receiver_id,status) values('actor','peer','accepted')");assert.equal((await send(g.conversationId,'next-send-key')).created,true);
 await pg.exec("insert into blocks values('other','actor')");await denied(()=>send(g.conversationId,'blocked-send-key'),'42501');
 assert.equal((await rows('select count(*)::int n from conversation_members where conversation_id=$1 and left_at is null',[g.conversationId]))[0].n,3);
 assert.equal((await rows('select content from messages where id=$1',[first.message.id]))[0].content,'Own group message');
}));

test('adding checks all current members privacy, preserves rejoin boundaries and never exceeds 50 active members',()=>tx(async()=>{
 const g=await group();await pg.exec("insert into user_settings values('peer','everyone','private')");
 await denied(()=>manage(g.conversationId,'add','other'),'42501');
 await pg.exec("insert into friendships(sender_id,receiver_id,status) values('peer','other','accepted')");await manage(g.conversationId,'add','other');
 await pg.query("update conversation_members set joined_at='2020-01-01',left_at='2021-01-01' where conversation_id=$1 and user_id='other'",[g.conversationId]);
 await manage(g.conversationId,'add','other');const joined=(await rows("select joined_at from conversation_members where conversation_id=$1 and user_id='other'",[g.conversationId]))[0].joined_at;
 assert.ok(new Date(joined)>new Date('2021-01-01'));await manage(g.conversationId,'add','other');assert.deepEqual((await rows("select joined_at from conversation_members where conversation_id=$1 and user_id='other'",[g.conversationId]))[0].joined_at,joined);
 const full=await group(Array.from({length:49},(_,i)=>'member-'+(i+1)),'full-group-key');await denied(()=>manage(full.conversationId,'add','member-50'),'PT409');
 assert.equal((await rows('select count(*)::int n from conversation_members where conversation_id=$1 and left_at is null',[full.conversationId]))[0].n,50);
 await manage(full.conversationId,'remove','member-1');await manage(full.conversationId,'add','member-50');
 assert.equal((await rows('select count(*)::int n from conversation_members where conversation_id=$1 and left_at is null',[full.conversationId]))[0].n,50);
}));

test('only current admins explicitly promote; no automatic promotion occurs and the final member can leave',()=>tx(async()=>{
 const g=await group(['peer','other']);await denied(()=>manage(g.conversationId,'leave'),'PT409');
 await denied(()=>manage(g.conversationId,'promote','other','peer'),'42501');
 assert.deepEqual((await rows('select user_id from conversation_members where conversation_id=$1 and role=\'admin\'',[g.conversationId])).map(x=>x.user_id),['actor']);
 await manage(g.conversationId,'promote','peer');await manage(g.conversationId,'leave');
 assert.equal((await rows("select role from conversation_members where conversation_id=$1 and user_id='other'",[g.conversationId]))[0].role,'member');
 await denied(()=>send(g.conversationId,'inactive-send'),'PT404');await manage(g.conversationId,'remove','other','peer');await manage(g.conversationId,'leave',null,'peer');
 assert.equal((await rows('select count(*)::int n from conversation_members where conversation_id=$1 and left_at is null',[g.conversationId]))[0].n,0);
}));

test('private recovery length permits full recipient IDs without weakening revisions or existing snapshots',()=>tx(async()=>{
 const key='message:recipient:'+'a'.repeat(128);
 const first=(await rows("select * from save_private_form_draft('actor',$1,0,$2)",[key,{content:'Own recoverable text',requestKey:'own-request-key',destination:key}]))[0];
 assert.equal(first.revision,1);await denied(()=>pg.query("select * from save_private_form_draft('actor',$1,0,$2)",[key,{content:'Stale edit'}]),'PT409');
 assert.equal((await rows('select draft_data from private_form_drafts where form_key=$1',[key]))[0].draft_data.content,'Own recoverable text');
}));

test('explicit block state is retry-safe and preserves reverse blocks while immediately preventing further sends',()=>tx(async()=>{
 const first=await direct();
 const block=async(state)=>(await rows("select set_member_block('actor','peer',$1) result",[state]))[0].result;
 assert.deepEqual(await block(true),{blocked:true,changed:true});assert.deepEqual(await block(true),{blocked:true,changed:false});
 assert.equal(await count('blocks'),1);await denied(()=>send(first.conversationId,'blocked-own-key'),'42501');
 await pg.exec("insert into blocks values('peer','actor')");assert.deepEqual(await block(false),{blocked:false,changed:true});
 assert.deepEqual(await block(false),{blocked:false,changed:false});assert.deepEqual(await rows('select * from blocks'),[{blocker_id:'peer',blocked_id:'actor'}]);
 await denied(()=>send(first.conversationId,'reverse-block-key'),'42501');
 await denied(()=>pg.query("select set_member_block('actor','actor',true)"),'22023');
 assert.equal(await count('messages'),2);
}));

test('reserved support identity cannot become a normal direct recipient or a group participant',()=>tx(async()=>{
 await denied(()=>direct('reserved-own-key','Own text','actor','cinegenius-support'),'22023');
 await denied(()=>group(['cinegenius-support']),'22023');
 const g=await group();await denied(()=>manage(g.conversationId,'add','cinegenius-support'),'22023');
 const legacy=(await rows("insert into conversations(sender_id,receiver_id,kind) values('actor','cinegenius-support','direct') returning id"))[0].id;
 await pg.query("insert into conversation_members(conversation_id,user_id) values($1,'actor'),($1,'cinegenius-support')",[legacy]);
 await denied(()=>send(legacy,'legacy-support-key'),'42501');
 assert.equal(await count('messages'),1);
}));

test('existing duplicate and empty legacy direct rows are retained without a merge or membership reset',()=>tx(async()=>{
 const ids=[];
 for(const created of ['2020-01-01','2021-01-01']){
  const id=(await rows("insert into conversations(sender_id,receiver_id,kind,created_at) values('actor','peer','direct',$1) returning id",[created]))[0].id;ids.push(id);
  await pg.query("insert into conversation_members(conversation_id,user_id,joined_at) values($1,'actor','2020-01-01'),($1,'peer','2020-01-01')",[id]);
 }
 const before=await rows('select * from conversation_members order by conversation_id,user_id');
 const sent=await direct();assert.equal(sent.conversationId,ids[0]);assert.equal(await count('conversations'),3);
 assert.deepEqual(await rows('select * from conversation_members order by conversation_id,user_id'),before);
 assert.equal((await rows('select count(*)::int n from messages where conversation_id=$1',[ids[1]]))[0].n,0);
}));

test('permission readers share bounded locks while contact, block and settings writers remain exclusive',async()=>{
 const pair=(await rows("select pg_get_functiondef('messaging_assert_pair(text,text,boolean,boolean)'::regprocedure) source"))[0].source;
 const block=(await rows("select pg_get_functiondef('set_member_block(text,text,boolean)'::regprocedure) source"))[0].source;
 assert.match(pair,/pg_try_advisory_xact_lock_shared\(hashtextextended\('contact:'/);
 assert.match(pair,/pg_try_advisory_xact_lock_shared\(hashtextextended\('messaging-settings:'/);
 assert.match(block,/pg_try_advisory_xact_lock\(hashtextextended\('contact:'/);
 for(const source of [pair,block]){assert.match(source,/least\(/);assert.match(source,/greatest\(/);}
 const trigger=(await rows("select pg_get_triggerdef(oid) definition from pg_trigger where tgname='messaging_settings_guard'"))[0].definition;
 assert.match(trigger,/BEFORE INSERT OR UPDATE OF message_permission, profile_visibility/);
});

for(const listingType of ['text','uuid']) test(`direct text sends reuse the correct general/listing chat with ${listingType} storage`,()=>tx(async()=>{
 if(listingType==='uuid') await pg.exec('alter table conversations alter column listing_id type uuid using listing_id::uuid');
 const firstId='30000000-0000-4000-8000-000000000001',secondId='30000000-0000-4000-8000-000000000002';
 const listed=(listing,key,actor='actor',recipient='peer')=>scalar('select start_direct_conversation($1,$2,$3,$4,$5::uuid) result',[actor,recipient,'Own listing inquiry',key,listing]);
 const general=await direct(),first=await listed(firstId,'first-listing-key'),replay=await listed(firstId,'first-listing-key'),reverse=await listed(firstId,'reply-listing-key','peer','actor'),second=await listed(secondId,'second-listing-key');
 assert.equal(first.created,true);assert.equal(replay.created,false);assert.equal(replay.message.id,first.message.id);assert.equal(reverse.conversationId,first.conversationId);
 assert.notEqual(general.conversationId,first.conversationId);assert.notEqual(second.conversationId,first.conversationId);
 assert.equal((await rows('select listing_id from conversations where id=$1',[first.conversationId]))[0].listing_id,firstId);
 assert.equal((await send(first.conversationId)).conversationId,first.conversationId);
 assert.equal(await count('conversations'),4);assert.equal(await count('messages'),6);
}));
