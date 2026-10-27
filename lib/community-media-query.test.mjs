import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import * as media from './community-media.ts';

function fixture(blocked=[]) {
 const requests=[];
 const db=createClient('https://fixture.invalid','fixture-only-key',{auth:{persistSession:false},global:{fetch:async input=>{
  const url=new URL(input);requests.push(url);
  return new Response('[]',{headers:{'content-type':'application/json','content-range':'*/240'}});
 }}});
 const source=readFileSync(new URL('./community-media-server.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const loaded={exports:{}};
 const dependencies={'server-only':{},'@/lib/db':{db},'@/lib/community-media':media,'@/lib/linked-profile-access':{blockedMediaOwnerIds:async()=>blocked}};
 new Function('require','module','exports',compiled)(name=>{assert.ok(Object.hasOwn(dependencies,name));return dependencies[name];},loaded,loaded.exports);
 return {...loaded.exports,requests};
}

test('slideshow and full collection apply the same explicit source allowlist before bounded pagination, without likes or featured requirements',async()=>{
 const api=fixture();
 const result=await api.getCommunityMedia({limit:24,diverse:true});
 let query=api.requests[0].searchParams;
 assert.equal(query.get('source_type'),'in.(profile,company)');
 assert.equal(query.get('limit'),'24');assert.equal(query.get('offset'),'0');
 assert.equal(query.get('order'),'contributor_rank.asc,uploaded_at.desc,storage_id.desc');
 assert.equal(result.total,240);
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
 const photo=media.communityPhotoFromRow({source_type:'company',source_id:'firm',owner_id:'owner',author:'Firma',author_href:'/companies/firm',source_href:'/companies/firm',source_label:'Firma',image_url:'logo.jpg',caption:'Logo',media_type:'logo',uploaded_at:'2026-10-25',storage_id:'file'});
 assert.equal(photo.fit,'contain');assert.equal(photo.authorHref,'/companies/firm');assert.equal(photo.sourceHref,'/companies/firm');
});

test('blocked media owners are filtered before pagination and exact counts',async()=>{
 const api=fixture(['blocked-own-fixture']);await api.getCommunityMedia({viewerId:'own-test-member',page:2});
 const query=api.requests[0].searchParams;assert.equal(query.get('owner_id'),'not.in.("blocked-own-fixture")');assert.equal(query.get('offset'),'48');
});
