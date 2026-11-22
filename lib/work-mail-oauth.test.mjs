import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const require=createRequire(import.meta.url),mod={exports:{}};
const source=ts.transpileModule(readFileSync(new URL('./work-mail-oauth.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(source.diagnostics.length,0);new Function('require','module','exports',source.outputText)(id=>id==='server-only'?{}:require(id),mod,mod.exports);
const api=mod.exports,connectionId='10000000-0000-4000-8000-000000000001',gmailScope='https://www.googleapis.com/auth/gmail.readonly',graphScope='https://graph.microsoft.com/Mail.Read';
const env={WORK_MAIL_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),WORK_MAIL_GOOGLE_CLIENT_ID:'fixture-google-client',WORK_MAIL_GOOGLE_CLIENT_SECRET:'fixture-google-secret',WORK_MAIL_MICROSOFT_CLIENT_ID:'fixture-microsoft-client',WORK_MAIL_MICROSOFT_CLIENT_SECRET:'fixture-microsoft-secret'};
const binding={provider:'gmail',accountId:'actor',connectionId},now=1800000000000;
const tokens={accessToken:'fixture-access-token',refreshToken:'fixture-refresh-token',expiresAt:now+3600000,scope:[gmailScope]};
const authorization=(provider='gmail')=>{const start=api.createWorkMailAuthorization({...binding,provider,sessionId:'session_actor',env,now});return {start,verified:api.verifyWorkMailAuthorization({provider,accountId:'actor',sessionId:'session_actor',stateCookie:start.stateCookie,stateToken:start.stateToken,env,now:now+1000})};};
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json',...headers}});
const rejected=(fn,code)=>assert.rejects(fn,error=>error instanceof api.WorkMailOAuthError&&error.code===code);
function transport(responses){const calls=[];return {calls,fetch:async(url,init)=>{calls.push({url:new URL(url),init});assert.ok(['https://oauth2.googleapis.com','https://login.microsoftonline.com','https://gmail.googleapis.com','https://graph.microsoft.com'].includes(new URL(url).origin));assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');assert.ok(init.signal instanceof AbortSignal);const response=typeof responses==='function'?await responses(new URL(url),init,calls.length):responses.shift();if(!response)throw new Error('Unexpected fixture request');return response;}};}

test('providers are independently unavailable without real credentials and reject arbitrary callback hosts',()=>{
 assert.equal(api.workMailProviderReady('gmail',env),true);assert.equal(api.workMailProviderReady('microsoft',env),true);
 assert.equal(api.workMailProviderReady('gmail',{...env,WORK_MAIL_GOOGLE_CLIENT_ID:undefined}),false);
 assert.equal(api.workMailProviderReady('microsoft',{...env,WORK_MAIL_GOOGLE_CLIENT_ID:undefined}),true);
 for(const patch of [{WORK_MAIL_ENCRYPTION_KEY:'wrong'},{WORK_MAIL_PUBLIC_ORIGIN:'https://attacker.invalid'},{WORK_MAIL_PUBLIC_ORIGIN:'https://www.cinegenius.co/evil'},{WORK_MAIL_ENCRYPTION_KEY:Buffer.alloc(16).toString('base64')}])assert.equal(api.workMailProviderReady('gmail',{...env,...patch}),false);
});
test('authorization uses exact read-only scopes and S256 PKCE; encrypted state binds current Clerk account/session/provider and expires',()=>{
 for(const provider of ['gmail','microsoft']){
  const {start,verified}=authorization(provider),url=new URL(start.url);
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('code_challenge'),createHash('sha256').update(verified.codeVerifier).digest('base64url'));
  assert.equal(url.searchParams.get('scope'),provider==='gmail'?gmailScope:graphScope+' offline_access');assert.equal(url.searchParams.get('response_type'),'code');
  assert.equal(verified.redirectUri,`https://www.cinegenius.co/api/work/mail/oauth/${provider}/callback`);
  assert.equal(start.stateHash,createHash('sha256').update(start.stateToken).digest('hex'));assert.equal(verified.connectionId,connectionId);
  assert.ok(!start.stateCookie.includes('actor'));assert.ok(!start.stateCookie.includes(verified.codeVerifier));assert.ok(!start.stateCookie.includes(env.WORK_MAIL_GOOGLE_CLIENT_SECRET));
  const input={provider,accountId:'actor',sessionId:'session_actor',stateCookie:start.stateCookie,stateToken:start.stateToken,env,now:now+1000};
  for(const patch of [{accountId:'other'},{sessionId:'other-session'},{provider:provider==='gmail'?'microsoft':'gmail'},{stateToken:'x'.repeat(43)},{now:now+600001},{now:now-31000},{now:NaN},{stateCookie:start.stateCookie.slice(0,-3)+'abc'}])assert.throws(()=>api.verifyWorkMailAuthorization({...input,...patch}),e=>e.code==='invalid_state');
 }
 assert.notEqual(authorization().start.stateToken,authorization().start.stateToken);
});
test('opaque token encryption resists account, provider, connection, key and ciphertext swaps; property order is irrelevant',()=>{
 const sealed=api.sealWorkMailToken(tokens,binding,env);assert.match(sealed,/^v1\./);assert.ok(!sealed.includes(tokens.refreshToken));assert.deepEqual(api.unsealWorkMailToken(sealed,{connectionId,provider:'gmail',accountId:'actor'},env),tokens);
 assert.notEqual(sealed,api.sealWorkMailToken(tokens,binding,env));
 for(const patch of [{accountId:'other'},{provider:'microsoft'},{connectionId:'20000000-0000-4000-8000-000000000001'}])assert.throws(()=>api.unsealWorkMailToken(sealed,{...binding,...patch},env),e=>e.code==='invalid_token');
 assert.throws(()=>api.unsealWorkMailToken(sealed,binding,{...env,WORK_MAIL_ENCRYPTION_KEY:Buffer.alloc(32,8).toString('base64')}),e=>e.code==='invalid_token');
 assert.throws(()=>api.unsealWorkMailToken(sealed.slice(0,-3)+'abc',binding,env),e=>e.code==='invalid_token');
});
test('code exchange sends confidential values only to the fixed provider token endpoint and requires offline refresh consent',async()=>{
 for(const provider of ['gmail','microsoft']){
  const t=transport([json({access_token:'new-access',refresh_token:'new-refresh',token_type:'Bearer',expires_in:3600,scope:provider==='gmail'?gmailScope:'Mail.Read offline_access'})]);
  const {verified}=authorization(provider);const result=await api.exchangeWorkMailCode({authorization:verified,code:'fixture-code',env,now,...t});
  assert.equal(result.refreshToken,'new-refresh');assert.equal(result.expiresAt,now+3600000);
  const call=t.calls[0],body=new URLSearchParams(call.init.body);assert.equal(call.url.origin,provider==='gmail'?'https://oauth2.googleapis.com':'https://login.microsoftonline.com');assert.equal(body.get('code_verifier'),verified.codeVerifier);assert.equal(body.get('grant_type'),'authorization_code');assert.equal(body.get('redirect_uri'),verified.redirectUri);assert.ok(!call.url.href.includes('secret'));
 }
 const t=transport([json({access_token:'access',token_type:'Bearer',expires_in:3600,scope:gmailScope})]);await rejected(()=>api.exchangeWorkMailCode({authorization:authorization().verified,code:'code',env,...t}),'provider_reauthorization_required');
});
test('refresh preserves Google refresh tokens, rotates Microsoft tokens and never broadens mail permissions',async()=>{
 const google=transport([json({access_token:'next',token_type:'Bearer',expires_in:60})]);const next=await api.refreshWorkMailToken({provider:'gmail',tokens,env,now,...google});assert.equal(next.refreshToken,tokens.refreshToken);assert.deepEqual(next.scope,[gmailScope]);assert.equal(new URLSearchParams(google.calls[0].init.body).get('grant_type'),'refresh_token');
 const ms=transport([json({access_token:'next',refresh_token:'rotated',token_type:'Bearer',expires_in:60,scope:'Mail.Read offline_access'})]);assert.equal((await api.refreshWorkMailToken({provider:'microsoft',tokens:{...tokens,scope:[graphScope,'offline_access']},env,now,...ms})).refreshToken,'rotated');
 for(const scope of ['Mail.Read Mail.Send','Mail.ReadWrite','https://mail.google.com/']){const p=scope.startsWith('http')?'gmail':'microsoft',t=transport([json({access_token:'next',refresh_token:'new',token_type:'Bearer',expires_in:60,scope})]);await rejected(()=>api.refreshWorkMailToken({provider:p,tokens:{...tokens,scope:p==='gmail'?[gmailScope]:[graphScope]},env,...t}),'invalid_token');}
});
test('provider failures, invalid grants, redirects, non-JSON and cancellation are stable redacted errors',async()=>{
 const a=authorization().verified;
 for(const [response,code]of [[json({error:'invalid_grant',error_description:'PRIVATE TOKEN'},400),'provider_reauthorization_required'],[json({error:'invalid_client',error_description:'PRIVATE SECRET'},400),'provider_unconfigured'],[new Response('PRIVATE',{status:302,headers:{location:'https://attacker.invalid'}}),'provider_redirect'],[new Response('<PRIVATE>',{headers:{'content-type':'text/html'}}),'invalid_provider_response'],[json({error:'PRIVATE'},503),'provider_unavailable']]){const t=transport([response]);await rejected(()=>api.exchangeWorkMailCode({authorization:a,code:'own',env,...t}),code);assert.equal(t.calls.length,1);}
 const abort=new AbortController();abort.abort();const t=transport([json({})]);await rejected(()=>api.exchangeWorkMailCode({authorization:a,code:'own',env,signal:abort.signal,...t}),'provider_cancelled');
});
const gmailFull={id:'gmail-message',internalDate:String(now),payload:{partId:'',mimeType:'multipart/mixed',headers:[{name:'Subject',value:'Own subject'},{name:'From',value:'Person <sender@example.invalid>'}],parts:[{partId:'0',mimeType:'text/plain',body:{data:Buffer.from('Own plain text').toString('base64url'),size:14}},{partId:'1',filename:'Own.pdf',mimeType:'application/pdf',body:{attachmentId:'gmail-attachment',size:5}}]}};
test('Gmail list reads bounded envelope metadata without fetching raw or message bodies and preserves a real page cursor',async()=>{
 const t=transport([json({messages:[{id:'gmail-message'}],nextPageToken:'opaque-page'}),json(gmailFull)]);const list=await api.listWorkMailMessages({provider:'gmail',accessToken:'access',...t});
 assert.equal(list.messages[0].subject,'Own subject');assert.equal(list.messages[0].hasAttachments,true);assert.equal(list.cursor,'opaque-page');assert.equal(t.calls.length,2);assert.ok(t.calls.every(c=>!c.url.href.includes('format=raw')));assert.ok(t.calls[1].url.searchParams.get('fields').includes('body(attachmentId,size)'));assert.ok(!t.calls[1].url.searchParams.get('fields').includes('data'));
});
test('Graph pagination uses full provider nextLink while refusing foreign hosts, resource changes, expand/body additions and malformed IDs',async()=>{
 const next='https://graph.microsoft.com/v1.0/me/messages?$skip=10&$top=10&$select='+encodeURIComponent('id,subject,from,receivedDateTime,hasAttachments')+'&$orderby=receivedDateTime%20desc';
 const t=transport([json({value:[{id:'AA+id/=',subject:'Own',from:{emailAddress:{address:'sender@example.invalid'}},receivedDateTime:'2026-11-22T10:00:00Z',hasAttachments:false}],'@odata.nextLink':next})]);
 const list=await api.listWorkMailMessages({provider:'microsoft',accessToken:'access',...t});assert.equal(list.cursor,new URL(next).href);assert.equal(t.calls[0].url.searchParams.get('$top'),'10');assert.ok(t.calls[0].init.headers.Prefer.includes('ImmutableId'));
 for(const cursor of ['https://attacker.invalid/v1.0/me/messages','https://graph.microsoft.com/v1.0/users/other/messages','https://graph.microsoft.com/v1.0/me/messages?$expand=attachments','https://graph.microsoft.com/v1.0/me/messages?$select=body','https://graph.microsoft.com/v1.0/me/messages?$top=1000']){const f=transport([]);await rejected(()=>api.listWorkMailMessages({provider:'microsoft',accessToken:'access',cursor,...f}),'invalid_provider_response');assert.equal(f.calls.length,0);}
 const f=transport([]);await rejected(()=>api.getWorkMailRaw({provider:'gmail',accessToken:'access',messageId:'../../users/other',...f}),'invalid_message');assert.equal(f.calls.length,0);
});
test('selected Gmail message keeps exact EML bytes and extracts only text/plain; selected attachments stay in that message',async()=>{
 const raw=Buffer.from('From: own@example.invalid\r\nSubject: Original\r\n\r\nExact original\r\n');
 const t=transport([json({id:'gmail-message',raw:raw.toString('base64url')}),json(gmailFull)]);const selected=await api.getWorkMailRaw({provider:'gmail',accessToken:'access',messageId:'gmail-message',...t});assert.deepEqual(selected.raw,raw);assert.equal(selected.text,'Own plain text');assert.deepEqual(selected.attachments,[{id:'1',name:'Own.pdf',type:'application/pdf',size:5}]);
 const a=transport([json(gmailFull),json({data:Buffer.from('%PDF-').toString('base64url'),size:5})]);const file=await api.getWorkMailAttachment({provider:'gmail',accessToken:'access',messageId:'gmail-message',attachmentId:'1',...a});assert.equal(file.bytes.toString(),'%PDF-');assert.match(a.calls[1].url.pathname,/\/messages\/gmail-message\/attachments\/gmail-attachment$/);
 const absent=transport([json(gmailFull)]);await rejected(()=>api.getWorkMailAttachment({provider:'gmail',accessToken:'access',messageId:'gmail-message',attachmentId:'999',...absent}),'attachment_unavailable');assert.equal(absent.calls.length,1);
});
test('selected Graph mail returns exact MIME and plain text, never follows reference attachments or provider redirects',async()=>{
 const raw=Buffer.from('Own original\r\n');const summary={id:'AA/id=',subject:'Own',receivedDateTime:'2026-11-22T10:00:00Z',hasAttachments:true,body:{contentType:'text',content:'Own text'}};
 const t=transport([json(summary),new Response(raw,{headers:{'content-type':'message/rfc822'}}),json({value:[{'@odata.type':'#microsoft.graph.fileAttachment',id:'file-id',name:'Own.pdf',contentType:'application/pdf',size:5}]})]);
 const mail=await api.getWorkMailRaw({provider:'microsoft',accessToken:'access',messageId:'AA/id=',...t});assert.deepEqual(mail.raw,raw);assert.equal(mail.text,'Own text');assert.equal(mail.attachments[0].id,'file-id');assert.ok(t.calls[0].url.pathname.includes('AA%2Fid%3D'));
 const attachment=transport([json({'@odata.type':'#microsoft.graph.fileAttachment',id:'file-id',name:'../Own.pdf',contentType:'application/pdf',size:5}),new Response('%PDF-')]);const file=await api.getWorkMailAttachment({provider:'microsoft',accessToken:'access',messageId:'AA/id=',attachmentId:'file-id',...attachment});assert.equal(file.bytes.toString(),'%PDF-');assert.equal(file.name,'.._Own.pdf');
 const reference=transport([json({'@odata.type':'#microsoft.graph.referenceAttachment',sourceUrl:'https://attacker.invalid/private'})]);await rejected(()=>api.getWorkMailAttachment({provider:'microsoft',accessToken:'access',messageId:'own',attachmentId:'ref',...reference}),'unsupported_attachment');assert.equal(reference.calls.length,1);
});
test('raw and attachment limits reject excessive headers, streams and malformed base64 without preserving partial output',async()=>{
 const meta={id:'own',body:{contentType:'text',content:'Own'},hasAttachments:false};const declared=transport([json(meta),new Response('',{headers:{'content-length':String(api.WORK_MAIL_MAX_RAW_BYTES+1)}})]);await rejected(()=>api.getWorkMailRaw({provider:'microsoft',accessToken:'access',messageId:'own',...declared}),'message_too_large');
 let cancelled=false;const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(api.WORK_MAIL_MAX_RAW_BYTES+1));},cancel(){cancelled=true;}});const chunked=transport([json(meta),new Response(stream)]);await rejected(()=>api.getWorkMailRaw({provider:'microsoft',accessToken:'access',messageId:'own',...chunked}),'message_too_large');assert.equal(cancelled,true);
 const bad=transport([json({raw:'not+base64url!'}),json(gmailFull)]);await rejected(()=>api.getWorkMailRaw({provider:'gmail',accessToken:'access',messageId:'own',...bad}),'invalid_provider_response');
 const oversized=transport([json({'@odata.type':'#microsoft.graph.fileAttachment',size:api.WORK_MAIL_MAX_ATTACHMENT_BYTES+1})]);await rejected(()=>api.getWorkMailAttachment({provider:'microsoft',accessToken:'access',messageId:'own',attachmentId:'file',...oversized}),'message_too_large');assert.equal(oversized.calls.length,1);
});
test('disconnect honestly revokes Google project access; Microsoft is manual remote revocation without broad session-revoke scope',async()=>{
 const gmail=transport([new Response('',{status:200})]);const g=await api.revokeWorkMailToken({provider:'gmail',refreshToken:'own-refresh',...gmail});assert.equal(g.remoteRevoked,true);assert.equal(gmail.calls[0].url.href,'https://oauth2.googleapis.com/revoke');assert.equal(gmail.calls[0].init.method,'POST');assert.equal(new URLSearchParams(gmail.calls[0].init.body).get('token'),'own-refresh');
 const ms=transport([]);const m=await api.revokeWorkMailToken({provider:'microsoft',tokens:{...tokens,scope:[graphScope]},...ms});assert.equal(m.remoteRevoked,false);assert.equal(m.manualRequired,true);assert.equal(ms.calls.length,0);assert.equal(m.manageUrls.length,2);
});

test('a top-level Gmail file uses a stable nonempty root attachment ID',async()=>{
 const full={...gmailFull,payload:{partId:'',filename:'Root.pdf',mimeType:'application/pdf',headers:gmailFull.payload.headers,body:{data:Buffer.from('%PDF-').toString('base64url'),size:5}}};
 const selected=transport([json({raw:Buffer.from('Own original').toString('base64url')}),json(full)]);
 const result=await api.getWorkMailRaw({provider:'gmail',accessToken:'access',messageId:'gmail-message',...selected});assert.equal(result.attachments[0].id,'root');
 const fetched=transport([json(full)]);const attachment=await api.getWorkMailAttachment({provider:'gmail',accessToken:'access',messageId:'gmail-message',attachmentId:'root',...fetched});assert.equal(attachment.bytes.toString(),'%PDF-');assert.equal(fetched.calls.length,1);
});
