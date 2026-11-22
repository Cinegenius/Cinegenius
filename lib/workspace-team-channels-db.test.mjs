// Isolated synthetic data only. This contract test is not a release approval.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createMessagingDb} from './messaging-db-fixture.mjs';
let pg;
const rows=async(sql,args=[])=>(await pg.query(sql,args)).rows;
const value=async(sql,args=[])=>(await rows(sql,args))[0].value;
const migration=name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
before(async()=>{
  pg=await createMessagingDb();
  await pg.exec('create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]); create table media_assets(storage_path text primary key,reference_url text unique,owner_user_id text,mime_type text,source_type text,source_id text);');
  await pg.exec(migration('20261113235706_private_message_attachments.sql'));
  await pg.exec(migration('20261122110654_workspace_team_channels_v1.sql'));
  // Model separate request timestamps inside the outer rollback transaction.
  await pg.exec('alter table messages alter column created_at set default clock_timestamp()');
});
after(async()=>pg?.close());
async function tx(work){await pg.exec('begin');try{await work();}finally{await pg.exec('rollback; reset role');}}
async function denied(work,code='PT404'){
  await pg.exec('savepoint expected_denial');
  try{await assert.rejects(work,error=>error.code===code);}
  finally{await pg.exec('rollback to savepoint expected_denial');}
}
const rpc=(actor,action,input={})=>value('select workspace_teams_v1($1,$2,$3::jsonb) value',[actor,action,JSON.stringify(input)]);
const preference=(actor,show=null,revision=null)=>value('select workspace_inbox_preference_v1($1,$2,$3) value',[actor,show,revision]);
const feed=(actor,surface='community',team=null,limit=50,after=null)=>value(
  'select workspace_conversation_page_v1($1,$2,$3::uuid,$4::timestamptz,$5::uuid,$6) value',
  [actor,surface,team,after?.updatedAt??null,after?.id??null,limit]);
const access=(actor,id)=>rows('select * from workspace_conversation_access($1,array[$2::uuid])',[actor,id]);
const send=(actor,id,content='Synthetic message',key=randomUUID())=>value(
  'select send_conversation_message($1::uuid,$2,$3,$4) value',[id,actor,content,key]);
async function team(){return (await rpc('actor','create_team',{name:'Synthetic team',idempotencyKey:randomUUID()})).teamId;}
async function command(teamId,action,input={},actor='actor'){
  const current=await rpc(actor,'team',{teamId});
  return rpc(actor,action,{teamId,expectedVersion:current.team.revision,idempotencyKey:randomUUID(),...input});
}
async function admit(id,user='peer'){
  await command(id,'invite_member',{targetUserId:user});
  await rpc(user,'accept_invite',{teamId:id,idempotencyKey:randomUUID()});
}
async function channel(id,options={}){
  return (await command(id,'create_channel',{name:'Synthetic All',visibility:'team',joinPolicy:'open',writePolicy:'participants',...options})).channelId;
}
const join=(id,ch,user='peer')=>rpc(user,'join_channel',{teamId:id,channelId:ch,idempotencyKey:randomUUID()});

test('contract stays service-only and introduces no historical memberships',()=>tx(async()=>{
  assert.equal(await value('select count(*)::int value from workspace_private.teams'),0);
  assert.equal(await value("select content value from messages where id='20000000-0000-4000-8000-000000000001'"),'Own preserved legacy message');
  for(const role of ['anon','authenticated','service_role']){
    await pg.exec('set role '+role);
    await denied(()=>rows('select * from workspace_private.inbox_preferences'),'42501');
    if(role==='service_role')assert.deepEqual((await rpc('actor','list')).teams,[]);
    else await denied(()=>rpc('actor','list'),'42501');
    await pg.exec('reset role');
  }
}));
test('unknown and invited accounts cannot bypass rights checks through SQL nulls',()=>tx(async()=>{
  const id=await team();
  for(const action of ['team','create_channel','invite_member','leave_team','accept_invite','join_channel'])
    await denied(()=>rpc('other',action,{teamId:id,idempotencyKey:randomUUID(),expectedVersion:1}));
  await command(id,'invite_member',{targetUserId:'peer'});
  assert.equal((await rpc('peer','team',{teamId:id})).status,'invited');
  await denied(()=>rpc('peer','create_channel',{teamId:id,idempotencyKey:randomUUID(),expectedVersion:2}));
  await denied(()=>rpc(null,'list'),'22023');
  await denied(()=>rpc('actor',null,{teamId:id,idempotencyKey:randomUUID()}),'22023');
}));
test('independent team history and personal opt-in share one conversation without changing rights or other accounts',()=>tx(async()=>{
  const id=await team();await admit(id);const ch=await channel(id);await join(id,ch);
  await send('actor',ch);
  const memberships=await rows('select * from conversation_members where conversation_id=$1 order by user_id',[ch]);
  assert.deepEqual(await preference('peer'),{accountId:'peer',showTeamConversations:false,revision:0});
  const separate=await feed('peer','team',id);
  assert.equal(separate.total,1);assert.equal(separate.unreadByConversation[ch],1);
  assert.equal((await feed('peer')).total,0);
  assert.deepEqual(await rows("select * from unread_message_counts('peer')"),[]);
  await preference('peer',true,0);
  assert.deepEqual((await feed('peer')).conversations.map(c=>c.id),[ch]);
  assert.equal(Number((await rows("select * from unread_message_counts('peer')"))[0].unread_count),1);
  assert.equal((await feed('actor')).total,0);
  assert.deepEqual(await feed('peer','team',id),separate);
  assert.deepEqual(await rows('select * from conversation_members where conversation_id=$1 order by user_id',[ch]),memberships);
  await preference('peer',false,1);
  assert.equal((await feed('peer')).total,0);assert.deepEqual(await feed('peer','team',id),separate);
}));
test('preference revisions reject stale writes and opt-in never joins a foreign team',()=>tx(async()=>{
  const id=await team();const ch=await channel(id);
  await preference('other',true,0);
  await denied(()=>preference('other',false,0),'PT409');
  await denied(()=>preference('other',false,null),'22023');
  assert.equal((await preference('other')).showTeamConversations,true);
  assert.equal((await feed('other')).total,0);
  await denied(()=>feed('other','team',id));
  assert.equal((await access('other',ch))[0].can_read,false);
  assert.equal((await access('other',ch))[0].can_manage,false);
}));
test('leave, denial and team removal close both views; permission restoration never rejoins or restores history',()=>tx(async()=>{
  const id=await team();await admit(id);
  const ch=await channel(id,{visibility:'restricted',joinPolicy:'invited'});
  assert.deepEqual((await rpc('peer','team',{teamId:id})).channels,[]);
  await denied(()=>join(id,ch));
  await command(id,'set_channel_access',{channelId:ch,targetUserId:'peer',access:'allowed',canWrite:true});
  assert.equal((await feed('peer','team',id)).total,0);
  await join(id,ch);await preference('peer',true,0);await send('actor',ch);
  await command(id,'set_channel_access',{channelId:ch,targetUserId:'peer',access:'denied',canWrite:false});
  assert.equal((await feed('peer')).total,0);assert.equal((await feed('peer','team',id)).total,0);
  await denied(()=>send('peer',ch));
  await command(id,'set_channel_access',{channelId:ch,targetUserId:'peer',access:'allowed',canWrite:true});
  assert.equal((await access('peer',ch))[0].can_read,false);
  await join(id,ch);assert.deepEqual((await feed('peer','team',id)).unreadByConversation,{});
  await rows("select manage_group_conversation($1,'peer','leave')",[ch]);
  assert.equal((await rpc('peer','team',{teamId:id})).status,'active');
  assert.equal((await access('peer',ch))[0].can_read,false);
  await join(id,ch);
  await command(id,'remove_member',{targetUserId:'peer'});
  await denied(()=>rpc('peer','team',{teamId:id}));
  assert.equal((await feed('peer')).total,0);
}));
test('scope filtering precedes pagination and free groups do not get lost behind newer team conversations',()=>tx(async()=>{
  const id=await team();await admit(id);
  const free=await value("select create_group_conversation('actor','Synthetic free',array['peer'],'synthetic-free-key') value");
  for(let n=0;n<4;n++){const ch=await channel(id);await join(id,ch);await send('actor',ch);}
  const ordinary=await feed('peer','community',null,2);
  assert.equal(ordinary.total,1);assert.deepEqual(ordinary.conversations.map(c=>c.id),[free.conversationId]);
  const first=await feed('peer','team',id,2),second=await feed('peer','team',id,2,first.nextCursor);
  assert.equal(first.total,4);assert.equal(new Set([...first.conversations,...second.conversations].map(c=>c.id)).size,4);
  await preference('peer',true,0);
  const combined=await feed('peer');assert.equal(combined.total,5);
  assert.equal(new Set(combined.conversations.map(c=>c.id)).size,5);
  assert.equal(Object.values(combined.unreadByConversation).reduce((a,b)=>a+b,0),4);
}));
test('team owners cannot use ordinary group management to bypass channel rules',()=>tx(async()=>{
  const id=await team();await admit(id);const ch=await channel(id);await join(id,ch);
  for(const action of ['add','remove','promote','rename'])
    await denied(()=>rows("select manage_group_conversation($1,'actor',$2,'peer','Synthetic rename')",[ch,action]),'42501');
  await command(id,'set_channel_access',{channelId:ch,targetUserId:'peer',access:'allowed',canWrite:false});
  assert.equal((await access('peer',ch))[0].can_read,true);
  await denied(()=>send('peer',ch));
  await denied(()=>rows("select * from save_private_form_draft('peer',$1,0,'{}')",['message:conversation:'+ch]));
}));
