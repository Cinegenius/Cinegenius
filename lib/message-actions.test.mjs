import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {findContactConversation,mergeVisibleMessagePage} from './message-actions.ts';
let pg;
const chat='20000000-0000-4000-8000-000000000001';
const otherChat='20000000-0000-4000-8000-000000000002';
const own='30000000-0000-4000-8000-000000000001';
const received='30000000-0000-4000-8000-000000000002';
before(async()=>{
 pg=new PGlite();
 await pg.exec(`create role anon;create role authenticated;create role service_role;
 create table conversations(id uuid primary key);
 create table conversation_members(conversation_id uuid,user_id text,joined_at timestamptz,left_at timestamptz);
 create table messages(id uuid primary key,conversation_id uuid,sender_id text,content text,created_at timestamptz);
 insert into conversations values('${chat}'),('${otherChat}');
 insert into conversation_members values('${chat}','me','2026-10-01',null),('${chat}','friend','2026-10-01',null),('${chat}','left','2026-10-01','2026-10-02'),('${otherChat}','me','2026-10-01',null);
 insert into messages values('${own}','${chat}','me','My original message','2026-10-03'),('${received}','${chat}','friend','Friend original message','2026-10-03');`);
 await pg.exec(readFileSync(new URL('../supabase/migrations/20261025110000_hide_own_messages.sql',import.meta.url),'utf8'));
});
after(async()=>{await pg?.close();});
async function tx(fn){await pg.exec('begin');try{await fn();}finally{await pg.exec('rollback');}}
async function hide(actor='me',message=own,conversation=chat){return (await pg.query('select hide_own_conversation_message($1,$2,$3) id',[actor,conversation,message])).rows[0].id;}
async function denied(fn){await pg.exec('savepoint denied');try{await fn();assert.fail('Expected access denial');}catch(error){await pg.exec('rollback to savepoint denied');assert.equal(error.code,'42501');}}

test('own deletion is idempotent, stored, and keeps the original for recipients',()=>tx(async()=>{
 assert.equal(await hide(),own);
 const first=(await pg.query('select * from messages where id=$1',[own])).rows[0];
 assert.ok(first.hidden_for_sender_at);assert.equal(first.content,'My original message');
 await hide();assert.deepEqual((await pg.query('select * from messages where id=$1',[own])).rows[0],first);
 const visible=async(user)=>(await pg.query('select id from messages where conversation_id=$1 and (sender_id<>$2 or hidden_for_sender_at is null)',[chat,user])).rows.map(m=>m.id);
 assert.deepEqual(await visible('me'),[received]);assert.equal((await visible('friend')).length,2);
 assert.equal((await pg.query('select count(*)::int n from messages')).rows[0].n,2);
}));
test('cannot delete foreign messages, messages in another chat, or without active membership',()=>tx(async()=>{
 await denied(()=>hide('me',received));await denied(()=>hide('friend',own));
 await denied(()=>hide('stranger'));await denied(()=>hide('left'));await denied(()=>hide('me',own,otherChat));
 assert.equal((await pg.query('select * from messages where hidden_for_sender_at is not null')).rows.length,0);
}));
test('rejoined members cannot hide messages before their current history boundary',()=>tx(async()=>{
 await pg.query("update conversation_members set joined_at='2026-10-04' where user_id='me' and conversation_id=$1",[chat]);
 await denied(()=>hide());
}));
test('untrusted database callers cannot impersonate a message sender',()=>tx(async()=>{
 for(const role of ['anon','authenticated']) {await pg.exec(`set local role ${role}`);await denied(()=>hide());await pg.exec('reset role');}
}));
test('a contact opens a direct chat in either direction, preferring general conversations over listings',()=>{
 const rows=[{id:'group',kind:'group',sender_id:'friend',receiver_id:null},{id:'support',kind:'support',sender_id:'friend',receiver_id:'me'},{id:'offer',kind:'direct',sender_id:'friend',receiver_id:'me',listing_id:'offer-id'},{id:'direct',kind:'direct',sender_id:'me',receiver_id:'friend',listing_id:null}];
 assert.equal(findContactConversation(rows,'me','friend')?.id,'direct');
 assert.equal(findContactConversation(rows.slice(0,3),'me','friend')?.id,'offer');
 assert.equal(findContactConversation(rows,'me','unrelated'),undefined);
 assert.equal(findContactConversation([{id:'other',sender_id:'friend',receiver_id:'someone-else'}],'me','friend'),undefined);
});
test('polling cannot resurrect locally hidden messages and retains older loaded history',()=>{
 const m=(id,created_at)=>({id,sender_id:'me',created_at});
 const current=[m('old','2026-10-01'),m('hide','2026-10-02'),m('new','2026-10-03')];
 assert.deepEqual(mergeVisibleMessagePage(current,current.slice(1),new Set(['hide']),true).map(m=>m.id),['old','new']);
 assert.deepEqual(mergeVisibleMessagePage(current,[current[0],current[2]],new Set(),true).map(m=>m.id),['old','new']);
 assert.deepEqual(mergeVisibleMessagePage(current,[],new Set(),true),[]);
 assert.deepEqual(mergeVisibleMessagePage(current,[],new Set(),false),current);
});
