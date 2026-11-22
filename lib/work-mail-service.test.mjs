import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as common from './work-mail.ts';
const require=createRequire(import.meta.url),owner='user_One',id='10000000-0000-4000-8000-000000000001',connectionId='10000000-0000-4000-8000-000000000002',key=common.workMailAttachmentId('provider-att');
function load(path,mocks){const code=ts.transpileModule(readFileSync(new URL('./'+path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;const module={exports:{}};new Function('require','module','exports',code)(name=>name in mocks?mocks[name]:require(name),module,module.exports);return module.exports;}
const source=()=>({raw:Buffer.from('Original\r\nunchanged\0'),subject:'Own original',from:'external@fixture.invalid',receivedAt:'2026-11-22T10:00:00Z',text:'Safe <script>plain source</script>',attachments:[{id:'provider-att',name:'Own.pdf',type:'application/pdf',size:3}]});
function fixture({ready=false,decryptFails=false,cached=false,foreign=false}={}){
 const calls=[],stored=[],provider=[];const value=source();const record={id,owner_id:foreign?'user_Other':owner,source:'gmail',provider_id:'provider-message',connection_id:connectionId,subject:value.subject,sender:value.from,received_at:value.receivedAt,preview_text:value.text,attachments:value.attachments,original_size:value.raw.length,original_hash:common.workMailHash(value.raw),status:ready?'ready':'pending',imported_at:'2026-11-22',created_at:'2026-11-22'};
 const connection={id:connectionId,owner_id:owner,provider:'gmail',encrypted_tokens:'fixture-encrypted',revision:1,expires_at:'2099-01-01'};
 const rpc=async(who,action,p)=>{calls.push({who,action,p});if(action==='connection_get')return connection;if(action==='item_find')return ready?record:null;if(action==='item_reserve'||action==='item_get')return record;if(action==='attachment_get')return cached?{size:3,sha256:common.workMailHash(Buffer.from([1,2,3]))}:null;if(action==='attachments_list')return [];return {};};
 const oauth={workMailProviderConfig:()=>({}),sealWorkMailToken:()=> 'sealed',unsealWorkMailToken:()=>{if(decryptFails)throw Error('No key');return {accessToken:'fixture',refreshToken:'fixture',expiresAt:Date.now()+3600000,scope:['readonly']};},refreshWorkMailToken:async()=>{provider.push('refresh');throw Error('not expected');},getWorkMailRaw:async()=>{provider.push('get');return value;},getWorkMailAttachment:async()=>{provider.push('attachment');return {bytes:Buffer.from([1,2,3]),name:'Own.pdf',type:'application/pdf',size:3};},revokeWorkMailToken:async()=>{provider.push('revoke');return {remoteRevoked:false,manualRequired:true};}};
 const store={workMailRPC:rpc,workMailStoreBytes:async(...args)=>stored.push(args),workMailStoragePath:(item,attachment)=>item.owner_id+'/'+item.id+'/'+(attachment??'original.eml'),workMailLoadBytes:async()=>Buffer.from([1,2,3])};
 return {module:load('work-mail-service.ts',{'server-only':{},'./work-mail':common,'./work-mail-store':store,'./work-mail-oauth':oauth,'./work-mail-resend':{getWorkMailResendAttachment:async()=>{provider.push('resend');throw Error('not expected');}}}),calls,stored,provider,value,record};
}
async function active(fn){const names=['WORK_MAIL_ENABLED','WORK_MAIL_ENCRYPTION_KEY'],previous=names.map(n=>process.env[n]);process.env.WORK_MAIL_ENABLED='1';process.env.WORK_MAIL_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');try{await fn();}finally{names.forEach((n,i)=>{if(previous[i]===undefined)delete process.env[n];else process.env[n]=previous[i];});}}
test('selected original is persisted byte-for-byte under owner and marked ready only after immutable storage acknowledgement',()=>active(async()=>{
 const f=fixture();await f.module.workMailPersistSource(owner,'gmail','provider-message',connectionId,f.value);assert.equal(f.stored.length,1);assert.deepEqual(f.stored[0][1],f.value.raw);assert.equal(f.stored[0][2],common.workMailHash(f.value.raw));assert.ok(f.stored[0][0].startsWith(owner+'/'));assert.equal(f.calls.at(-1).action,'item_commit');assert.ok(f.calls.every(c=>c.who===owner));
}));
test('already imported selected mail retries without another provider download or storage write',()=>active(async()=>{
 const f=fixture({ready:true});const result=await f.module.workMailImportProvider(owner,connectionId,'provider-message');assert.equal(result.id,id);assert.deepEqual(f.provider,[]);assert.equal(f.stored.length,0);
}));
test('disconnect removes local encrypted credentials even when the server encryption key cannot be used',async()=>{
 const f=fixture({decryptFails:true});const result=await f.module.workMailDisconnect(owner,connectionId);assert.equal(result.remoteRevoked,false);assert.equal(result.manualRequired,true);assert.equal(f.calls.at(-1).action,'connection_delete');assert.deepEqual(f.provider,[]);
});
test('cached attachments remain available after disabling all provider access; foreign records fail closed',async()=>{
 const f=fixture({ready:true,cached:true});const result=await f.module.workMailFile(owner,id,key);assert.deepEqual(result.bytes,Buffer.from([1,2,3]));assert.equal(result.sha256,common.workMailHash(result.bytes));assert.deepEqual(f.provider,[]);assert.equal(f.calls.some(c=>c.action==='connection_get'),false);
 const foreign=fixture({ready:true,cached:true,foreign:true});await assert.rejects(()=>foreign.module.workMailFile(owner,id,key),e=>e.status===404);assert.deepEqual(foreign.provider,[]);
});
test('lost storage acknowledgement succeeds only if existing private bytes have the same expected size and hash',async()=>{
 const bytes=Buffer.from('Exact'),uploads=[];const db={storage:{from:()=>({upload:async(...args)=>{uploads.push(args);return {error:{code:'lost_ack'}};},download:async()=>({data:new Blob([bytes]),error:null})})}};
 const store=load('work-mail-store.ts',{'server-only':{},'@/lib/db':{db},'./work-mail':common});
 await store.workMailStoreBytes(owner+'/'+id+'/original.eml',bytes,common.workMailHash(bytes));assert.equal(uploads[0][2].upsert,false);
 await assert.rejects(()=>store.workMailStoreBytes(owner+'/'+id+'/original.eml',Buffer.from('Other'),common.workMailHash('Other')),e=>e.code==='saveFailed');
 assert.throws(()=>store.workMailStoragePath({owner_id:'../other',id}),e=>e.code==='invalid');
});
