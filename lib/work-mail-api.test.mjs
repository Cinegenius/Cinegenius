import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {NextRequest,NextResponse} from 'next/server.js';
import {Webhook} from 'svix';
import * as common from './work-mail.ts';
const require=createRequire(import.meta.url),id='10000000-0000-4000-8000-000000000001',stateHash='a'.repeat(64);
const json=NextResponse.json;
function load(path,mocks){const code=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;const module={exports:{}};new Function('require','module','exports',code)(name=>name in mocks?mocks[name]:require(name),module,module.exports);return module.exports;}
class OAuthError extends Error{constructor(code){super(code);this.code=code;}}
function fixture({actor='user_One',session='sess_Fixture',allowed=true,configured=true,rpcError=null,prior=null,fileBytes=Buffer.from('Own')}={}){
 const calls=[],providerCalls=[];
 const oauth={WorkMailOAuthError:OAuthError,createWorkMailAuthorization:()=>({url:'https://accounts.google.com/o/oauth2/v2/auth?state=fixture',stateCookie:'opaque-fixture',stateHash,connectionId:id}),verifyWorkMailAuthorization:()=>({provider:'gmail',accountId:actor,sessionId:session,connectionId:id,stateHash}),exchangeWorkMailCode:async()=>{calls.push('exchange');return {accessToken:'fixture',refreshToken:'fixture',expiresAt:Date.now()+10000,scope:['readonly']};},sealWorkMailToken:()=> 'encrypted-fixture-token'};
 const rpc=async(owner,action,p)=>{calls.push({owner,action,p});if(rpcError)throw rpcError;if(action==='status')return {version:1,alias:null,connections:[]};if(action==='list')return {items:[]};if(action==='item_find')return prior;return {id};};
 const service={workMailCapabilities:(schema=true)=>({archive:schema&&configured,forwarding:schema&&configured,gmail:schema&&configured,microsoft:schema&&configured}),workMailDisconnect:async(owner,key)=>{providerCalls.push({owner,key});return {remoteRevoked:false,manualRequired:true};},workMailImportProvider:async(owner,connection,key)=>{providerCalls.push({owner,connection,key});return {id};},workMailImportCurrentDispo:async(owner,connection)=>{providerCalls.push({auto:{owner,connection}});return {id};},workMailItem:async(owner,key)=>{calls.push({owner,key});return {id};},workMailListProvider:async(owner,key)=>{providerCalls.push({owner,key});return {messages:[],cursor:null};},workMailAnalysisDocument:async(owner,key)=>{calls.push({analysis:{owner,key}});return {source:'messageText',document:{id,sha256:'a'.repeat(64),title:'Own',pages:[{number:1,text:'DISPO'}]}};},workMailPersistSource:async(...args)=>{calls.push({persist:args});},workMailFile:async(owner,key)=>{calls.push({file:{owner,key}});return {bytes:fileBytes,name:'Own.pdf',sha256:common.workMailHash(fileBytes)};}};
 const coreMocks={'server-only':{},'next/server':{NextResponse},'@clerk/nextjs/server':{auth:async()=>({userId:actor,sessionId:session})},'@/lib/auth':{requireAuth:async()=>actor?{userId:actor}:json({},{status:401})},'next-intl/server':{getTranslations:async()=>key=>'translated:'+key},'./work-mail':common,'./work-mail-oauth':oauth};
 const routeHelper=load('lib/work-mail-route.ts',coreMocks);
 const mocks={...coreMocks,'next/server':{NextRequest,NextResponse},'@/lib/work-mail':common,'@/lib/work-mail-route':routeHelper,'@/lib/work-mail-store':{workMailRPC:rpc,workMailResolveAlias:async local=>{calls.push({resolve:local});return actor;}},'@/lib/work-mail-service':service,'@/lib/work-mail-oauth':oauth,'@/lib/rateLimit':{rateLimit:async()=>({allowed})},'@/lib/work-mail-resend':{getWorkMailResendRaw:async()=>{providerCalls.push('resend');return {raw:Buffer.from('Own'),attachments:[]};}}};
 return {main:load('app/api/work/mail/route.ts',mocks),callback:load('app/api/work/mail/oauth/[provider]/callback/route.ts',mocks),file:load('app/api/work/mail/items/[id]/file/route.ts',mocks),webhook:load('app/api/webhooks/work-mail/route.ts',mocks),calls,providerCalls};
}
function request(path='',body,headers={}){return new NextRequest('https://www.cinegenius.co/api/work/mail'+path,{...(body!==undefined?{method:'POST',body:JSON.stringify(body)}:{}),headers:{'X-Mail-Account':'user_One',Origin:'https://www.cinegenius.co','Content-Type':'application/json',...headers}});}
test('all mail API reads and writes bind fresh Clerk owner and session before data/provider access',async()=>{
 for(const options of [{actor:null},{actor:'user_Other'},{session:null}]){const f=fixture(options);assert.ok([401,403].includes((await f.main.GET(request())).status));assert.equal(f.calls.length,0);assert.equal(f.providerCalls.length,0);}
 const f=fixture();assert.equal((await f.main.POST(request('',{accountId:'user_Other',action:'connect',provider:'gmail'}))).status,403);assert.equal(f.calls.length,0);
 assert.equal((await f.main.POST(request('',{accountId:'user_One',action:'connect',provider:'gmail'},{Origin:'https://evil.test'}))).status,403);assert.equal(f.calls.length,0);
});
test('missing schema/config renders honestly unavailable without any provider call; credentials never in status',async()=>{
 const f=fixture({rpcError:new common.WorkMailError()});const response=await f.main.GET(request());assert.equal(response.status,200);assert.equal((await response.json()).capabilities.archive,false);assert.equal(f.providerCalls.length,0);
 const disabled=fixture({configured:false});assert.equal((await disabled.main.POST(request('',{accountId:'user_One',action:'connect',provider:'gmail'}))).status,503);assert.equal(disabled.providerCalls.length,0);
 const good=await fixture().main.GET(request());assert.match(good.headers.get('cache-control'),/private, no-store/);assert.doesNotMatch(JSON.stringify(await good.json()),/encrypted|refreshToken|accessToken/);
});
test('mailbox import is one explicit selected message, never a client-supplied actor',async()=>{
 const f=fixture();const response=await f.main.POST(request('',{accountId:'user_One',actor:'user_Attacker',action:'import_provider',connectionId:id,messageId:'own-provider-id'}));assert.equal(response.status,200);assert.deepEqual(f.providerCalls,[{owner:'user_One',connection:id,key:'own-provider-id'}]);
 const auto=fixture();assert.equal((await auto.main.POST(request('',{accountId:'user_One',action:'import_current_dispo',connectionId:id}))).status,200);assert.deepEqual(auto.providerCalls,[{auto:{owner:'user_One',connection:id}}]);
 const prepared=fixture();assert.equal((await prepared.main.POST(request('',{accountId:'user_One',action:'analysis_document',itemId:id}))).status,200);assert.deepEqual(prepared.calls.find(c=>c.analysis).analysis,{owner:'user_One',key:id});
 const denied=fixture({allowed:false});assert.equal((await denied.main.POST(request('',{accountId:'user_One',action:'import_provider',connectionId:id,messageId:'own'}))).status,429);assert.equal(denied.providerCalls.length,0);
 for(const body of [{action:'auto_sync_all'},{action:'import_provider',connectionId:'../other',messageId:'x'},{action:'import_inbound',itemId:'forged'}]){const x=fixture();assert.equal((await x.main.POST(request('',{accountId:'user_One',...body}))).status,400);assert.equal(x.providerCalls.length,0);}
});
test('OAuth start sets an opaque secure HttpOnly cookie and binds one-use state to current session',async()=>{
 const f=fixture(),response=await f.main.POST(request('',{accountId:'user_One',action:'connect',provider:'gmail'}));assert.equal(response.status,200);const cookie=response.headers.get('set-cookie');assert.match(cookie,/__Host-work-mail-oauth/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=lax/i);const saved=f.calls.find(c=>c.action==='oauth_start');assert.equal(saved.owner,'user_One');assert.equal(saved.p.sessionHash,common.workMailHash('sess_Fixture'));
});
test('OAuth callback consumes bound state before exchanging code and stores only sealed tokens',async()=>{
 const f=fixture(),req=request('/oauth/gmail/callback?state=fixture&code=one-use-code',undefined,{Cookie:'__Host-work-mail-oauth=opaque-fixture'});const response=await f.callback.GET(req,{params:Promise.resolve({provider:'gmail'})});assert.equal(response.status,307);assert.match(response.headers.get('location'),/^https:\/\/www\.cinegenius\.co\/work\/mail\?connected=1$/);const actions=f.calls.map(c=>typeof c==='string'?c:c.action);assert.ok(actions.indexOf('oauth_consume')<actions.indexOf('exchange'));const saved=f.calls.find(c=>c.action==='connection_save');assert.equal(saved.p.encryptedTokens,'encrypted-fixture-token');assert.equal(saved.owner,'user_One');
 const expired=fixture({rpcError:new common.WorkMailError('notAllowed',403)});assert.equal((await expired.callback.GET(req,{params:Promise.resolve({provider:'gmail'})})).status,403);assert.ok(!expired.calls.includes('exchange'));
});
test('original/selected file download is inert, owner-bound, hashed and does not redirect to storage/provider URLs',async()=>{
 const f=fixture(),response=await f.file.GET(request('/items/'+id+'/file'),{params:Promise.resolve({id})});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/octet-stream');assert.match(response.headers.get('content-disposition'),/^attachment/);assert.equal(response.headers.get('x-content-sha256'),common.workMailHash('Own'));assert.equal(await response.text(),'Own');assert.match(response.headers.get('content-security-policy'),/sandbox/);assert.deepEqual(f.calls.find(c=>c.file).file,{owner:'user_One',key:id});
 const bad=fixture();assert.equal((await bad.file.GET(request('/items/'+id+'/file?attachment=https%3A%2F%2Fevil.test'),{params:Promise.resolve({id})})).status,400);assert.equal(bad.providerCalls.length,0);
});
test('signed Resend delivery resolves one private alias and duplicate delivery performs no provider request',async()=>{
 const secret='whsec_'+Buffer.from('fixture-signature-secret-only').toString('base64');const prior={status:'ready'};
 const old={key:process.env.WORK_MAIL_RESEND_WEBHOOK_SECRET,domain:process.env.WORK_MAIL_RECEIVING_DOMAIN};process.env.WORK_MAIL_RESEND_WEBHOOK_SECRET=secret;process.env.WORK_MAIL_RECEIVING_DOMAIN='eingang.cinegenius.co';
 try{const payload=JSON.stringify({type:'email.received',data:{email_id:id,to:['cg-'+'a'.repeat(48)+'@eingang.cinegenius.co']}}),timestamp=new Date(),svixId='msg_fixture';const signature=new Webhook(secret).sign(svixId,timestamp,payload);const signed=()=>new NextRequest('https://www.cinegenius.co/api/webhooks/work-mail',{method:'POST',body:payload,headers:{'svix-id':svixId,'svix-timestamp':String(Math.floor(timestamp.getTime()/1000)),'svix-signature':signature}});
 const f=fixture({prior});assert.equal((await f.webhook.POST(signed())).status,200);assert.equal(f.providerCalls.length,0);assert.equal(f.calls.find(c=>c.action==='item_find').owner,'user_One');
 const invalid=fixture();assert.equal((await invalid.webhook.POST(new NextRequest('https://www.cinegenius.co/api/webhooks/work-mail',{method:'POST',body:payload}))).status,400);assert.equal(invalid.calls.length,0);assert.equal(invalid.providerCalls.length,0);
 }finally{for(const [env,value]of [['WORK_MAIL_RESEND_WEBHOOK_SECRET',old.key],['WORK_MAIL_RECEIVING_DOMAIN',old.domain]]){if(value===undefined)delete process.env[env];else process.env[env]=value;}}
});

test('large private originals are streamed in bounded chunks without changing byte size or digest',async()=>{
 const bytes=Buffer.alloc(5*1024*1024,7),f=fixture({fileBytes:bytes}),response=await f.file.GET(request('/items/'+id+'/file'),{params:Promise.resolve({id})});
 assert.equal(response.status,200);const reader=response.body.getReader();let total=0,chunks=0;
 while(true){const part=await reader.read();if(part.done)break;assert.ok(part.value.length<=65536);total+=part.value.length;chunks++;}
 assert.equal(total,bytes.length);assert.ok(chunks>1);assert.equal(response.headers.get('content-length'),String(bytes.length));assert.equal(response.headers.get('x-content-sha256'),common.workMailHash(bytes));
});
