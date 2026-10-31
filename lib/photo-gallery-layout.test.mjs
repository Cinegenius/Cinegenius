import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {photoHref} from './photo-link.ts';
import {galleryPreviewAspectRatio} from './photo-gallery-layout.ts';
const require=createRequire(import.meta.url);
const mocks={
 'next/link':({children,...props})=>React.createElement('a',props,children),
 'next/navigation':{useRouter:()=>({back(){},replace(){}})},
 '@/components/HomePhotoDiscovery':{PhotoDialog:()=>null},
 '@/components/PhotoLikeButton':({imageUrl})=>React.createElement('button',{'data-like-image':imageUrl}),
 '@/lib/photo-link':{photoHref},
 '@/lib/photo-gallery-layout':{galleryPreviewAspectRatio},
 '@/lib/community-preview':{communityPreviewUrl:url=>url},
};
const compiled=ts.transpileModule(readFileSync(new URL('../components/PhotoGallery.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const mod={exports:{}};
new Function('require','module','exports',compiled)(name=>mocks[name]??require(name),mod,mod.exports);
const items=['portrait','landscape','logo'].map((kind,index)=>({profileId:`own-${index}`,profileSlug:`own-${index}`,author:`Own ${kind}`,authorHref:`/profile/own-${index}`,imageUrl:`/own-${kind}.jpg`,caption:kind,fit:kind==='logo'?'contain':'cover',rating:0,count:0}));
const html=renderToStaticMarkup(React.createElement(mod.exports.PhotoGallery,{items,selectedPhoto:null,resumeLike:false}));
test('every unloaded photo reserves its final preview area in server HTML',()=>{
 const slots=[...html.matchAll(/<a[^>]+style="aspect-ratio:([^"]+)"[^>]+class="([^"]+)"/g)];
 assert.equal(slots.length,items.length);
 for(const slot of slots) assert.match(slot[2],/overflow-hidden/);
 const images=[...html.matchAll(/<img[^>]+class="([^"]+)"/g)];
 assert.equal(images.length,items.length);
 for(const image of images){assert.match(image[1],/absolute inset-0 h-full w-full object-contain/);assert.doesNotMatch(image[1],/h-auto/);}
});
test('photo opening, separate author links, likes and source order remain intact',()=>{
 let last=-1;
 for(const item of items){const index=html.indexOf(`alt="${item.caption}"`);assert.ok(index>last);last=index;assert.ok(html.includes(photoHref(item.profileId,item.imageUrl).replaceAll('&','&amp;')));assert.ok(html.includes(`href="${item.authorHref}"`));assert.ok(html.includes(`data-like-image="${item.imageUrl}"`));}
});
test('empty gallery creates no fake photo slots',()=>{
 const empty=renderToStaticMarkup(React.createElement(mod.exports.PhotoGallery,{items:[],selectedPhoto:null,resumeLike:false}));
 assert.doesNotMatch(empty,/<img|role="listitem"/);
});

test('preview heights vary but remain deterministic across loads and ordering',()=>{
 const examples=Array.from({length:20},(_,index)=>({imageUrl:`/own-${index}.jpg`,fit:'cover'}));
 const ratios=examples.map(galleryPreviewAspectRatio);
 assert.ok(new Set(ratios).size>=4);
 assert.deepEqual(examples.slice().reverse().map(galleryPreviewAspectRatio),ratios.slice().reverse());
 assert.equal(galleryPreviewAspectRatio({imageUrl:'/own-logo.jpg',fit:'contain'}),'4 / 3');
});
test('only the photo page backdrop changes to black and no background image is requested',()=>{
 const page=readFileSync(new URL('../app/photo/page.tsx',import.meta.url),'utf8');
 assert.match(page,/min-h-screen bg-black/);
 assert.doesNotMatch(page,/photo-bg\.jpg|<Image/);
});
