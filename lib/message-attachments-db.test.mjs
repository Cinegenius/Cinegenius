import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createMessagingDb} from './messaging-db-fixture.mjs';
let pg;
before(async()=>{
 pg=await createMessagingDb();
 await pg.exec(`create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);
 create table media_assets(storage_path text primary key,reference_url text unique,owner_user_id text,mime_type text,source_type text,source_id text);`);
 await pg.exec(readFileSync(new URL('../supabase/migrations/20261113235706_private_message_attachments.sql',import.meta.url),'utf8'));
});
after(async()=>pg?.close());
const rows=async(sql,args=[])=>(await pg.query(sql,args)).rows;
const scalar=async(sql,args=[])=>(await rows(sql,args))[0].result;
async function tx(fn){await pg.exec('begin');try{await fn();}finally{await pg.exec('rollback');}}
async function denied(fn,code){await pg.exec('savepoint denied');try{await assert.rejects(fn,e=>e.code===code);}finally{await pg.exec('rollback to savepoint denied');}}
async function upload(destination='recipient:peer',owner='actor',image=false){
 const id=randomUUID(),path=owner+'/'+id.replaceAll('-','')+(image?'.webp':'.pdf'),url=image?'/api/media/'+path:'/api/message-attachments/'+id;
 await pg.query('insert into message_attachments(id,owner_user_id,destination_key,reference_url,storage_path,mime_type,filename,byte_size,content_sha256) values($1,$2,$3,$4,$5,$6,$7,12,$8)',[id,owner,destination,url,path,image?'image/webp':'application/pdf','Own fixture', 'a'.repeat(64)]);
 if(image)await pg.query('insert into media_assets(storage_path,reference_url,owner_user_id,mime_type) values($1,$2,$3,$4)',[path,url,owner,'image/webp']);
 return {id,path,url};
}
const send=(ids,key='own-file-key',content='',conversation=null,recipient='peer',actor='actor')=>scalar('select send_message_with_attachments($1,$2,$3,$4::uuid[],$5::uuid,$6) result',[actor,content,key,ids,conversation,recipient]);
const readable=(id,viewer)=>rows('select id from readable_message_attachment($1,$2)',[id,viewer]);
test('attachments are service-only and storage remains private',async()=>{
 assert.equal((await rows("select public from storage.buckets where id='message-documents'"))[0].public,false);
 for(const role of ['anon','authenticated']){
  assert.equal((await rows("select has_table_privilege($1,'message_attachments','SELECT') allowed",[role]))[0].allowed,false);
  for(const fn of ['send_message_with_attachments(text,text,text,uuid[],uuid,text,uuid,text,text)','readable_message_attachment(uuid,text)','message_attachment_target(text,text)','message_attachment_json(uuid)'])assert.equal((await rows("select has_function_privilege($1,$2,'execute') allowed",[role,fn]))[0].allowed,false);
 }
});
test('private upload becomes a single durable attachment-only message, retry keeps the same file and read boundaries',()=>tx(async()=>{
 const file=await upload(),image=await upload('recipient:peer','actor',true);
 assert.equal((await readable(file.id,'actor')).length,1);assert.equal((await readable(file.id,'peer')).length,0);assert.equal((await readable(file.id,null)).length,0);
 assert.equal(await scalar("select message_attachment_target('actor','recipient:peer') result"),true);
 const sent=await send([file.id,image.id]);assert.equal(sent.created,true);assert.equal(sent.message.content,'');assert.equal(sent.message.attachments.length,2);
 const again=await send([image.id,file.id]);assert.equal(again.created,false);assert.equal(again.message.id,sent.message.id);assert.equal(again.message.attachments.length,2);
 assert.equal((await readable(file.id,'peer')).length,1);assert.equal((await readable(file.id,'other')).length,0);
 assert.equal((await rows('select * from readable_media_asset($1,$2)',[image.path,'peer'])).length,1);assert.equal((await rows('select * from readable_media_asset($1,$2)',[image.path,'other'])).length,0);
 await denied(()=>send([file.id,image.id],'own-file-key','changed'),'PT409');
 await denied(()=>send([file.id],'another-own-key'),'42501');
 await pg.query("update messages set hidden_for_sender_at=now() where id=$1",[sent.message.id]);
 assert.equal((await readable(file.id,'actor')).length,0);assert.equal((await readable(file.id,'peer')).length,1);
}));
test('forged owners, targets, duplicate files and newly blocked recipients cannot bind or send uploads',()=>tx(async()=>{
 const other=await upload('recipient:peer','other'),wrongTarget=await upload('recipient:third'),own=await upload();
 await denied(()=>send([other.id]),'42501');await denied(()=>send([wrongTarget.id]),'42501');await denied(()=>send([own.id,own.id]),'22023');
 await pg.exec("insert into blocks values('peer','actor')");await denied(()=>send([own.id]),'42501');
 assert.equal((await rows('select message_id from message_attachments where id=$1',[own.id]))[0].message_id,null);
 assert.equal((await rows('select count(*)::int n from conversations'))[0].n,1);
}));
test('group history, leaving and rejoining revoke file and image access even to an original uploader',()=>tx(async()=>{
 const group=await scalar("select create_group_conversation('actor','Own group',array['peer','other'],'own-group-key') result");
 const file=await upload('conversation:'+group.conversationId,'actor',true);
 const sent=await send([file.id],'own-group-file','caption',group.conversationId,null);
 assert.equal((await readable(file.id,'other')).length,1);
 await pg.query("update conversation_members set left_at=now() where conversation_id=$1 and user_id='other'",[group.conversationId]);
 assert.equal((await readable(file.id,'other')).length,0);
 await pg.query("update conversation_members set left_at=null,joined_at=$2::timestamptz+interval '1 second' where conversation_id=$1 and user_id='other'",[group.conversationId,sent.message.created_at]);
 assert.equal((await readable(file.id,'other')).length,0);
 await pg.query("update conversation_members set left_at=now() where conversation_id=$1 and user_id='actor'",[group.conversationId]);
 assert.equal((await rows('select * from readable_media_asset($1,$2)',[file.path,'actor'])).length,0);
 await denied(()=>send([file.id],'own-group-file','caption',group.conversationId,null),'PT404');
}));
