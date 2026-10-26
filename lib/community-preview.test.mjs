import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { communityPreviewUrl } from './community-preview.ts';
import { resizeCommunityPreview, readPreviewSource, cachedCommunityPreview, PREVIEW_SOURCE_MAX_BYTES } from './community-preview-server.ts';
import * as media from './community-media.ts';
const require = createRequire(import.meta.url);

test('previews bound both image edges without distortion, enlargement or original passthrough', async () => {
  const source = await sharp({ create: { width: 2400, height: 1600, channels: 4, background: '#abcdef' } }).png().toBuffer();
  for (const [size, width, height] of [['thumbnail',640,427],['detail',1600,1067]]) {
    const output = await resizeCommunityPreview(source,size);
    const result = await sharp(output).metadata();
    assert.equal(result.format,'webp');assert.equal(result.width,width);assert.equal(result.height,height);
  }
  const small = await sharp({create:{width:32,height:64,channels:4,background:'#0000'}}).png().toBuffer();
  const result = await sharp(await resizeCommunityPreview(small,'thumbnail')).metadata();
  assert.equal(result.width,32);assert.equal(result.height,64);
  await assert.rejects(resizeCommunityPreview(Buffer.from('not an image'),'thumbnail'));
});

test('source download rejects oversized declarations, streamed excess and failed requests', async () => {
  await assert.rejects(readPreviewSource(new Response('x',{headers:{'content-length':String(PREVIEW_SOURCE_MAX_BYTES+1)}})));
  const streamed = new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(PREVIEW_SOURCE_MAX_BYTES+1));c.close();}}));
  await assert.rejects(readPreviewSource(streamed));
  await assert.rejects(readPreviewSource(new Response('error',{status:404})));
  assert.equal((await readPreviewSource(new Response('abc'))).toString(),'abc');
});

test('concurrent repeated carousel copies share one derivative and errors remain retryable', async () => {
  let calls=0;
  const generate=async()=>{calls++;return Buffer.from('small preview');};
  await Promise.all(Array.from({length:24},()=>cachedCommunityPreview('fixture-preview',generate)));
  assert.equal(calls,1);
  await cachedCommunityPreview('fixture-preview',generate);assert.equal(calls,1);
  await assert.rejects(cachedCommunityPreview('fixture-fail',async()=>{throw Error('offline');}));
  assert.equal((await cachedCommunityPreview('fixture-fail',generate)).toString(),'small preview');
});

function routeFixture() {
  let published=true, transformed=0, downloads=0;
  const queries=[];
  const query={select:()=>query,in:(...args)=>{queries.push(args);return query;},eq:()=>query,limit:()=>query,maybeSingle:async()=>({data:published?{storage_id:'fixture-file',uploaded_at:'2026-10-26'}:null,error:null})};
  const compiled=ts.transpileModule(readFileSync(new URL('../app/api/community-image/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const deps={'next/server':require('next/server'),'@/lib/db':{db:{from:()=>query}},'@/lib/community-media':media,'@/lib/community-preview-server':{cachedCommunityPreview,readPreviewSource,resizeCommunityPreview:async()=>{transformed++;return Buffer.from('bounded webp');}}};
  const loaded={exports:{}};
  new Function('require','module','exports','fetch',compiled)(n=>deps[n],loaded,loaded.exports,async()=>{downloads++;return new Response('source');});
  return {GET:loaded.exports.GET,queries,setPublished:v=>{published=v;},counts:()=>({transformed,downloads})};
}

test('public image route checks current allowlisted assignment before cached data, rejects private and external sources', async () => {
  const previous=process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';
  try {
    const fixture=routeFixture();
    const image='https://fixture.supabase.co/storage/v1/object/public/listing-images/test.png';
    const request=(url=image,size='thumbnail')=>({nextUrl:new URL('https://cinegenius.co'+communityPreviewUrl(url,size))});
    assert.equal((await fixture.GET(request('https://evil.invalid/test.png'))).status,400);
    assert.equal((await fixture.GET(request(image,'original'))).status,400);
    const response=await fixture.GET(request());
    assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');
    assert.match(response.headers.get('cache-control'),/no-store/);
    assert.deepEqual(fixture.queries[0],['source_type',['profile','company']]);
    fixture.setPublished(false);
    assert.equal((await fixture.GET(request())).status,404);
    assert.deepEqual(fixture.counts(),{transformed:1,downloads:1});
  } finally {if(previous===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previous;}
});
