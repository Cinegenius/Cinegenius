import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {fillSupportTemplate, validateSupportTemplateBody} from './support-message-templates.ts';
const original=readFileSync(new URL('../supabase/migrations/20261024120000_admin_support_messaging.sql',import.meta.url),'utf8');
const seed=original.slice(original.indexOf('insert into public.support_message_templates'),original.indexOf('create or replace function public.create_support_conversation'));
const sql=readFileSync(new URL('../supabase/migrations/20261123210028_english_admin_support_templates.sql',import.meta.url),'utf8');
async function database(t){
 const db=new PGlite();t.after(()=>db.close());
 await db.exec('create table support_message_templates(template_key text primary key,label text,body text,enabled boolean default true,updated_by text,updated_at timestamptz default now()); alter table support_message_templates enable row level security; create table messages(content text); insert into messages values (\'Vorhandene Nachricht\');');
 await db.exec(seed);return db;
}
test('English template migration preserves identities, switches, custom text, historical messages and RLS; repeated application is harmless',async t=>{
 const db=await database(t);
 await db.exec("update support_message_templates set enabled=false where template_key='crew_profile'; insert into support_message_templates(template_key,label,body) values ('custom','Custom','My own words');");
 const before=(await db.query('select template_key,label,enabled from support_message_templates order by template_key')).rows;
 await db.exec(sql);
 const rows=(await db.query('select * from support_message_templates order by template_key')).rows;
 assert.deepEqual(rows.map(({template_key,label,enabled})=>({template_key,label,enabled})),before);
 for(const row of rows.filter(x=>x.template_key!=='custom')){
  assert.match(row.body,/^Hello /);assert.equal(validateSupportTemplateBody(row.body),null);
  const filled=fillSupportTemplate(row.body,{firstName:null,editUrl:'/profile-setup',missingFields:['location'],listingTitle:'München',companyName:'Éclairage',targetLabel:'Own'},'https://example.invalid');
  assert.doesNotMatch(filled,/\{\{|undefined|Hello ,/);assert.match(filled,/^Hello,/);
 }
 assert.equal(rows.find(x=>x.template_key==='custom').body,'My own words');
 assert.deepEqual((await db.query('select content from messages')).rows,[{content:'Vorhandene Nachricht'}]);
 assert.equal((await db.query("select relrowsecurity from pg_class where oid='support_message_templates'::regclass")).rows[0].relrowsecurity,true);
 await db.exec(sql);assert.deepEqual((await db.query('select * from support_message_templates order by template_key')).rows,rows);
});
test('template migration aborts atomically on a concurrent custom edit and never resurrects deleted templates',async t=>{
 const db=await database(t);
 await db.exec("update support_message_templates set body='An edited template' where template_key='check_in';");
 const before=(await db.query('select * from support_message_templates order by template_key')).rows;
 await assert.rejects(db.exec(sql),/changed; review before translating/);
 assert.deepEqual((await db.query('select * from support_message_templates order by template_key')).rows,before);
 await db.exec("delete from support_message_templates where template_key='check_in';");await db.exec(sql);
 assert.equal((await db.query('select count(*)::int as count from support_message_templates')).rows[0].count,6);
});
