import test from 'node:test';
import assert from 'node:assert/strict';
import {getWorkMailResendRaw,getWorkMailResendAttachment} from './work-mail-resend.ts';
import {mediaOptimizerBlockStatus} from './media-optimizer-guard.ts';
import {workMailDomain,workMailReadBounded,workMailSameOrigin,workMailFilename,workMailAttachmentList,workMailHash} from './work-mail.ts';
const email='10000000-0000-4000-8000-000000000001',attachment='10000000-0000-4000-8000-000000000002';
const raw=Buffer.from('From: external@fixture.invalid\r\nTo: private@fixture.invalid\r\n\r\n<original & exact>\r\n');
const body=(extra={})=>({id:email,raw:{download_url:'https://inbound-cdn.resend.com/receiving/raw/'+email+'?signature=fixture'},subject:'External <script>source</script>',from:'external@fixture.invalid',created_at:'2026-11-22T10:00:00Z',text:null,html:'<script>never display</script>',attachments:[],...extra});
const json=value=>Response.json(value);
test('receiving domain is always a dedicated company subdomain; mutation origin is exact',()=>{
 for(const value of ['cinegenius.co','www.cinegenius.co','evil.test','in.cinegenius.co.evil.test','https://in.cinegenius.co'])assert.equal(workMailDomain({WORK_MAIL_RECEIVING_DOMAIN:value}),null);
 assert.equal(workMailDomain({WORK_MAIL_RECEIVING_DOMAIN:'eingang.cinegenius.co'}),'eingang.cinegenius.co');
 assert.equal(workMailSameOrigin(new Request('https://www.cinegenius.co/api/work/mail',{headers:{Origin:'https://evil.test'}})),false);
 assert.equal(workMailSameOrigin(new Request('https://www.cinegenius.co/api/work/mail',{headers:{Origin:'https://www.cinegenius.co','sec-fetch-site':'same-origin'}})),true);
});
test('verified provider content retrieves exact original without rendering or deriving text from active HTML',async()=>{
 const calls=[];const fetcher=async(url,options)=>{calls.push({url:String(url),options});return calls.length===1?json(body()):new Response(raw);};
 const source=await getWorkMailResendRaw(email,'fixture-only',fetcher);
 assert.deepEqual(source.raw,raw);assert.equal(source.text,null);assert.equal(source.subject,'External <script>source</script>');
 assert.match(calls[0].url,/^https:\/\/api\.resend\.com\/emails\/receiving\//);assert.match(calls[0].url,/html_format=cid/);assert.equal(calls[1].options.headers,undefined);assert.equal(calls[1].options.redirect,'error');
 assert.equal(workMailHash(source.raw),workMailHash(raw));
});
test('provider-returned arbitrary, credentialed, non-TLS and redirect URLs never become attachment fetch targets',async()=>{
 for(const download_url of ['https://evil.test/file','http://inbound-cdn.resend.com/file','https://inbound-cdn.resend.com.evil.test/file','https://user:secret@inbound-cdn.resend.com/file','https://inbound-cdn.resend.com:4433/file','https://inbound-cdn.resend.com/file#fragment']){
  let calls=0;await assert.rejects(()=>getWorkMailResendRaw(email,'fixture-only',async()=>{calls++;return json(body({raw:{download_url}}));}));assert.equal(calls,1);
 }
});
test('selected attachment uses only fixed provider metadata path and bounded matching bytes',async()=>{
 const calls=[];const result=await getWorkMailResendAttachment(email,attachment,'fixture-only',async(url,options)=>{calls.push({url:String(url),options});return calls.length===1?json({id:attachment,filename:'chosen.pdf',content_type:'application/pdf',size:3,download_url:'https://inbound-cdn.resend.com/'+email+'/attachments/'+attachment+'?signature=fixture'}):new Response(Buffer.from([1,2,3]));});
 assert.equal(calls[0].url,`https://api.resend.com/emails/receiving/${email}/attachments/${attachment}`);assert.deepEqual(result.bytes,Buffer.from([1,2,3]));assert.equal(result.size,3);
 await assert.rejects(()=>getWorkMailResendAttachment(email,'../../evil','fixture-only',async()=>{throw Error('must not call');}));
});
test('chunked and declared-size payloads are bounded before persistence; unsupported attachment counts fail closed',async()=>{
 await assert.rejects(()=>workMailReadBounded(new Response('abc',{headers:{'content-length':'100'}}),4),e=>e.status===413);
 const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(3));controller.enqueue(new Uint8Array(3));controller.close();}});
 await assert.rejects(()=>workMailReadBounded(new Response(stream),4),e=>e.status===413);
 assert.throws(()=>workMailAttachmentList(Array.from({length:21},(_,i)=>({id:String(i),name:'Own',type:'text/plain',size:1}))));
 assert.doesNotMatch(workMailFilename('../bad\r\n"<name>.pdf'),/[\r\n"<>\/\\]/);
});

test('private mail originals and selected attachments never enter the shared image optimizer',async()=>{
 for(const path of ['/api/work/mail/items/'+email+'/file','%252Fapi%252Fwork%252Fmail%252Fitems%252F'+email+'%252Ffile','/api/example/../work/mail/items/'+email+'/file?attachment='+'a'.repeat(64)])assert.equal(await mediaOptimizerBlockStatus(path,'https://www.cinegenius.co/_next/image','https://fixture.supabase.co','fixture-only',()=>{throw Error('No private mail fetch');}),404);
});

test('missing provider receipt dates are rejected instead of inventing source dates',async()=>{
 let calls=0;await assert.rejects(()=>getWorkMailResendRaw(email,'fixture-only',async()=>{calls++;return json(body({created_at:'not-a-date'}));}),e=>e.code==='providerUnavailable');assert.equal(calls,1);
});

test('receiving API recipient must agree with the signed alias before any private original download',async()=>{
 let calls=0;await assert.rejects(()=>getWorkMailResendRaw(email,'fixture-only',async()=>{calls++;return json(body({to:['another@eingang.cinegenius.co']}));},'cg-'+ 'a'.repeat(48)+'@eingang.cinegenius.co'),e=>e.code==='providerUnavailable');assert.equal(calls,1);
});
