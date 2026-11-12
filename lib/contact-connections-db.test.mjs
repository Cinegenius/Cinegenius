import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
let pg;
const migration=readFileSync(new URL('../supabase/migrations/20261112210000_atomic_contacts.sql',import.meta.url),'utf8');
const notification={title:'Own test title',body:'Own test body',localization:{version:1}};
before(async()=>{pg=new PGlite();await pg.exec(`create role anon;create role authenticated;create role service_role;
 create table profiles(user_id text primary key);insert into profiles values('alice'),('bob'),('charlie');
 create table blocks(id uuid default gen_random_uuid(),blocker_id text,blocked_id text);
 create table friendships(id uuid primary key default gen_random_uuid(),sender_id text,receiver_id text,status text check(status in('pending','accepted','rejected')),created_at timestamptz default now(),updated_at timestamptz default now(),sender_collab_label text,receiver_collab_label text,sender_collab_public boolean default false,receiver_collab_public boolean default false);
 create table notifications(id uuid primary key default gen_random_uuid(),user_id text,type text,title text,body text,href text,localization jsonb);`);await pg.exec(migration);});
after(async()=>pg?.close());
const mutate=async(actor,action,{target=null,id=null,label=null,isPublic=false,copy=notification}={})=>(await pg.query('select contact_connection($1,$2,$3,$4,$5,$6,$7) result',[actor,action,target,id,label,isPublic,copy])).rows[0].result;
const count=async(table)=>(await pg.query('select count(*)::int n from '+table)).rows[0].n;
const transaction=async work=>{await pg.exec('begin');try{await work();}finally{await pg.exec('rollback');}};
test('concurrent-direction retries reuse one pending edge and require explicit mutual acceptance',()=>transaction(async()=>{
 const first=await mutate('alice','request',{target:'bob'});assert.equal(first.changed,true);assert.equal(first.friendship.status,'pending');
 const repeat=await mutate('alice','request',{target:'bob'}),reverse=await mutate('bob','request',{target:'alice'});
 assert.equal(repeat.changed,false);assert.equal(reverse.changed,false);assert.equal(reverse.friendship.id,first.friendship.id);assert.equal(reverse.friendship.sender_id,'alice');
 assert.equal(await count('friendships'),1);assert.equal(await count('notifications'),1);
 assert.equal((await mutate('alice','accepted',{id:first.friendship.id})).status,'forbidden');
 const accepted=await mutate('bob','accepted',{id:first.friendship.id});assert.equal(accepted.changed,true);assert.equal(accepted.friendship.status,'accepted');
 assert.equal((await mutate('bob','accepted',{id:first.friendship.id})).changed,false);
 assert.equal((await mutate('alice','request',{target:'bob'})).changed,false);assert.equal(await count('notifications'),2);
 assert.equal((await pg.query("select href from notifications where type='friend_request'")).rows[0].href,'/messages?requests=1');
}));
test('both block directions forbid requests and acceptance while allowing refusal/removal',()=>transaction(async()=>{
 for(const [from,to] of [['alice','bob'],['bob','alice']]){
  const first=await mutate('alice','request',{target:'bob'});
  await pg.query('insert into blocks(blocker_id,blocked_id) values($1,$2)',[from,to]);
  assert.equal((await mutate('alice','request',{target:'bob'})).status,'blocked');
  assert.equal((await mutate('bob','accepted',{id:first.friendship.id})).status,'blocked');
  assert.equal((await mutate('bob','rejected',{id:first.friendship.id})).status,'saved');
  assert.equal((await mutate('bob','remove',{id:first.friendship.id})).status,'saved');
  await pg.exec('delete from blocks');
 }
}));
test('outsiders cannot change contacts or collaboration; each member only edits their own side',()=>transaction(async()=>{
 const request=await mutate('alice','request',{target:'bob'}),id=request.friendship.id;
 for(const action of ['accepted','rejected','remove','collab'])assert.equal((await mutate('charlie',action,{id,label:'Stolen',isPublic:true})).status,'forbidden');
 assert.equal((await mutate('alice','collab',{id,label:'Too early',isPublic:true})).status,'stale');
 await mutate('bob','accepted',{id});
 await mutate('alice','collab',{id,label:'Own label',isPublic:true});
 const other=await mutate('bob','collab',{id,label:'Other label',isPublic:false});
 assert.equal(other.friendship.sender_collab_label,'Own label');assert.equal(other.friendship.sender_collab_public,true);assert.equal(other.friendship.receiver_collab_label,'Other label');assert.equal(other.friendship.receiver_collab_public,false);
 assert.equal((await mutate('bob','rejected',{id})).status,'stale');
}));
test('notification persistence is part of the contact transaction and failure cannot leave a silent request',()=>transaction(async()=>{
 await pg.exec('savepoint invalid_copy');
 await assert.rejects(()=>mutate('alice','request',{target:'bob',copy:null}),error=>error.code==='22023');
 await pg.exec('rollback to savepoint invalid_copy');assert.equal(await count('friendships'),0);assert.equal(await count('notifications'),0);
 assert.equal((await mutate('alice','request',{target:'missing'})).status,'missing');
 assert.equal((await mutate('alice','request',{target:'alice'})).status,'invalid');
}));
test('legacy duplicate edges remain intact until explicit removal, which revokes every pair edge',()=>transaction(async()=>{
 await pg.exec("insert into friendships(sender_id,receiver_id,status,sender_collab_label,sender_collab_public) values('alice','bob','accepted','Original collaboration',true),('bob','alice','pending',null,false)");
 const result=await mutate('alice','request',{target:'bob'});assert.equal(result.changed,false);assert.equal(result.friendship.status,'accepted');assert.equal(await count('friendships'),2);assert.equal(await count('notifications'),0);
 await mutate('bob','remove',{id:result.friendship.id});assert.equal(await count('friendships'),0);
}));
test('service-only execution and direct table denial survive reapplying the migration without legacy changes',async()=>{
 const request=await mutate('alice','request',{target:'bob'});await mutate('bob','accepted',{id:request.friendship.id});await mutate('alice','collab',{id:request.friendship.id,label:'Original label',isPublic:true});
 const before=(await pg.query('select * from friendships order by id')).rows;const notifications=await count('notifications');await pg.exec(migration);
 assert.deepEqual((await pg.query('select * from friendships order by id')).rows,before);assert.equal(await count('notifications'),notifications);
 for(const role of ['anon','authenticated']){
  await pg.exec('begin');try{await pg.exec('set local role '+role);await assert.rejects(()=>mutate('alice','request',{target:'charlie'}),error=>error.code==='42501');}finally{await pg.exec('rollback');}
  await pg.exec('begin');try{await pg.exec('set local role '+role);await assert.rejects(()=>pg.query('select * from friendships'),error=>error.code==='42501');}finally{await pg.exec('rollback');}
 }
 await pg.exec('begin');try{await pg.exec('set local role service_role');assert.equal((await mutate('alice','request',{target:'charlie'})).status,'saved');}finally{await pg.exec('rollback');}
});
