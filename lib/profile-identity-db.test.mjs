import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('pronoun migration preserves existing profiles and constrains new optional data', async () => {
 const pg=new PGlite();
 try {
  await pg.exec("create table public.profiles(user_id text primary key, display_name text); insert into public.profiles values ('existing','Existing member');");
  await pg.exec(readFileSync(new URL('../supabase/migrations/20261116223941_profile_pronouns.sql',import.meta.url),'utf8'));
  assert.deepEqual((await pg.query('select * from profiles')).rows,[{user_id:'existing',display_name:'Existing member',pronouns:null,show_pronouns:false}]);
  await pg.query('update profiles set pronouns=$1, show_pronouns=true where user_id=$2',['they/them','existing']);
  assert.equal((await pg.query('select pronouns from profiles')).rows[0].pronouns,'they/them');
  for(const value of ['x'.repeat(61),'<script>','a\nb']) await assert.rejects(pg.query('update profiles set pronouns=$1',[value]));
  await pg.exec('update profiles set pronouns=null, show_pronouns=false');
  assert.equal((await pg.query('select count(*)::integer as count from profiles')).rows[0].count,1);
 } finally {await pg.close();}
});
