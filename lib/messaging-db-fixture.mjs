import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
export async function createMessagingDb(){
 const pg=new PGlite();
 await pg.exec(`create role anon;create role authenticated;create role service_role;
 create table profiles(user_id text primary key,display_name text);
 create table user_settings(user_id text primary key,message_permission text default 'everyone',profile_visibility text default 'public');
 create table friendships(id uuid primary key default gen_random_uuid(),sender_id text,receiver_id text,status text);
 create table blocks(blocker_id text,blocked_id text);
 create table companies(id uuid primary key default gen_random_uuid(),owner_user_id text,published boolean,slug text,name text);
 create table listings(id uuid primary key default gen_random_uuid(),user_id text,company_id uuid,published boolean,responsible_person jsonb);
 create table conversations(id uuid primary key default gen_random_uuid(),sender_id text,receiver_id text not null,listing_id uuid,listing_title text,listing_type text,created_at timestamptz default now(),updated_at timestamptz default now());
 create table messages(id uuid primary key default gen_random_uuid(),conversation_id uuid references conversations(id),sender_id text,content text,read_at timestamptz,created_at timestamptz default now());
 insert into profiles select name,name from unnest(array['actor','peer','other','third','legacy-a','legacy-b']) name;
 insert into profiles select 'member-'||n,'Own member '||n from generate_series(1,55) n;
 insert into conversations(id,sender_id,receiver_id,created_at) values('10000000-0000-4000-8000-000000000001','legacy-a','legacy-b','2026-01-01');
 insert into messages(id,conversation_id,sender_id,content,read_at,created_at) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','legacy-a','Own preserved legacy message','2026-01-03','2026-01-02');`);
 for(const file of ['message_read_receipts.sql','20261024120000_admin_support_messaging.sql','20261024170000_fix_support_conversation_conflict.sql','20261025110000_hide_own_messages.sql','20261028180000_private_form_drafts.sql','20261030150000_nonblocking_private_form_drafts.sql','20261112213000_messaging_atomic_sends.sql']) await pg.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 return pg;
}
