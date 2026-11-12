import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

let pg;
const migration = '20261112190000_member_support_contact.sql';
const key = '11111111-1111-4111-8111-111111111111';
before(async () => {
  pg = new PGlite();
  await pg.exec(`create role anon; create role authenticated; create role service_role;
    create table profiles(user_id text primary key, display_name text);
    create table conversations(id uuid primary key default gen_random_uuid(), sender_id text, receiver_id text not null, listing_id uuid, listing_title text, listing_type text, created_at timestamptz default now(), updated_at timestamptz default now());
    create table messages(id uuid primary key default gen_random_uuid(), conversation_id uuid references conversations(id), sender_id text, content text, created_at timestamptz default now(), read_at timestamptz);`);
  for (const file of ['message_read_receipts.sql', '20261024120000_admin_support_messaging.sql', '20261024170000_fix_support_conversation_conflict.sql', migration]) {
    await pg.exec(readFileSync(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
  }
});
after(async () => pg?.close());
const contact = async (user = 'account-only', content = 'Eigene Testanfrage', requestKey = key) =>
  (await pg.query('select * from contact_support($1,$2,$3,$4)', [user, content, requestKey, 'Supportanfrage'])).rows[0];

test('account-only member starts support, support receives unread, and admins can answer in the same thread', async () => {
  await pg.exec('begin');
  try {
    const first = await contact();
    assert.equal(first.created, true);
    const thread = (await pg.query('select * from conversations where id=$1', [first.conversation_id])).rows[0];
    assert.equal(thread.sender_id, 'cinegenius-support'); assert.equal(thread.receiver_id, 'account-only');
    assert.equal(thread.support_user_id, 'account-only'); assert.equal(thread.member_support_contact, true);
    assert.equal(thread.support_edit_url, '/messages?conv=' + first.conversation_id);
    assert.equal((await pg.query('select * from profiles')).rows.length, 0);
    assert.equal((await pg.query('select * from unread_message_counts($1)', ['cinegenius-support'])).rows[0].unread_count, 1);
    assert.equal((await pg.query('select * from unread_message_counts($1)', ['account-only'])).rows.length, 0);
    await pg.query('select * from send_support_message($1,$2,$3,$4)', [first.conversation_id, 'verified-admin', 'Eigene Testantwort', 'admin-answer']);
    assert.equal((await pg.query('select * from unread_message_counts($1)', ['account-only'])).rows[0].unread_count, 1);
    assert.deepEqual((await pg.query('select sender_id from messages where conversation_id=$1 order by created_at,id', [first.conversation_id])).rows.map(row => row.sender_id).sort(), ['account-only', 'cinegenius-support']);
  } finally { await pg.exec('rollback'); }
});

test('lost acknowledgement retry and new requests reuse one conversation without duplicate messages', async () => {
  await pg.exec('begin');
  try {
    const first = await contact(); const replay = await contact();
    assert.equal(replay.created, false); assert.equal(replay.conversation_id, first.conversation_id); assert.equal(replay.message_id, first.message_id);
    const next = await contact('account-only', 'Weitere eigene Testanfrage', '22222222-2222-4222-8222-222222222222');
    assert.equal(next.conversation_id, first.conversation_id); assert.equal(next.created, true);
    assert.equal((await pg.query('select count(*)::int n from conversations')).rows[0].n, 1);
    assert.equal((await pg.query('select count(*)::int n from messages')).rows[0].n, 2);
    const other = await contact('different-account');
    assert.notEqual(other.conversation_id, first.conversation_id);
  } finally { await pg.exec('rollback'); }
});

test('one request key cannot silently acknowledge different text and the migration can be safely repeated', async () => {
  await pg.exec('begin');
  try {
    const first = await contact();
    await pg.query('insert into message_reads(message_id,user_id) values($1,$2)', [first.message_id, 'cinegenius-support']);
    const receipt = (await pg.query('select read_at from message_reads where message_id=$1 and user_id=$2', [first.message_id, 'cinegenius-support'])).rows[0];
    await pg.exec(readFileSync(new URL('../supabase/migrations/' + migration, import.meta.url), 'utf8'));
    const replay = await contact(); assert.equal(replay.message_id, first.message_id);
    assert.deepEqual((await pg.query('select read_at from message_reads where message_id=$1 and user_id=$2', [first.message_id, 'cinegenius-support'])).rows[0], receipt);
    assert.equal((await pg.query('select count(*)::int n from messages where conversation_id=$1', [first.conversation_id])).rows[0].n, 1);
    await assert.rejects(() => contact('account-only', 'Different text'), error => error.code === 'PT409');
  } finally { await pg.exec('rollback'); }
});

test('anonymous and authenticated database roles cannot impersonate members or inspect contact sends', async () => {
  for (const role of ['anon', 'authenticated']) {
    await pg.exec('begin');
    try {
      await pg.exec(`set local role ${role}`);
      await assert.rejects(() => contact('another-member'), error => error.code === '42501');
    } finally { await pg.exec('rollback'); }
    await pg.exec('begin');
    try {
      await pg.exec(`set local role ${role}`);
      await assert.rejects(() => pg.query('select * from support_contact_sends'), error => error.code === '42501');
    } finally { await pg.exec('rollback'); }
  }
});

test('migration preflight keeps the contact RPC service-only and callable without public table grants', async () => {
  const grants = (await pg.query(`select
    has_function_privilege('anon', 'public.contact_support(text,text,uuid,text)', 'execute') anon_execute,
    has_function_privilege('authenticated', 'public.contact_support(text,text,uuid,text)', 'execute') member_execute,
    has_function_privilege('service_role', 'public.contact_support(text,text,uuid,text)', 'execute') service_execute,
    has_table_privilege('anon', 'public.support_contact_sends', 'select') anon_select,
    has_table_privilege('authenticated', 'public.support_contact_sends', 'select') member_select,
    (select relrowsecurity from pg_class where oid = 'public.support_contact_sends'::regclass) protected;`)).rows[0];
  assert.deepEqual(grants, { anon_execute: false, member_execute: false, service_execute: true, anon_select: false, member_select: false, protected: true });
  await pg.exec('begin');
  try {
    await pg.exec('set local role service_role');
    const result = await contact('service-account-only');
    assert.equal(result.created, true);
    await pg.exec('reset role');
    assert.equal((await pg.query('select count(*)::int n from messages where conversation_id=$1', [result.conversation_id])).rows[0].n, 1);
  } finally { await pg.exec('rollback'); }
});

test('reserved identity, empty messages and oversized messages never create a support thread', async () => {
  for (const [user, content] of [['cinegenius-support', 'Test'], ['', 'Test'], ['account-only', '  '], ['account-only', 'x'.repeat(5001)]]) {
    await pg.exec('begin');
    try { await assert.rejects(() => contact(user, content), error => error.code === '22023'); }
    finally { await pg.exec('rollback'); }
  }
  assert.equal((await pg.query('select count(*)::int n from conversations')).rows[0].n, 0);
});
