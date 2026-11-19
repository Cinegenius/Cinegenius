import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {shotsFixture,shotRequest} from './shots-test-fixture.mjs';
let f,photo;
before(async()=>{f=await shotsFixture();photo=await sharp({create:{width:400,height:250,channels:3,background:{r:30,g:70,b:90}}}).png().toBuffer()});after(async()=>f?.close());
const tx=async run=>{await f.pg.exec('BEGIN');f.state.actor='alice';f.state.upload='ok';f.state.remove='ok';f.state.rate=true;f.state.privateBucket=true;f.state.onDownload=null;f.objects.clear();f.calls.length=0;try{await run()}finally{await f.pg.exec('ROLLBACK')}};
function multipart(requestId=randomUUID(),extra={}){const form=new FormData();for(const[k,v]of Object.entries({requestId,audience:'community',format:'landscape',look:'bw',grain:'45',...extra}))form.set(k,v);form.set('photo',new File([photo],'photo.png',{type:'image/png'}));return{requestId,form}}
async function publish(requestId,extra){const p=multipart(requestId,extra);const response=await f.api.shotsPublishRoute(shotRequest('/api/shots','alice',{method:'POST',body:p.form}));return{response,data:await response.json(),requestId:p.requestId}}
async function expire(id){await f.pg.query("UPDATE shots_private.shots SET published_at=now()-interval '30 hours 1 second',expires_at=now()-interval '1 second' WHERE id=$1",[id]);await f.pg.query("UPDATE shots_private.cleanup SET due_at=now()-interval '1 second' WHERE shot_id=$1",[id])}
test('publish normalizes its own master+thumbnail and confirms30h with private paths',()=>tx(async()=>{
 const {response,data}=await publish();assert.equal(response.status,201);assert.equal(data.contract,'cinegenius.shots.v1');assert.equal(data.accountId,'alice');assert.equal(data.status,'published');assert.equal(data.item.isMine,true);assert.equal(data.item.width,400);assert.equal(data.item.height,250);assert.equal(Date.parse(data.item.expiresAt)-Date.parse(data.item.createdAt),108000000);assert.match(data.serverNow,/\.\d{3}Z$/);assert.equal(f.objects.size,2);assert.equal(data.item.media.full,`/api/shots/${data.item.id}/media/full`);assert.doesNotMatch(JSON.stringify(data),/storage\/|signed|bucket|sha256/);assert.match(response.headers.get('cache-control'),/no-store/);
 const got=await f.api.shotsMediaRoute(new Request('https://cinegenius.co'+data.item.media.full),data.item.id,'full');assert.equal(got.status,200);assert.equal(got.headers.get('content-type'),'image/webp');assert.match(got.headers.get('cache-control'),/no-store/);
}));
test('samepayload replay retainsid/expiry without second assetset and rejects changedbytes',()=>tx(async()=>{
 const requestId=randomUUID(),first=await publish(requestId),second=await publish(requestId);assert.equal(second.response.status,200);assert.equal(second.data.item.id,first.data.item.id);assert.equal(second.data.item.expiresAt,first.data.item.expiresAt);assert.equal(f.calls.filter(c=>c.kind==='upload').length,2);assert.equal((await publish(requestId,{grain:'46'})).response.status,409);
}));
test('lost uploadACK confirms identical bytes instead of overwriting',()=>tx(async()=>{f.state.upload='lost';const r=await publish();assert.equal(r.response.status,201);assert.equal(f.objects.size,2);assert.equal(f.calls.filter(c=>c.kind==='download').length,2)}));
test('unknownoperation stayspending and only expiredlease permits explicitsamepayload recovery',()=>tx(async()=>{
 f.state.upload='fail';const r=await publish();assert.equal(r.response.status,202);assert.equal(r.data.status,'pending');assert.equal(r.data.item,null);let response=await f.api.shotsRequestRoute(shotRequest('/api/shots/requests/'+r.requestId),r.requestId),data=await response.json();assert.equal(data.status,'pending');assert.equal(data.retryAllowed,false);assert.equal(f.objects.size,0);
 await f.pg.query("UPDATE shots_private.shots SET upload_until=now()-interval '1 second' WHERE request_id=$1",[r.requestId]);response=await f.api.shotsRequestRoute(shotRequest('/api/shots/requests/'+r.requestId),r.requestId);data=await response.json();assert.equal(data.retryAllowed,true);f.state.upload='ok';assert.equal((await publish(r.requestId)).response.status,201);assert.equal((await f.pg.query('SELECT count(*) n FROM shots_private.shots')).rows[0].n,1);
}));
test('audiencefeeds separate Homies and redact foreignrequestnonce',()=>tx(async()=>{
 const publicShot=await publish();await publish(undefined,{audience:'homies'});f.state.actor='bob';let response=await f.api.shotsFeedRoute(shotRequest('/api/shots?audience=community','bob')),data=await response.json();assert.equal(response.status,200);assert.equal(data.items.length,1);assert.equal(data.items[0].id,publicShot.data.item.id);assert.equal(data.items[0].requestId,null);response=await f.api.shotsFeedRoute(shotRequest('/api/shots?audience=homies','bob'));assert.equal((await response.json()).items.length,0);
}));
test('expiry afterdownload blocks ownerbytes; deletequeues then verifies physicalcleanup',()=>tx(async()=>{
 const r=await publish(),id=r.data.item.id;f.state.onDownload=async()=>expire(id);const denied=await f.api.shotsMediaRoute(new Request('https://cinegenius.co'+r.data.item.media.full),id,'full');assert.equal(denied.status,404);assert.match(denied.headers.get('content-type'),/json/);f.state.onDownload=null;
 const deletion=await f.api.shotsDeleteRoute(shotRequest('/api/shots/'+id,'alice',{method:'DELETE'}),id),ack=await deletion.json();assert.equal(ack.deleted,true);assert.equal(ack.purgePending,true);assert.equal(f.objects.size,2);assert.equal((await f.cleanup.runShotsCleanup()).purged,1);assert.equal(f.objects.size,0);assert.equal((await (await f.api.shotsDeleteRoute(shotRequest('/api/shots/'+id,'alice',{method:'DELETE'}),id)).json()).purgePending,false);
}));
test('offcapability, accountmismatch, guests and foreignorigin failclosed beforeuploads',()=>tx(async()=>{
 f.state.actor=null;assert.equal((await f.api.shotsFeedRoute(shotRequest('/api/shots?audience=community'))).status,401);f.state.actor='alice';assert.equal((await f.api.shotsFeedRoute(shotRequest('/api/shots?audience=community','bob'))).status,409);let p=multipart();assert.equal((await f.api.shotsPublishRoute(shotRequest('/api/shots','alice',{method:'POST',body:p.form,headers:{Origin:'https://foreign.invalid'}}))).status,403);await f.pg.exec('UPDATE shots_private.config SET enabled=false');p=multipart();assert.equal((await f.api.shotsPublishRoute(shotRequest('/api/shots','alice',{method:'POST',body:p.form}))).status,503);assert.equal(f.objects.size,0);
}));
test('worker rejects missingauth and never reports failedstorage as purged',()=>tx(async()=>{
 const before=f.calls.length;assert.equal((await f.worker.POST(new Request('https://cinegenius.co/api/internal/shots-cleanup',{method:'POST'}))).status,401);assert.equal(f.calls.length,before);const r=await publish();await expire(r.data.item.id);f.state.remove='fail';const result=await f.cleanup.runShotsCleanup();assert.equal(result.purged,0);assert.equal(result.retry,1);assert.equal(f.objects.size,2);assert.equal((await f.pg.query('SELECT count(*) n FROM shots_private.cleanup')).rows[0].n,1);
}));
test('malformed requests, bad media keys and unsupported images never create canonical assets',()=>tx(async()=>{
 for(const url of['/api/shots?audience=community&cursor=invalid','/api/shots?audience=community&audience=homies','/api/shots?audience=community&seed=forged'])assert.equal((await f.api.shotsFeedRoute(shotRequest(url))).status,400);
 for(const variant of['original','../full','thumbnail.webp'])assert.equal((await f.api.shotsMediaRoute(new Request('https://cinegenius.co/api/shots/'+randomUUID()+'/media/'+variant),randomUUID(),variant)).status,404);
 const p=multipart();p.form.set('photo',new File(['<svg><script>bad()</script></svg>'],'unsafe.jpg',{type:'image/jpeg'}));assert.equal((await f.api.shotsPublishRoute(shotRequest('/api/shots','alice',{method:'POST',body:p.form}))).status,415);assert.equal(f.objects.size,0);
 const duplicate=multipart();duplicate.form.append('audience','homies');assert.equal((await f.api.shotsPublishRoute(shotRequest('/api/shots','alice',{method:'POST',body:duplicate.form}))).status,400);f.state.rate=false;assert.equal((await f.api.shotsFeedRoute(shotRequest('/api/shots?audience=community'))).status,429);
}));
test('lost deletion ACK still confirms actual absence while a public bucket cannot produce success',()=>tx(async()=>{
 const r=await publish();await expire(r.data.item.id);f.state.remove='lost';let result=await f.cleanup.runShotsCleanup();assert.equal(result.purged,1);assert.equal(result.healthy,true);assert.equal(f.objects.size,0);
 f.state.privateBucket=false;await assert.rejects(()=>f.cleanup.runShotsCleanup(),/unavailable/);const config=(await f.pg.query('SELECT worker_failed_at FROM shots_private.config')).rows[0];assert.ok(config.worker_failed_at);
}));
test('after worker failure existing readable photos remain available but no new upload can begin',()=>tx(async()=>{
 const r=await publish();await f.pg.exec("UPDATE shots_private.config SET worker_seen_at=clock_timestamp()-interval '11 minutes'");const response=await f.api.shotsFeedRoute(shotRequest('/api/shots?audience=community')),feed=await response.json();assert.equal(response.status,200);assert.equal(feed.items[0].id,r.data.item.id);assert.equal(feed.capabilities.read,true);assert.equal(feed.capabilities.publish,false);const n=f.calls.filter(x=>x.kind==='upload').length;assert.equal((await publish()).response.status,503);assert.equal(f.calls.filter(x=>x.kind==='upload').length,n);assert.equal((await f.api.shotsMediaRoute(new Request('https://cinegenius.co'+r.data.item.media.full),r.data.item.id,'full')).status,200);
}));
