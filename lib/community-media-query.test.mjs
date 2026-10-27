import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import * as media from './community-media.ts';

function fixture(rows=[]) {
 const requests=[];
 const db=createClient('https://fixture.invalid','fixture-only-key',{auth:{persistSession:false},global:{fetch:async input=>{
  const url=new URL(input);requests.push(url);
  return new Response(JSON.stringify(url.pathname.endsWith('/companies') ? [{id:'firm',logo_background:'dark'}] : rows),{headers:{'content-type':'application/json','content-range':'*/240'}});
 }}});
 const source=readFileSync(new URL('./community-media-server.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const loaded={exports:{}};
 const dependencies={'server-only':{},'@/lib/db':{db},'@/lib/community-media':media};
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


test('community logos use the public company preference with a bounded lookup; photos do not inherit it',async()=>{
 const previous=process.env.NEXT_PUBLIC_SUPABASE_URL;process.env.NEXT_PUBLIC_SUPABASE_URL='https://test.supabase.co';
 try{
  const row={source_type:'company',source_id:'firm',owner_id:null,author:'Firma',author_href:'/companies/firm',source_href:'/companies/firm',source_label:'Firma',image_url:'https://test.supabase.co/storage/v1/object/public/images/logo.png',caption:'Logo',media_type:'logo',uploaded_at:'2026-10-25',storage_id:'file'};
  const api=fixture([row,{...row,image_url:row.image_url.replace('logo','gallery'),media_type:'gallery'}]);
  const result=await api.getCommunityMedia();
  assert.equal(result.photos[0].logoBackground,'dark');assert.equal(result.photos[1].logoBackground,undefined);
  const request=api.requests.find(url=>url.pathname.endsWith('/companies'));
  assert.equal(request.searchParams.get('id'),'in.(firm)');assert.equal(request.searchParams.get('published'),'eq.true');assert.equal(request.searchParams.get('select'),'id,logo_background');
 }finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previous;}
});
