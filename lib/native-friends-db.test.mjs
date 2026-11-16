import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
let pg;
const source=name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const migration=source('20261116130826_native_friend_favorites_v1.sql');
const copy={title:'Fixture title',body:'Fixture body',localization:{version:1}};
before(async()=>{pg=new PGlite();await pg.exec(`
 create role anon; create role authenticated; create role service_role;
 create table profiles(user_id text primary key); insert into profiles values('alice'),('bob'),('charlie');
 create table blocks(id uuid default gen_random_uuid(),blocker_id text,blocked_id text);
 create table friendships(id uuid primary key default gen_random_uuid(),sender_id text,receiver_id text,status text check(status in('pending','accepted','rejected')),created_at timestamptz default now(),updated_at timestamptz default now(),sender_collab_label text,receiver_collab_label text,sender_collab_public boolean default false,receiver_collab_public boolean default false);
 create table notifications(id uuid primary key default gen_random_uuid(),user_id text,type text,title text,body text,href text,localization jsonb);`);
 await pg.exec(source('20261112210000_atomic_contacts.sql'));await pg.exec(migration);
});
after(async()=>pg?.close());
const tx=async run=>{await pg.exec('begin');try{await run();}finally{await pg.exec('rollback');}};
const contact=async(actor,action,id=null,target=null)=>(await pg.query('select contact_connection($1,$2,$3,$4,null,false,$5) r',[actor,action,target,id,copy])).rows[0].r;
const save=async(actor,id,state)=>(await pg.query('select set_contact_favorite_v1($1,$2,$3) r',[actor,id,state])).rows[0].r;
const read=async actor=>(await pg.query('select contact_favorites_v1($1) r',[actor])).rows[0].r;
const accepted=async()=>{const r=await contact('alice','request',null,'bob');await contact('bob','accepted',r.friendship.id);return r.friendship.id;};
test('own favorites stay private, explicit desired-state replay is idempotent and no notifications are generated',()=>tx(async()=>{
 const id=await accepted(),before=(await pg.query('select * from notifications')).rows;
 assert.equal((await save('alice',id,true)).changed,true);assert.equal((await save('alice',id,true)).changed,false);
 assert.deepEqual((await read('alice')).favorites,[{friendship_id:id,is_favorite:true}]);assert.deepEqual((await read('bob')).favorites,[{friendship_id:id,is_favorite:false}]);assert.deepEqual((await read('charlie')).favorites,[]);
 await save('bob',id,true);await save('alice',id,false);assert.equal((await read('alice')).favorites[0].is_favorite,false);assert.equal((await read('bob')).favorites[0].is_favorite,true);
 assert.deepEqual((await pg.query('select * from notifications')).rows,before);
}));
test('foreign, missing, pending and blocked relationships cannot be favorited',()=>tx(async()=>{
 const pending=await contact('alice','request',null,'bob'),id=pending.friendship.id;
 assert.equal((await save('alice',id,true)).status,'missing');await contact('bob','accepted',id);
 assert.equal((await save('charlie',id,true)).status,'missing');assert.equal((await save('alice','00000000-0000-4000-8000-000000000000',true)).status,'missing');
 assert.equal((await save('alice',id,null)).status,'invalid');
 for(const pair of [['alice','bob'],['bob','alice']]){
  await pg.query('insert into blocks(blocker_id,blocked_id) values($1,$2)',pair);assert.equal((await save('alice',id,true)).status,'blocked');assert.deepEqual((await read('alice')).favorites,[]);await pg.exec('delete from blocks');
 }
}));
test('accepted legacy duplicates share one own favorite without changing collaboration or peer flags',()=>tx(async()=>{
 const id=await accepted();const other=(await pg.query("insert into friendships(sender_id,receiver_id,status,sender_collab_label,sender_collab_public) values('bob','alice','accepted','Original collaboration',true) returning id")).rows[0].id;
 await save('alice',id,true);assert.ok((await read('alice')).favorites.every(f=>f.is_favorite));assert.ok((await read('bob')).favorites.every(f=>!f.is_favorite));
 const edge=(await pg.query('select * from friendships where id=$1',[other])).rows[0];assert.equal(edge.sender_collab_label,'Original collaboration');assert.equal(edge.sender_collab_public,true);assert.equal(edge.sender_favorite,false);assert.equal(edge.receiver_favorite,true);
 assert.equal((await save('alice',other,true)).changed,false);
 await pg.query("update friendships set receiver_collab_label='Own collaboration' where id=$1",[other]);assert.ok((await read('alice')).favorites.every(f=>f.is_favorite));
 await contact('bob','remove',id);assert.deepEqual((await read('alice')).favorites,[]);
 const newId=await accepted();assert.notEqual(newId,id);assert.equal((await read('alice')).favorites[0].is_favorite,false);
}));
test('reused edges and changed members never inherit private preferences; same-status edits preserve them',()=>tx(async()=>{
 const id=await accepted();await save('alice',id,true);await save('bob',id,true);
 await pg.query("update friendships set status='rejected' where id=$1",[id]);let row=(await pg.query('select * from friendships where id=$1',[id])).rows[0];assert.equal(row.sender_favorite,false);assert.equal(row.receiver_favorite,false);
 await pg.query("update friendships set status='accepted' where id=$1",[id]);await save('alice',id,true);await pg.query("update friendships set receiver_id='charlie' where id=$1",[id]);row=(await pg.query('select * from friendships where id=$1',[id])).rows[0];assert.equal(row.sender_favorite,false);assert.equal(row.receiver_favorite,false);
}));
test('applying migration again preserves saved values; only the service role can read or change favorites',async()=>{
 const id=await accepted();await save('alice',id,true);const before=(await pg.query('select * from friendships')).rows;await pg.exec(migration);assert.deepEqual((await pg.query('select * from friendships')).rows,before);
 for(const role of ['anon','authenticated'])for(const query of ['select contact_favorites_v1(\'alice\')',`select set_contact_favorite_v1('alice','${id}',false)`,'select sender_favorite from friendships']){
  await pg.exec('begin');try{await pg.exec('set local role '+role);await assert.rejects(()=>pg.query(query),e=>e.code==='42501');}finally{await pg.exec('rollback');}
 }
 // Production service_role already has BYPASSRLS. Reproduce it in the isolated test database.
 await pg.exec('alter role service_role bypassrls; grant select on blocks to service_role');
 await tx(async()=>{await pg.exec('set local role service_role');assert.equal((await read('alice')).writable,true);assert.equal((await save('alice',id,false)).status,'saved');});
});
