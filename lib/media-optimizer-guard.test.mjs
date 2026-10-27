import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaOptimizerBlockStatus} from './media-optimizer-guard.ts';
import {legacyStorageObject} from './protected-media.ts';
const origin='https://own-fixture.supabase.co',request='https://www.cinegenius.co/_next/image';
test('all guarded local derivatives are excluded from the shared optimizer, including encoded and normalized aliases',async()=>{
 for(const src of ['/api/media/user/a.webp','/api/community-image?image=private','/api//community-image?image=private','/api/example/../community-image?image=private','%2fapi%2fcommunity-image%3Fimage=private'])assert.equal(await mediaOptimizerBlockStatus(src,request,origin,'test-only',()=>{throw Error('Must not fetch');}),404);
});
test('legacy originals and rendered variants consult the same durable journal before shared cached bytes can be returned',async()=>{
 const calls=[];const fetcher=async(url,init)=>{calls.push({url:String(url),init});return new Response('true');};
 for(const src of [origin+'/storage/v1/object/public/listing-images/test%20image.png',origin+'/storage/v1/render/image/public/listing-images/test%20image.png?width=100',origin+'/%73torage/v1/object/public/listing-images/test%20image.png'])assert.equal(await mediaOptimizerBlockStatus(src,request,origin,'test-only',fetcher),404);
 assert.equal(calls.length,3);assert.ok(calls.every(c=>c.init.cache==='no-store'&&c.url===origin+'/rest/v1/rpc/is_legacy_media_retired'));
 assert.deepEqual(JSON.parse(calls[0].init.body),{p_bucket:'listing-images',p_path:'test image.png'});
 assert.equal(await mediaOptimizerBlockStatus(origin+'/storage/v1/object/public/listing-images/public.png',request,origin,'test-only',async()=>new Response('false')),null);
});
test('journal errors fail closed; unrelated public images do not cause credentialed fetches',async()=>{
 const source=origin+'/storage/v1/object/public/listing-images/test.png';
 for(const fetcher of [async()=>new Response('error',{status:500}),async()=>new Response('{}'),async()=>{throw Error('offline');}])assert.equal(await mediaOptimizerBlockStatus(source,request,origin,'test-only',fetcher),503);
 assert.equal(await mediaOptimizerBlockStatus(source,request,origin,undefined),503);
 assert.equal(await mediaOptimizerBlockStatus('https://images.unsplash.com/test.jpg',request,origin,'test-only',()=>{throw Error('Unexpected fetch');}),null);
 assert.equal(legacyStorageObject('https://evil.invalid/storage/v1/object/public/listing-images/test.png',origin),null);
});
