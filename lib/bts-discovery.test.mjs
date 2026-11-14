import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {communityPreviewUrl} from './community-preview.ts';
import {isOwnPublicStorageUrl} from './community-media.ts';
import {collectFacetRows} from './browse-facets.ts';
const require=createRequire(import.meta.url);
const origin='https://synthetic.supabase.co';
const own=origin+'/storage/v1/object/public/media/own.jpg';
const privateMirror=origin+'/storage/v1/object/public/media/private.jpg';
const protectedUrl='/api/media/own/11111111111141118111111111111111.jpg';
const foreign='https://foreign.supabase.co/storage/v1/object/public/media/foreign.jpg';
test('BTS discovery keeps only eligible owner/image pairs and uses previews without changing original links',async()=>{
 const previous=process.env.NEXT_PUBLIC_SUPABASE_URL;process.env.NEXT_PUBLIC_SUPABASE_URL=origin;
 try{
  let grid;const renderedImages=[];
  const profiles=[{user_id:'own',display_name:'Synthetic author',profile_type:'camera',profile_images:[own,protectedUrl,privateMirror,foreign].map(url=>({url,media_type:'bts'}))},{user_id:'private',display_name:'Private author',profile_type:'camera',profile_images:[{url:privateMirror,media_type:'bts'}]}];
  const eligible=[{owner_id:'own',image_url:own},{owner_id:'own',image_url:protectedUrl},{owner_id:'different-owner',image_url:privateMirror}];
  const likes=[own,protectedUrl,privateMirror,foreign].map(image_url=>({image_url,profile_id:'own',liker_id:'viewer'}));
  const db={from(table){const q={select:()=>q,not:()=>q,neq:()=>q,order:()=>q,eq:()=>q,in:()=>q,limit:()=>q,range:()=>q,then:resolve=>resolve({data:table==='profiles'?profiles:table==='public_community_media'?eligible:likes,error:null})};return q;}};
  const translate=key=>key;translate.rich=key=>key;
  const link=({children,href})=>React.createElement('a',{href},children);
  const mocks={
   '@/lib/db':{db},'@clerk/nextjs/server':{auth:async()=>({userId:'viewer'})},
   'next-intl/server':{getTranslations:async()=>translate},'@/lib/trust':{getPrivateProfileIds:async()=>new Set(['private'])},
   '@/lib/community-preview':{communityPreviewUrl},'@/lib/community-media':{isOwnPublicStorageUrl},'@/lib/browse-facets':{collectFacetRows},
   '@/lib/photo-link':{photoHref:(id,url)=>'/photo/'+id+'?image='+encodeURIComponent(url)},
   '@/components/MediaImage':({src})=>{renderedImages.push(src);return null;},'next/link':link,'./PhotoNavigationLink':link,
   './BTSMosaicGrid':props=>{grid=props;return null;},
  };
  const code=ts.transpileModule(readFileSync(new URL('../app/bts/page.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const mod={exports:{}};new Function('require','module','exports',code)(name=>mocks[name]??require(name),mod,mod.exports);
  const html=renderToStaticMarkup(await mod.exports.default());
  assert.deepEqual(grid.items.map(item=>item.imageUrl),[own,protectedUrl]);
  assert.deepEqual(Object.keys(grid.initialLikes).sort(),[own,protectedUrl].map(url=>'own:'+url).sort());
  assert.deepEqual(grid.initialMyLikes,[own,protectedUrl].map(url=>'own:'+url));
  for(const url of [own,protectedUrl]){assert.ok(renderedImages.includes(communityPreviewUrl(url)));assert.ok(html.includes(encodeURIComponent(url)));}
  assert.ok(!html.includes(encodeURIComponent(privateMirror)));assert.ok(!renderedImages.includes(own));
 }finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previous;}
});
