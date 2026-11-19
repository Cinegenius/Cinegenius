import test from 'node:test';
import assert from 'node:assert/strict';
import {createShotsClient,parseShotsFeed,parseShotsRequest,parseClientShot,mergeShotsPage,ShotsClientError} from './shots-client.ts';
import {SHOT_LIFETIME_MS,SHOTS_CONTRACT} from './shots.ts';

const id='00000000-0000-4000-8000-000000000001',requestId='00000000-0000-4000-8000-000000000002',other='00000000-0000-4000-8000-000000000003';
const now='2026-11-19T12:00:00.000Z',createdAt='2026-11-19T11:00:00.000Z',expiresAt=new Date(Date.parse(createdAt)+SHOT_LIFETIME_MS).toISOString();
const shot=(changes={})=>({id,requestId,createdAt,expiresAt,audience:'community',format:'portrait',look:'film',grain:20,isMine:true,width:1200,height:1600,media:{full:`/api/shots/${id}/media/full`,thumbnail:`/api/shots/${id}/media/thumbnail`},...changes});
const envelope=(changes={})=>({contract:SHOTS_CONTRACT,accountId:'account-a',serverNow:now,capabilities:{read:true,publish:true,homiesRead:true},...changes});
const publication=()=>({requestId,photo:{blob:new Blob(['normalized-pixels'],{type:'image/jpeg'}),width:1200,height:1600},audience:'community',format:'portrait',look:'film',grain:20});
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});

test('feed accepts only current-account v1 envelopes and canonical unexpired 30-hour media',()=>{
 const value=envelope({items:[shot()],nextCursor:'opaque-cursor'});const parsed=parseShotsFeed(value,'account-a');assert.equal(parsed.items[0].id,id);assert.equal(parsed.nextCursor,'opaque-cursor');
 for(const changes of [{contract:'wrong'},{accountId:'account-b'},{serverNow:'tomorrow'},{capabilities:{read:false,publish:false,homiesRead:false}},{items:[shot(),shot()]},{nextCursor:''}])assert.throws(()=>parseShotsFeed({...value,...changes},'account-a'),ShotsClientError);
 assert.throws(()=>parseShotsFeed({...value,items:Array.from({length:25},()=>shot())},'account-a'));
});

test('owner photos also expire; malformed dates, private request projection and arbitrary media URLs fail closed',()=>{
 for(const changes of [{expiresAt:now},{expiresAt:new Date(Date.parse(createdAt)+31*3600_000).toISOString()},{createdAt:'2026-02-30T11:00:00.000Z'},{requestId:'bad'},{isMine:false},{width:1601},{media:{full:'https://other.invalid/private.jpg',thumbnail:`/api/shots/${id}/media/thumbnail`}},{grain:101},{format:'square'}])assert.throws(()=>parseClientShot(shot(changes),now),ShotsClientError);
 assert.equal(parseClientShot(shot({isMine:false,requestId:null}),now).requestId,null);
 assert.throws(()=>parseClientShot(shot(),'invalid'),ShotsClientError);
});

test('publishing sends only the prepared photo, explicit audience and stable request id with account headers',async()=>{
 const calls=[];const client=createShotsClient('account-a',async(url,init)=>{calls.push({url,init});return response(envelope({status:'published',requestId,item:shot()}),201);});
 const result=await client.publish(publication());assert.equal(result.status,'published');assert.equal(result.item.id,id);assert.equal(calls.length,1);
 const {url,init}=calls[0];assert.equal(url,'/api/shots');assert.equal(init.method,'POST');assert.equal(init.cache,'no-store');assert.equal(init.credentials,'same-origin');assert.equal(init.redirect,'error');
 assert.equal(init.headers['X-Shots-Account'],'account-a');assert.equal(init.headers['X-CineGenius-Shots-Contract'],SHOTS_CONTRACT);
 assert.deepEqual([...init.body.keys()],['photo','requestId','audience','format','look','grain']);assert.equal(init.body.get('photo').name,'shot.jpg');assert.equal(init.body.get('photo').type,'image/jpeg');assert.equal(init.body.get('requestId'),requestId);
});

test('a publish ACK cannot claim success for another request, audience, account or expiry',async()=>{
 for(const changes of [{requestId:other},{accountId:'account-b'},{item:shot({audience:'homies'})},{item:shot({expiresAt:now})},{status:'deleted',item:null}]){
  const client=createShotsClient('account-a',async()=>response(envelope({status:'published',requestId,item:shot(),...changes})));
  await assert.rejects(client.publish(publication()),error=>error instanceof ShotsClientError&&error.uncertain===true);
 }
 const client=createShotsClient('account-a',async()=>response(envelope({status:'pending',requestId,item:null}),202));assert.equal((await client.publish(publication())).status,'pending');
});

test('manual status uses the same account/request id; expired/deleted statuses never retain media',async()=>{
 for(const status of ['absent','pending','expired','deleted'])assert.equal(parseShotsRequest(envelope({status,requestId,item:null}),'account-a',requestId).item,null);
 assert.throws(()=>parseShotsRequest(envelope({status:'expired',requestId,item:shot()}),'account-a',requestId));
 const urls=[];const client=createShotsClient('account-a',async(url)=>{urls.push(url);return response(envelope({status:'published',requestId,item:shot(),retryAllowed:false}));});assert.equal((await client.status(requestId)).item.id,id);assert.deepEqual(urls,[`/api/shots/requests/${requestId}`]);
});

test('unavailable/error responses are not converted to fake empty feeds, and owner delete needs a matching ACK',async()=>{
 const unavailable=createShotsClient('account-a',async()=>response(envelope({error:{code:'unavailable'}}),503));await assert.rejects(unavailable.feed('community',null),error=>error.code==='unavailable'&&error.status===503);
 const gone=createShotsClient('account-a',async()=>response(envelope({error:{code:'expired'}}),410));await assert.rejects(gone.detail(id),error=>error.code==='expired');
 for(const changes of [{id:other},{accountId:'account-b'},{deleted:false}]){const client=createShotsClient('account-a',async()=>response(envelope({id,deleted:true,purgePending:true,...changes})));await assert.rejects(client.remove(id));}
 const client=createShotsClient('account-a',async(url,init)=>{assert.equal(url,`/api/shots/${id}`);assert.equal(init.method,'DELETE');return response(envelope({id,deleted:true,purgePending:true}));});assert.deepEqual(await client.remove(id),{id,deleted:true});
});

test('a Homies request cannot accept a differently scoped community feed',async()=>{
 const client=createShotsClient('account-a',async()=>response(envelope({items:[shot()],nextCursor:null})));
 await assert.rejects(client.feed('homies',null),error=>error.code==='invalid_response');
});

test('late reads after an aborted session request are rejected even if a transport ignores abort',async()=>{
 let finish;const transport=new Promise(resolve=>{finish=resolve;});const client=createShotsClient('account-a',async()=>transport),controller=new AbortController();
 const pending=client.feed('homies',null,controller.signal);controller.abort();finish(response(envelope({items:[shot()],nextCursor:null})));await assert.rejects(pending,error=>error.name==='AbortError');
});

test('page merging keeps ids stable, removes expired media and bounds resident items',()=>{
 const before=[shot()];const merged=mergeShotsPage(before,[shot({grain:21})],now);assert.equal(merged.length,1);assert.equal(merged[0].grain,21);assert.equal(before[0].grain,20);
 assert.equal(mergeShotsPage([shot({expiresAt:now})],[],now).length,0);
 const many=Array.from({length:150},(_,n)=>shot({id:`item-${n}`}));assert.equal(mergeShotsPage([],many,now).length,120);
});


test('retry permission requires a fresh explicit status flag and cannot be attached to published/expired records',async()=>{
 for(const status of ['absent','pending']){const result=parseShotsRequest(envelope({status,requestId,item:null,retryAllowed:true}),'account-a',requestId,true);assert.equal(result.retryAllowed,true);}
 for(const status of ['expired','deleted'])assert.throws(()=>parseShotsRequest(envelope({status,requestId,item:null,retryAllowed:true}),'account-a',requestId,true));
 assert.throws(()=>parseShotsRequest(envelope({status:'published',requestId,item:shot(),retryAllowed:true}),'account-a',requestId,true));
 const client=createShotsClient('account-a',async()=>response(envelope({status:'pending',requestId,item:null})));await assert.rejects(client.status(requestId));
});
