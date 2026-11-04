import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { organizationTestBootstrap } from './test-fixtures/organization-database.mjs';
let pg;
before(async () => {
  pg = new PGlite();
  await pg.exec(organizationTestBootstrap);
  await pg.exec(readFileSync(new URL('../supabase/migrations/20261103170000_organizations_and_news.sql', import.meta.url), 'utf8'));
});
after(async () => pg?.close());
async function tx(fn) { await pg.exec('begin'); try { await fn(); } finally { await pg.exec('rollback'); } }
async function org() {
 return (await pg.query(`insert into organizations(owner_user_id,last_actor_user_id,responsible_user_id,slug,name) values('owner','owner','contact','test-organization','Own test organization') returning *`)).rows[0];
}
async function entry(id) { return (await pg.query(`insert into organization_entries(organization_id,author_user_id,last_actor_user_id,slug,entry_type,title) values($1,'owner','owner','test-event','event','Own test event') returning *`,[id])).rows[0]; }
async function canRead(key, viewer = null) { return (await pg.query('select * from readable_media_asset($1,$2)',[key,viewer])).rows.length > 0; }

test('organization creation atomically records owner membership and private draft history', () => tx(async () => {
 const item = await org(); assert.equal(item.moderation_status,'draft');
 assert.deepEqual((await pg.query('select user_id,role,status from organization_members')).rows,[{user_id:'owner',role:'owner',status:'active'}]);
 const event=(await pg.query('select action,actor_user_id,revision_at from organization_moderation_events')).rows[0];
 assert.equal(event.action,'draft'); assert.equal(event.actor_user_id,'owner'); assert.equal(event.revision_at.getTime(),item.updated_at.getTime());
 assert.equal((await pg.query('select count(*)::int n from profiles')).rows[0].n,0);
 assert.equal((await pg.query('select count(*)::int n from companies')).rows[0].n,0);
}));
test('client database privileges cannot publish or read private organization records', () => tx(async () => {
 await org();
 for (const role of ['anon','authenticated']) for (const table of ['organizations','organization_members','organization_entries','organization_moderation_events']) {
  for (const privilege of ['SELECT','INSERT','UPDATE','DELETE']) assert.equal((await pg.query('select has_table_privilege($1,$2,$3) allowed',[role,table,privilege])).rows[0].allowed,false);
  await pg.exec('savepoint attempt; set local role '+role);
  await assert.rejects(()=>pg.exec(`select * from ${table}`),{code:'42501'});
  await pg.exec('rollback to savepoint attempt');
 }
}));
test('stale reviewed revision cannot approve newer content and every update has history', () => tx(async () => {
 const item=await org();
 const edited=(await pg.query("update organizations set description='Own edited draft',last_actor_user_id='owner' where id=$1 returning *",[item.id])).rows[0];
 assert.notEqual(edited.updated_at,item.updated_at);
 const stale=await pg.query("update organizations set moderation_status='approved',last_actor_user_id='admin' where id=$1 and updated_at=$2 returning id",[item.id,item.updated_at]);
 assert.equal(stale.rows.length,0);
 const approved=await pg.query("update organizations set moderation_status='approved',last_actor_user_id='admin' where id=$1 and updated_at=$2 returning id",[item.id,edited.updated_at]);
 assert.equal(approved.rows.length,1);
 assert.equal((await pg.query('select count(*)::int n from organization_moderation_events')).rows[0].n,3);
}));
test('entry approval needs approved parent and audit failure rolls back approval', () => tx(async () => {
 const parent=await org(); const child=await entry(parent.id);
 await pg.exec('savepoint attempt');
 await assert.rejects(()=>pg.query("update organization_entries set moderation_status='approved',last_actor_user_id='admin' where id=$1",[child.id]),/organization_parent_not_approved/);
 await pg.exec('rollback to savepoint attempt');
 await pg.query("update organizations set moderation_status='approved',last_actor_user_id='admin' where id=$1",[parent.id]);
 await pg.exec('alter table organization_moderation_events add constraint own_audit_failure check(false) not valid; savepoint audit');
 await assert.rejects(()=>pg.query("update organization_entries set moderation_status='approved',last_actor_user_id='admin' where id=$1",[child.id]));
 await pg.exec('rollback to savepoint audit');
 assert.equal((await pg.query('select moderation_status from organization_entries where id=$1',[child.id])).rows[0].moderation_status,'draft');
}));
test('private media follows parent approval, replacement and membership revocation', () => tx(async () => {
 const parent=await org(); const child=await entry(parent.id);
 await pg.query("insert into media_assets values('own-logo','/api/media/own-logo','owner',null,null,'image/webp'),('own-photo','/api/media/own-photo','owner',null,null,'image/webp')");
 await pg.query("update organizations set logo_url='/api/media/own-logo' where id=$1",[parent.id]);
 await pg.query("update organization_entries set image_url='/api/media/own-photo' where id=$1",[child.id]);
 assert.equal(await canRead('own-logo'),false); assert.equal(await canRead('own-logo','owner'),true);
 assert.equal(await canRead('own-logo','contact'),false); assert.equal(await canRead('own-photo','stranger'),false);
 await pg.query("insert into organization_members(organization_id,user_id,role) values($1,'delegate','admin')",[parent.id]);
 assert.equal(await canRead('own-photo','delegate'),true);
 await pg.query("update organization_members set status='ended' where user_id='delegate'");
 assert.equal(await canRead('own-photo','delegate'),false);
 await pg.query("update organizations set moderation_status='approved',last_actor_user_id='admin' where id=$1",[parent.id]);
 assert.equal(await canRead('own-logo'),true); assert.equal(await canRead('own-photo'),false);
 await pg.query("update organization_entries set moderation_status='approved',last_actor_user_id='admin' where id=$1",[child.id]);
 assert.equal(await canRead('own-photo'),true);
 await pg.query("update organizations set moderation_status='hidden',last_actor_user_id='admin' where id=$1",[parent.id]);
 assert.equal(await canRead('own-photo'),false); assert.equal(await canRead('own-logo'),false);
 await pg.query("update organization_entries set image_url=null,moderation_status='submitted',last_actor_user_id='owner' where id=$1",[child.id]);
 assert.equal(await canRead('own-photo','owner'),false);
}));

test('ended events require prior approval and still obey parent visibility', () => tx(async () => {
 const parent=await org(); const child=await entry(parent.id);
 await pg.query("update organizations set moderation_status='approved',last_actor_user_id='admin' where id=$1",[parent.id]);
 await pg.exec('savepoint attempt');
 await assert.rejects(()=>pg.query("update organization_entries set moderation_status='ended',last_actor_user_id='admin' where id=$1",[child.id]),/organization_entry_not_approved/);
 await pg.exec('rollback to savepoint attempt');
 await pg.query("insert into media_assets values('ended-photo','/api/media/ended-photo','owner',null,null,'image/webp')");
 await pg.query("update organization_entries set image_url='/api/media/ended-photo',moderation_status='approved',last_actor_user_id='admin' where id=$1",[child.id]);
 await pg.query("update organization_entries set moderation_status='ended',last_actor_user_id='admin' where id=$1",[child.id]);
 assert.equal(await canRead('ended-photo'),true);
 await pg.query("update organizations set moderation_status='hidden',last_actor_user_id='admin' where id=$1",[parent.id]);
 assert.equal(await canRead('ended-photo'),false);
 await pg.exec('savepoint hidden');
 await assert.rejects(()=>pg.query("update organization_entries set moderation_status='ended',last_actor_user_id='admin' where id=$1",[child.id]),/organization_parent_not_approved/);
 await pg.exec('rollback to savepoint hidden');
 await pg.query("update organization_entries set title='Changed event',moderation_status='submitted',last_actor_user_id='owner' where id=$1",[child.id]);
 assert.equal(await canRead('ended-photo'),false);
}));
