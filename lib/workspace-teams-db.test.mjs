import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMessagingDb} from './messaging-db-fixture.mjs';
let pg;let n=0;
before(async()=>{
 pg=await createMessagingDb();
 await pg.exec(`create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);create table media_assets(storage_path text primary key,reference_url text unique,owner_user_id text,mime_type text,source_type text,source_id text);`);
 await pg.exec(readFileSync(new URL('../supabase/migrations/20261113235706_private_message_attachments.sql',import.meta.url),'utf8'));
 await pg.exec(readFileSync(new URL('../supabase/candidates/workspace_team_channels.sql',import.meta.url),'utf8'));
 // Each product request is a new transaction; fixture tests share rollback state.
 await pg.exec('alter table messages alter column created_at set default clock_timestamp()');
});
after(async()=>pg?.close());
const rows=async(sql,args=[])=>(await pg.query(sql,args)).rows;
const scalar=async(sql,args=[])=>(await rows(sql,args))[0].result;
const op=(actor,action,p={})=>scalar('select workspace_teams_v1($1,$2,$3::jsonb) result',[actor,action,JSON.stringify({key:'fixture-operation-'+(++n),...p})]);
const detail=(actor,team)=>op(actor,'team',{teamId:team});
async function change(actor,action,team,p={}) {const list=await op(actor,'list');const revision=list.teams.find(t=>t.id===team)?.revision;return op(actor,action,{teamId:team,revision,...p});}
async function fixture(){const team=(await op('actor','create_team',{name:'Own team'})).teamId;await change('actor','invite',team,{userId:'peer'});await change('peer','accept',team);const created=await change('actor','create_channel',team,{name:'Own channel'});return {team,channel:created.channelId};}
async function tx(fn){await pg.exec('begin');try{await fn();}finally{await pg.exec('rollback');}}
async function denied(fn,code){await pg.exec('savepoint denied');try{await assert.rejects(fn,e=>e.code===code);}finally{await pg.exec('rollback to savepoint denied');}}
const send=(actor,conversation,key='fixture-send-key')=>scalar('select send_conversation_message($1,$2,$3,$4) result',[conversation,actor,'Own message',key]);

test('service-only tables and RPCs, no inferred membership or modification of legacy history',()=>tx(async()=>{
 for(const role of ['anon','authenticated']){
  for(const table of ['workspace_teams','workspace_team_members','workspace_team_channels','workspace_team_channel_access','workspace_team_preferences','workspace_team_operations'])assert.equal((await rows('select has_table_privilege($1,$2,\'SELECT\') allowed',[role,table]))[0].allowed,false);
  assert.equal((await rows("select has_function_privilege($1,'workspace_teams_v1(text,text,jsonb)','EXECUTE') allowed",[role]))[0].allowed,false);
 }
 assert.equal((await op('actor','list')).teams.length,0);
 assert.equal((await rows('select content from messages'))[0].content,'Own preserved legacy message');
 const team=(await op('actor','create_team',{name:'Own team'})).teamId;
 assert.equal((await detail('actor',team)).channels.length,0);
 assert.equal((await rows('select count(*)::int n from conversation_members'))[0].n,2);
}));
test('explicit targeted invitation and acceptance do not join channels; outsiders and pending accounts see no roster/history',()=>tx(async()=>{
 const team=(await op('actor','create_team',{name:'Own team'})).teamId;
 await change('actor','invite',team,{userId:'peer'});
 assert.equal((await op('peer','list')).teams[0].status,'invited');
 await denied(()=>detail('peer',team),'PT404');await denied(()=>detail('other',team),'PT404');
 await denied(()=>change('peer','create_channel',team,{name:'Forged'}),'PT404');
 await change('peer','accept',team);const d=await detail('peer',team);assert.equal(d.members.length,2);assert.equal(d.channels.length,0);
 await denied(()=>change('peer','invite',team,{userId:'other'}),'42501');
}));
test('visible, join, write and explicit denial are independent; team admins have no automatic history',()=>tx(async()=>{
 const {team,channel}=await fixture();let d=await detail('actor',team);const conv=d.channels[0].conversationId;
 assert.equal(d.channels[0].joined,false);await denied(()=>send('actor',conv),'PT404');
 await change('actor','join',team,{channelId:channel});await change('peer','join',team,{channelId:channel});
 await send('actor',conv);
 await change('actor','set_access',team,{channelId:channel,userId:'peer',canSee:true,canJoin:false,canWrite:false,denied:false});
 const peer=(await detail('peer',team)).channels[0];assert.equal(peer.joined,true);assert.equal(peer.canJoin,false);assert.equal(peer.canWrite,false);
 await denied(()=>send('peer',conv,'fixture-peer-send'),'PT404');
 assert.equal(await scalar('select message_attachment_target($1,$2) result',['peer','conversation:'+conv]),false);
 await change('peer','leave',team,{channelId:channel});await denied(()=>change('peer','join',team,{channelId:channel}),'PT404');
 await change('actor','set_access',team,{channelId:channel,userId:'peer',canSee:true,canJoin:true,canWrite:true,denied:true});
 assert.equal((await detail('peer',team)).channels.length,0);await denied(()=>change('peer','join',team,{channelId:channel}),'PT404');
}));
test('selected channels hide existence and require explicit view grant; legacy group management cannot bypass the Team policy',()=>tx(async()=>{
 const {team,channel}=await fixture();let d=await detail('actor',team);const conv=d.channels[0].conversationId;
 await change('actor','configure_channel',team,{channelId:channel,name:'Own private channel',visibility:'selected',defaultJoin:true,defaultWrite:true,archived:false});
 assert.equal((await detail('peer',team)).channels.length,0);await denied(()=>change('peer','join',team,{channelId:channel}),'PT404');
 await denied(()=>scalar('select manage_group_conversation($1,$2,$3,$4) result',[conv,'actor','add','other']),'42501');
 await change('actor','set_access',team,{channelId:channel,userId:'peer',canSee:true,canJoin:true,canWrite:false,denied:false});
 assert.equal((await detail('peer',team)).channels[0].canWrite,false);await change('peer','join',team,{channelId:channel});
 assert.equal((await rows('select role from conversation_members where conversation_id=$1',[conv]))[0].role,'member');
}));
test('channel leave/rejoin advances history, rejects old send replays; team removal revokes all channel access atomically',()=>tx(async()=>{
 const {team,channel}=await fixture();const conv=(await detail('actor',team)).channels[0].conversationId;
 await change('actor','join',team,{channelId:channel});await change('peer','join',team,{channelId:channel});
 const old=await send('peer',conv,'fixture-peer-old-key');
 await change('peer','leave',team,{channelId:channel});await change('peer','join',team,{channelId:channel});
 await denied(()=>send('peer',conv,'fixture-peer-old-key'),'PT404');
 const boundary=(await rows('select joined_at from conversation_members where conversation_id=$1 and user_id=$2',[conv,'peer']))[0].joined_at;
 assert.ok(new Date(boundary)>new Date(old.message.created_at));
 await change('actor','remove_member',team,{userId:'peer'});
 assert.equal((await rows('select * from conversation_members where conversation_id=$1 and user_id=$2 and left_at is null',[conv,'peer'])).length,0);
 assert.equal((await op('peer','list')).teams.length,0);await denied(()=>detail('peer',team),'PT404');await denied(()=>send('peer',conv),'PT404');
 assert.equal((await rows('select * from messages where id=$1',[old.message.id])).length,1);
}));
test('operation keys are account-scoped durable confirmations; stale revisions and reused payloads fail promptly',()=>tx(async()=>{
 const p={name:'Own repeatable team',key:'fixture-stable-key'};const first=await op('actor','create_team',p),second=await op('actor','create_team',p);assert.deepEqual(first,second);
 await denied(()=>op('actor','create_team',{...p,name:'Changed'}),'PT409');
 const other=await op('peer','create_team',p);assert.notEqual(other.teamId,first.teamId);
 await denied(()=>op('actor','create_channel',{teamId:first.teamId,revision:0,name:'Stale'}),'PT409');
}));
test('last Team admin must promote an accepted successor; channel departure does not leave the Team',()=>tx(async()=>{
 const {team,channel}=await fixture();await denied(()=>change('actor','leave_team',team),'PT409');
 await change('actor','join',team,{channelId:channel});await change('actor','leave',team,{channelId:channel});assert.equal((await op('actor','list')).teams[0].status,'active');
 await change('actor','promote',team,{userId:'peer'});await change('actor','leave_team',team);assert.equal((await op('peer','list')).teams[0].role,'admin');
}));
test('private inbox opt-in never joins channels or increases rights; ordinary unread counts exclude Team channels by default',()=>tx(async()=>{
 const {team,channel}=await fixture();const conv=(await detail('actor',team)).channels[0].conversationId;
 await change('actor','join',team,{channelId:channel});await change('peer','join',team,{channelId:channel});await send('actor',conv);
 assert.equal((await rows('select * from unread_message_counts($1)',['peer'])).length,0);
 await op('peer','preference',{showInInbox:true});assert.equal((await rows('select * from unread_message_counts($1)',['peer']))[0].unread_count,1);
 await op('peer','preference',{showInInbox:false});assert.equal((await rows('select * from unread_message_counts($1)',['peer'])).length,0);
 assert.equal((await op('actor','list')).showInInbox,false);
}));
test('archiving revokes participation; free groups and legacy direct chats retain existing behavior',()=>tx(async()=>{
 const {team,channel}=await fixture();const conv=(await detail('actor',team)).channels[0].conversationId;await change('peer','join',team,{channelId:channel});
 await change('actor','configure_channel',team,{channelId:channel,name:'Archived',visibility:'team',defaultJoin:true,defaultWrite:true,archived:true});
 assert.equal((await detail('peer',team)).channels.length,0);await denied(()=>send('peer',conv),'PT404');
 const group=await scalar("select create_group_conversation('actor','Free group',array['peer'],'fixture-free-group') result");assert.equal((await send('actor',group.conversationId)).created,true);
}));

test('two Teams never share admission, selected-channel metadata, or history through a copied ID',()=>tx(async()=>{
 const {team,channel}=await fixture();const second=(await op('other','create_team',{name:'Other team'})).teamId;
 await denied(()=>change('other','join',second,{channelId:channel}),'PT404');
 await denied(()=>change('actor','set_access',team,{channelId:channel,userId:'other',canSee:true,canJoin:true,canWrite:true,denied:false}),'PT404');
 assert.equal((await detail('other',second)).channels.length,0);
}));
test('a single joined member can post in a Team channel without adding another account or joining the admin automatically',()=>tx(async()=>{
 const team=(await op('actor','create_team',{name:'Solo team'})).teamId;const channel=(await change('actor','create_channel',team,{name:'Solo channel'})).channelId;
 let d=await detail('actor',team);assert.equal(d.channels[0].joined,false);await change('actor','join',team,{channelId:channel});
 assert.equal((await send('actor',d.channels[0].conversationId)).created,true);
}));
test('a private or blocked current participant cannot be bypassed by accepting or joining from an old invitation',()=>tx(async()=>{
 const team=(await op('actor','create_team',{name:'Own team'})).teamId;await change('actor','invite',team,{userId:'peer'});
 await pg.exec("insert into blocks values('peer','actor')");await denied(()=>change('peer','accept',team),'42501');
 assert.equal((await op('peer','list')).teams[0].status,'invited');await pg.exec('delete from blocks');
 await pg.exec("insert into user_settings(user_id,profile_visibility) values('actor','private')");await denied(()=>change('peer','accept',team),'42501');
}));
test('channel uploads, protected image attachment reads and draft access immediately follow Team withdrawal',()=>tx(async()=>{
 const {team,channel}=await fixture();const conv=(await detail('actor',team)).channels[0].conversationId;
 await change('actor','join',team,{channelId:channel});await change('peer','join',team,{channelId:channel});
 const id='70000000-0000-4000-8000-000000000001',path='actor/fixture.webp',url='/api/media/'+path;
 await pg.query("insert into message_attachments(id,owner_user_id,destination_key,reference_url,storage_path,mime_type,filename,byte_size,content_sha256) values($1,'actor',$2,$3,$4,'image/webp','Own image',12,$5)",[id,'conversation:'+conv,url,path,'a'.repeat(64)]);
 await pg.query("insert into media_assets(storage_path,reference_url,owner_user_id,mime_type) values($1,$2,'actor','image/webp')",[path,url]);
 const message=await scalar('select send_message_with_attachments($1,$2,$3,$4::uuid[],$5::uuid) result',['actor','','fixture-file-key',[id],conv]);
 assert.equal((await rows('select * from readable_message_attachment($1,$2)',[id,'peer'])).length,1);
 assert.equal(await scalar('select workspace_team_draft_access($1,$2,$3) result',['peer','workspace-team',team]),true);
 await change('actor','set_access',team,{channelId:channel,userId:'peer',canSee:true,canJoin:true,canWrite:true,denied:true});
 assert.equal((await rows('select * from readable_message_attachment($1,$2)',[id,'peer'])).length,0);
 assert.equal((await rows('select * from readable_media_asset($1,$2)',[path,'peer'])).length,0);
 await change('actor','remove_member',team,{userId:'peer'});
 assert.equal(await scalar('select workspace_team_draft_access($1,$2,$3) result',['peer','workspace-team',team]),false);
 assert.equal((await rows('select * from messages where id=$1',[message.message.id])).length,1);
}));
test('bounded team lists enforce capacities instead of silently trimming members or channels',()=>tx(async()=>{
 const team=(await op('actor','create_team',{name:'Bounded team'})).teamId;
 for(let i=1;i<=49;i++)await change('actor','invite',team,{userId:'member-'+i});
 await denied(()=>change('actor','invite',team,{userId:'member-50'}),'PT409');assert.equal((await detail('actor',team)).members.length,50);
 for(let i=1;i<=100;i++)await change('actor','create_channel',team,{name:'Channel '+i});
 await denied(()=>change('actor','create_channel',team,{name:'Overflow'}),'PT409');assert.equal((await detail('actor',team)).channels.length,100);
}));
