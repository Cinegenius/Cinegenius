import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import sharp from 'sharp';
import {NextRequest,NextResponse} from 'next/server.js';
import * as attachments from './message-attachments.ts';
import * as files from './message-attachment-files.ts';
import * as backend from './messaging-backend.ts';
import * as protectedMedia from './protected-media.ts';
import {attachmentServerFixture} from './message-attachment-fixture.mjs';
import {confirmedChatMessage,restoredMessageValue} from './messaging-ui.ts';
const require=createRequire(import.meta.url),id='40000000-0000-4000-8000-000000000001';
function fixture(){
 const records=new Map(),objects=new Map(),calls=[];let owner='actor',target=true,readable=false,admin=false,support=false;
 const db={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='message_attachment_target'?target:readable?[records.get(args.p_id)]:[],error:null}},from(table){let mode='select',row,selectedId;const q={select(){return q},eq(k,v){if(k==='id')selectedId=v;return q},insert(value){mode='insert';row=value;return q},maybeSingle(){return q},then(done){calls.push({table,mode});if(mode==='insert'){records.set(row.id,row);return Promise.resolve({error:null}).then(done)}return Promise.resolve({data:table==='message_attachments'?records.get(selectedId)??null:table==='messages'?{conversation_id:'own-thread'}:table==='conversations'&&support?{id:'own-thread'}:null,error:null}).then(done)}};return q},storage:{from(bucket){return {upload:async(path,data)=>{calls.push({bucket,path,upload:true});objects.set(path,new Blob([data]));return {error:null}},download:async(path)=>{calls.push({bucket,path,download:true});return {data:objects.get(path),error:null}}}}}};
 const deps={'@/lib/auth':{requireAuth:async()=>owner?{userId:owner}:NextResponse.json({},{status:401})},'@/lib/requireAdmin':{requireAdmin:async()=>admin?{userId:owner}:NextResponse.json({},{status:403})},'@/lib/db':{db},'@/lib/rateLimit':{rateLimit:async()=>({allowed:true})},'next-intl/server':{getTranslations:async()=>key=>key},'@/lib/message-attachment-files':files,'@/lib/message-attachments':attachments,'@/lib/message-attachment-server':attachmentServerFixture(db),'@/lib/messaging-backend':backend,'@/lib/protected-media':protectedMedia,
 '@/lib/protected-media-server':{storeProtectedMedia:async(actor,path,bytes)=>{assert.equal(actor,'actor');objects.set(path,new Blob([bytes]));calls.push({protected:true,path});return '/api/media/'+path}}};
 const load=file=>{const code=ts.transpileModule(readFileSync(new URL('../app/api/'+file,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,mod={exports:{}};new Function('require','module','exports',code)(name=>deps[name]??require(name),mod,mod.exports);return mod.exports};
 return {api:load('message-attachments/route.ts'),download:load('message-attachments/[id]/route.ts'),supportDownload:load('admin/support/attachments/[id]/route.ts'),records,objects,calls,set(next){if('owner'in next)owner=next.owner;if('target'in next)target=next.target;if('readable'in next)readable=next.readable;if('admin'in next)admin=next.admin;if('support'in next)support=next.support;}};
}
function request(bytes='%PDF-1.7\nOwn fixture',name='Own.pdf',account='actor',destination='recipient:peer'){
 const body=new FormData();body.set('file',new File([bytes],name));body.set('accountId',account);body.set('id',id);body.set('destination',destination);return new NextRequest('https://fixture.invalid/api/message-attachments',{method:'POST',body});
}
test('upload is account/destination checked and retry returns one private stored document',async()=>{
 const f=fixture();f.set({owner:null});assert.equal((await f.api.POST(request())).status,401);assert.equal(f.calls.length,0);
 f.set({owner:'actor'});assert.equal((await f.api.POST(request(undefined,undefined,'other'))).status,403);assert.equal(f.calls.length,0);
 f.set({target:false});assert.equal((await f.api.POST(request())).status,403);assert.equal(f.objects.size,0);
 f.set({target:true});const response=await f.api.POST(request());assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);
 const {attachment}=await response.json();assert.equal(attachment.url,'/api/message-attachments/'+id);assert.ok(attachments.validMessageAttachment(attachment));
 assert.equal((await f.api.POST(request())).status,200);assert.equal(f.objects.size,1);assert.equal(f.calls.filter(c=>c.upload).length,1);
 assert.equal((await f.api.POST(request('%PDF-1.7\nDifferent'))).status,409);
 assert.equal((await f.api.POST(request(undefined,undefined,'actor','recipient:other'))).status,409);
});
test('image uploads use the protected-media writer, content validation rejects active or disguised file types',async()=>{
 const f=fixture(),png=await sharp({create:{width:8,height:8,channels:3,background:'#c8ff1a'}}).png().toBuffer();
 const response=await f.api.POST(request(png,'Own.png'));assert.equal(response.status,200);assert.ok((await response.json()).attachment.url.startsWith('/api/media/actor/'));
 assert.equal(f.calls.filter(c=>c.protected).length,1);assert.equal(f.calls.some(c=>c.bucket==='message-documents'),false);
 for(const [data,name] of [['<svg/>','bad.svg'],['<script/>','bad.png'],['fake','bad.pdf'],['fake','bad.docx'],['\0binary','bad.txt']]){
  const rejected=fixture();assert.equal((await rejected.api.POST(request(data,name))).status,400);assert.equal(rejected.objects.size,0);
 }
});
test('documents require fresh read permission for every download; admins cannot read private direct-chat files through support',async()=>{
 const f=fixture();await f.api.POST(request());const context={params:Promise.resolve({id})},req=new NextRequest('https://fixture.invalid/api/message-attachments/'+id);
 assert.equal((await f.download.GET(req,context)).status,404);assert.equal(f.calls.some(c=>c.download),false);
 f.set({readable:true});const download=await f.download.GET(req,context);assert.equal(download.status,200);assert.match(download.headers.get('Content-Disposition'),/^attachment/);assert.match(download.headers.get('Vercel-CDN-Cache-Control'),/no-store/);assert.equal(await download.text(),'%PDF-1.7\nOwn fixture');
 f.set({readable:false});assert.equal((await f.download.GET(req,context)).status,404);
 assert.equal((await f.supportDownload.GET(req,context)).status,403);
 f.set({admin:true});assert.equal((await f.supportDownload.GET(req,context)).status,404);
 f.records.get(id).message_id='own-message';assert.equal((await f.supportDownload.GET(req,context)).status,404);
 f.set({support:true});assert.equal((await f.supportDownload.GET(req,context)).status,200);
 assert.equal(protectedMedia.isProtectedMediaOptimizerSource('/api/admin/support/attachments/'+id,'https://www.cinegenius.co'),true);
});
test('recovery and send acknowledgements reject malformed or substituted attachments',()=>{
 const file={id,url:'/api/message-attachments/'+id,name:'Own.pdf',mime:'application/pdf',size:12};
 const draft={destination:'recipient:peer',content:'',requestKey:'own-retry-key',attachments:[file]};
 assert.deepEqual(restoredMessageValue(draft,draft.destination),draft);
 assert.equal(restoredMessageValue({...draft,attachments:[{...file,url:'https://public.invalid/file.pdf'}]},draft.destination),null);
 const message={id,sender_id:'actor',content:'',created_at:'2026-11-14T00:00:00Z',read_at:null,attachments:[file]};
 assert.equal(confirmedChatMessage(message,'actor','',[id]),true);
 assert.equal(confirmedChatMessage({...message,attachments:[]},'actor','',[id]),false);
 assert.equal(confirmedChatMessage(message,'actor','',[]),false);
});
