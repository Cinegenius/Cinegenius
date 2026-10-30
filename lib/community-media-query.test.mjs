import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import * as media from './community-media.ts';

function fixture(blocked=[], { rows=[], fetchResponse, blockLookup }={}) {
 const requests=[],requestOptions=[],blockLookups=[];
 const db=createClient('https://fixture.invalid','fixture-only-key',{auth:{persistSession:false},global:{fetch:async (input,init)=>{
  const url=new URL(input);requests.push(url);requestOptions.push(init);
  if(fetchResponse)return fetchResponse(url,init);
  return new Response(JSON.stringify(url.pathname.endsWith('/public_community_media')?rows:[]),{headers:{'content-type':'application/json','content-range':'*/240'}});
 }}});
 const source=readFileSync(new URL('./community-media-server.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const loaded={exports:{}};
 const dependencies={'server-only':{},'@/lib/db':{db},'@/lib/community-media':media,'@/lib/linked-profile-access':{blockedMediaOwnerIds:async(viewerId,signal)=>{blockLookups.push({viewerId,signal});return blockLookup?blockLookup(viewerId,signal):blocked;}}};
 new Function('require','module','exports',compiled)(name=>{assert.ok(Object.hasOwn(dependencies,name));return dependencies[name];},loaded,loaded.exports);
 return {...loaded.exports,requests,requestOptions,blockLookups};
}

test('slideshow and full collection apply the same explicit source allowlist before bounded pagination, without likes or featured requirements',async()=>{
 const api=fixture();
 const result=await api.getCommunityMedia({limit:24,diverse:true});
 let query=api.requests[0].searchParams;
 assert.equal(query.get('source_type'),'in.(profile,company)');
 assert.equal(query.get('limit'),'24');assert.equal(query.get('offset'),'0');
 assert.equal(query.get('order'),'contributor_rank.asc,uploaded_at.desc,storage_id.desc');
 assert.equal(result.total,240);
 assert.match(new Headers(api.requestOptions[0].headers).get('prefer'),/count=exact/);
 assert.equal(query.has('featured'),false);assert.equal(query.has('like_count'),false);
 await api.getCommunityMedia({page:3});
 query=api.requests[1].searchParams;
 assert.equal(query.get('source_type'),'in.(profile,company)');
 assert.equal(query.get('limit'),'48');assert.equal(query.get('offset'),'96');
 assert.equal(query.get('order'),'uploaded_at.desc,storage_id.desc');
});

test('direct photo lookup cannot bypass source restrictions or silently resolve an excluded image',async()=>{
 const api=fixture();
 assert.equal(await api.resolvePublicCommunityPhoto('member','https://test.supabase.co/storage/v1/object/public/images/market.jpg'),null);
 const query=api.requests[0].searchParams;
 assert.equal(query.get('source_type'),'in.(profile,company)');
 assert.equal(query.get('owner_id'),'eq.member');
 assert.equal(query.get('image_url'),'eq.https://test.supabase.co/storage/v1/object/public/images/market.jpg');
 assert.equal(query.get('limit'),'1');
 assert.doesNotMatch(new Headers(api.requestOptions[0].headers).get('prefer')??'',/count=/,'a direct lookup does not need the full result count');
 const photo=media.communityPhotoFromRow({source_type:'company',source_id:'firm',owner_id:'owner',author:'Firma',author_href:'/companies/firm',source_href:'/companies/firm',source_label:'Firma',image_url:'logo.jpg',caption:'Logo',media_type:'logo',uploaded_at:'2026-10-25',storage_id:'file'});
 assert.equal(photo.fit,'contain');assert.equal(photo.authorHref,'/companies/firm');assert.equal(photo.sourceHref,'/companies/firm');
});

test('blocked media owners are filtered before pagination and exact counts',async()=>{
 const api=fixture(['blocked-own-fixture']);await api.getCommunityMedia({viewerId:'own-test-member',page:2});
 const query=api.requests[0].searchParams;assert.equal(query.get('owner_id'),'not.in.("blocked-own-fixture")');assert.equal(query.get('offset'),'48');
});

test('homepage callers can skip the exact total while preserving source, block and pagination restrictions',async()=>{
 const api=fixture(['blocked-own-fixture']);
 const result=await api.getCommunityMedia({viewerId:'own-test-member',limit:24,diverse:true,includeTotal:false});
 const query=api.requests[0].searchParams;
 assert.doesNotMatch(new Headers(api.requestOptions[0].headers).get('prefer')??'',/count=/);
 assert.equal(query.get('source_type'),'in.(profile,company)');
 assert.equal(query.get('owner_id'),'not.in.("blocked-own-fixture")');
 assert.equal(query.get('order'),'contributor_rank.asc,uploaded_at.desc,storage_id.desc');
 assert.equal(query.get('limit'),'24');assert.equal(result.total,0);
});

const protectedPhoto={source_type:'profile',source_id:'own-test-owner',owner_id:'own-test-owner',author:'Own Author',author_href:'/profile/own-test-owner',source_href:'/profile/own-test-owner',source_label:'Own Author',image_url:'/api/media/own-test-owner/0123456789abcdef0123456789abcdef.webp',caption:'Own photo',media_type:'portfolio',uploaded_at:'2026-10-30T08:00:00Z',storage_id:'own-test-file'};

test('one caller signal reaches block checks, media and likes without changing the selected photo',async()=>{
 const controller=new AbortController();
 const api=fixture([], {rows:[protectedPhoto]});
 const result=await api.getCommunityMedia({viewerId:'own-test-viewer',signal:controller.signal,includeTotal:false});
 assert.deepEqual(api.blockLookups,[{viewerId:'own-test-viewer',signal:controller.signal}]);
 assert.equal(api.requests.length,2);
 assert.ok(api.requestOptions.every(options=>options.signal===controller.signal));
 assert.equal(api.requests[1].pathname,'/rest/v1/profile_image_likes');
 assert.equal(result.photos[0].imageUrl,protectedPhoto.image_url);
});

for(const stage of ['media','likes'])test(`aborting an in-flight ${stage} query rejects without returning partial discovery results`,{timeout:2000},async()=>{
 const controller=new AbortController();let started;
 const pending=new Promise(resolve=>{started=resolve;});
 const api=fixture([], {fetchResponse:(url,options)=>{
  if(stage==='likes'&&url.pathname.endsWith('/public_community_media'))return new Response(JSON.stringify([protectedPhoto]),{headers:{'content-type':'application/json'}});
  started();
  assert.equal(options.signal,controller.signal);
  return new Promise((resolve,reject)=>{
   if(options.signal.aborted)reject(options.signal.reason);
   else options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});
  });
 }});
 const request=api.getCommunityMedia({viewerId:'own-test-viewer',signal:controller.signal,includeTotal:false});
 const failure=assert.rejects(request,stage==='media'?/Einblicke/:/Likes/);
 await pending;controller.abort();await failure;
 assert.equal(api.requests.length,stage==='media'?1:2,'an aborted media query must never start a likes query');
});

test('unavailable block permissions prevent all discovery queries',async()=>{
 const api=fixture([], {blockLookup:async()=>{throw new Error('Media block lookup unavailable');}});
 await assert.rejects(api.getCommunityMedia({viewerId:'own-test-viewer',includeTotal:false}),/block lookup unavailable/);
 assert.equal(api.requests.length,0);
});
