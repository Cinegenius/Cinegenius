import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
let pg;
before(async () => {
  pg = new PGlite();
  await pg.exec(`create role anon;create role authenticated;create role service_role;
    create table profiles(user_id text primary key, display_name text);
    create table conversations(id uuid primary key default gen_random_uuid(), sender_id text, receiver_id text not null, listing_id uuid, listing_title text, listing_type text, created_at timestamptz default now(), updated_at timestamptz default now());
    create table messages(id uuid primary key default gen_random_uuid(),conversation_id uuid references conversations(id),sender_id text,content text,created_at timestamptz default now(),read_at timestamptz);
    insert into profiles values('member-test','Testmitglied');`);
  for (const name of ['message_read_receipts.sql','20261024120000_admin_support_messaging.sql','20261024170000_fix_support_conversation_conflict.sql']) await pg.exec(readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
});
after(async()=>{await pg?.close()});

test('support → member reply → support reply stays in one persisted, audited conversation', async()=>{
  const args=['admin-test','member-test','profile','member-test','Testprofil','/profile-setup','Hallo vom Support','first-test-key'];
  const start=async()=> (await pg.query('select * from create_support_conversation($1,$2,$3,$4,$5,$6,$7,$8)',args)).rows[0];
  const first=await start();assert.equal(first.created,true);
  const duplicate=await start();assert.equal(duplicate.conversation_id,first.conversation_id);assert.equal(duplicate.message_id,first.message_id);assert.equal(duplicate.created,false);
  const id=first.conversation_id;
  await pg.query('select * from send_conversation_message($1,$2,$3)',[id,'member-test','Meine Antwort']);
  const send=async()=>(await pg.query('select * from send_support_message($1,$2,$3,$4)',[id,'second-admin','Supportantwort','reply-test-key'])).rows[0];
  assert.equal((await send()).created,true);assert.equal((await send()).created,false);
  const rows=(await pg.query('select sender_id,content from messages where conversation_id=$1 order by created_at,id',[id])).rows;
  assert.deepEqual(rows.map(r=>r.content),['Hallo vom Support','Meine Antwort','Supportantwort']);
  assert.deepEqual(rows.map(r=>r.sender_id),['cinegenius-support','member-test','cinegenius-support']);
  const audits=(await pg.query('select actor_user_id from support_message_sends order by created_at')).rows;
  assert.deepEqual(audits.map(r=>r.actor_user_id),['admin-test','second-admin']);
  assert.equal((await pg.query('select count(*)::int n from conversations')).rows[0].n,1);
  const unread=async user=>(await pg.query('select * from unread_message_counts($1)',[user])).rows.reduce((n,r)=>n+Number(r.unread_count),0);
  assert.equal(await unread('member-test'),2);assert.equal(await unread('cinegenius-support'),1);
  await pg.query('insert into message_reads(message_id,user_id) select id,$1 from messages where conversation_id=$2 and sender_id<>$1 on conflict do nothing',['member-test',id]);
  await pg.query('insert into message_reads(message_id,user_id) select id,$1 from messages where conversation_id=$2 and sender_id<>$1 on conflict do nothing',['cinegenius-support',id]);
  assert.equal(await unread('member-test'),0);assert.equal(await unread('cinegenius-support'),0);
  assert.equal(await unread('member-test'),0); // fresh query, no client counter reset
  await assert.rejects(pg.query('select * from send_conversation_message($1,$2,$3)',[id,'stranger-test','Denied']), /aktives Mitglied/);
  for(const role of ['anon','authenticated']){
    await pg.exec(`set role ${role}`);
    await assert.rejects(send(), /permission denied/);
    await pg.exec('reset role');
  }
});
