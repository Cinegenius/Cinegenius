import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('the real protected-media permission function follows admin approval, revision and withdrawal through every mirror',async()=>{
 const pg=new PGlite();
 try {
  const source=readFileSync(new URL('./community-media-team-db.test.mjs',import.meta.url),'utf8');
  const schema=source.split('await pg.exec(`')[1].split('`);')[0].replaceAll('${company}','10000000-0000-4000-8000-000000000001').replaceAll('${company2}','10000000-0000-4000-8000-000000000002');
  await pg.exec(schema);
  await pg.exec(`alter table storage.buckets add name text,add file_size_limit bigint,add allowed_mime_types text[];
   alter table project_drafts add user_id text,add published_project_id uuid;
   create table friendships(sender_id text,receiver_id text,status text);create table blocks(blocker_id text,blocked_id text);
   create table admin_audit_log(actor_user_id text,action text,entity_type text,entity_id text,reason text,outcome text,metadata jsonb);`);
  for(const name of ['20261024190000_public_community_media.sql','20261025150000_profile_company_discovery_only.sql','20261025151000_bound_discovery_query.sql','20261027180000_protected_media.sql','20261028200000_offer_moderation.sql'])await pg.exec(readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  const key='owner/'+'e'.repeat(32)+'.webp',url='/api/media/'+key,id='30000000-0000-4000-8000-000000000001';
  await pg.query("insert into media_assets(storage_path,reference_url,owner_user_id,mime_type) values($1,$2,'owner','image/webp')",[key,url]);
  await pg.query("insert into listings(id,type,title,user_id,image_url,last_editor_id) values($1,'location','Own studio','owner',$2,'owner')",[id,url]);
  const allowed=async viewer=>(await pg.query('select * from readable_media_asset($1,$2)',[key,viewer??null])).rows.length===1;
  const transition=async action=>{const row=(await pg.query('select to_jsonb(l) r from listings l where id=$1',[id])).rows[0].r,profile=(await pg.query("select to_jsonb(p) r from profiles p where user_id='owner'")).rows[0].r;return(await pg.query("select offer_review_transition('listing',$1,$2,null,$3,$4,$5,$6,null) result",[id,row,profile,action,action==='submit'?'owner':'own-admin','Own controlled review'])).rows[0].result;};
  assert.equal(await allowed(),false);assert.equal(await allowed('other'),false);assert.equal(await allowed('owner'),true);
  await pg.query("update profiles set avatar_url=$1 where user_id='other'",[url]);assert.equal(await allowed(),false,'a public profile mirror cannot release a pending listing file');
  assert.equal(await transition('submit'),'saved');assert.equal(await allowed(),false);
  assert.equal(await transition('approve'),'saved');assert.equal(await allowed(),true);
  await pg.query("update listings set title='Own revised studio',last_editor_id='owner' where id=$1",[id]);
  assert.equal(await allowed(),false,'old original/thumbnail URLs immediately recheck the now-pending parent');assert.equal(await allowed('owner'),true);assert.equal(await allowed('other'),false);
  assert.equal(await transition('approve'),'saved');assert.equal(await allowed(),true);
  assert.equal(await transition('hide'),'saved');assert.equal(await allowed(),false);
 } finally {await pg.close();}
});
