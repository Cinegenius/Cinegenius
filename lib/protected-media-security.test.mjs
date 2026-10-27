import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import sharp from 'sharp';
import ts from 'typescript';
import * as paths from './protected-media.ts';
import {trustedMutationOrigin} from './request-origin.ts';
import {validateUpload} from './uploadGuard.ts';
const require=createRequire(import.meta.url);
const key=`user_a/${'a'.repeat(32)}.webp`, reference=paths.protectedMediaUrl(key);
function load(file,deps){const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const m={exports:{}};new Function('require','module','exports',code)(n=>deps[n]??require(n),m,m.exports);return m.exports;}
test('protected references reject path traversal, foreign origins and cross-owner paths',()=>{
 assert.equal(paths.protectedMediaKey(reference),key);assert.equal(paths.isOwnedProtectedMedia(reference,'user_a'),true);assert.equal(paths.isOwnedProtectedMedia(reference,'user_b'),false);
 for(const value of ['/api/media/../secret','/api/media/user_a/%2e%2e/file.png','https://evil.invalid'+reference,'blob:test','/api/media/user_a/not-a-uuid.webp']) assert.equal(paths.protectedMediaKey(value),null);
});
test('even manually encoded optimizer requests cannot create a shared protected-image copy',()=>{
 for(const value of [reference,encodeURIComponent(reference),'/api%2fmedia/user_a/test.webp','/api//media/user_a/test.webp','/api/example/../media/user_a/test.webp','https://www.cinegenius.co'+reference]) assert.equal(paths.isProtectedMediaOptimizerSource(value,'https://www.cinegenius.co'),true,value);
 assert.equal(paths.isProtectedMediaOptimizerSource('/hero-bg.jpg','https://www.cinegenius.co'),false);
});
test('image gateway checks the viewer before returning either original or resized bytes and never caches private responses',async()=>{
 let viewer=null,allowed=false,reads=0,resizes=0;
 const {GET}=load('../app/api/media/[...path]/route.ts',{'@clerk/nextjs/server':{auth:async()=>({userId:viewer})},'@/lib/protected-media':paths,'@/lib/protected-media-server':{readableProtectedMedia:async()=>{reads++;return allowed&&viewer==='user_a'?{storage_path:key,mime_type:'image/webp'}:null;},downloadProtectedMedia:async(ref,id)=>{assert.equal(ref,reference);return allowed&&id==='user_a'?{bytes:new Uint8Array([1,2,3]),mime:'image/webp'}:null;}},'@/lib/community-preview-server':{cachedCommunityPreview:async(k,create)=>create(),resizeCommunityPreview:async()=>{resizes++;return Buffer.from('small');}}});
 const run=size=>GET({nextUrl:new URL('https://test.invalid'+reference+(size?'?size='+size:''))},{params:Promise.resolve({path:key.split('/')})});
 assert.equal((await run()).status,404);viewer='user_b';allowed=true;assert.equal((await run('thumbnail')).status,404);assert.equal(resizes,0);
 viewer='user_a';let res=await run('thumbnail');assert.equal(res.status,200);assert.match(res.headers.get('cache-control'),/no-store/);assert.equal(res.headers.get('vercel-cdn-cache-control'),'no-store');assert.equal(resizes,1);
 allowed=false;assert.equal((await run('thumbnail')).status,404);assert.equal(resizes,1);assert.equal((await run('invalid')).status,404);assert.equal(reads,4);
});
test('upload decoding rejects forged signatures, active SVG and oversized pixel dimensions; normal files are inert WebP',async()=>{
 const file=(bytes,name='x.png')=>new File([bytes],name,{type:'text/plain'});
 assert.equal((await validateUpload(file(new Uint8Array([255,216,255,0])))).status,415);
 for(const svg of ['<svg><script>alert(1)</script></svg>','<svg><image href="https://evil.invalid/x"/></svg>','<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>'])assert.equal((await validateUpload(file(svg))).status,415);
 for(const format of ['png','jpeg','webp']) {
 const bytes=await sharp({create:{width:12,height:20,channels:3,background:'#aabbcc'}})[format]().toBuffer();
 const result=await validateUpload(file(bytes));assert.equal(result.mime,'image/webp');assert.equal(result.ext,'webp');const m=await sharp(Buffer.from(result.buffer)).metadata();assert.equal(m.width,12);assert.equal(m.height,20);assert.equal(m.exif,undefined);
 }
 const svg='<svg width="100000" height="100000" xmlns="http://www.w3.org/2000/svg"><rect width="100000" height="100000"/></svg>';
 assert.equal((await validateUpload(file(svg))).status,415);
});
test('Origin is authoritative and preview origins must be explicitly configured',()=>{
 const base={requestUrl:'https://www.cinegenius.co/api/profile',origin:'https://evil.invalid',referer:'https://www.cinegenius.co/profile'};
 assert.equal(trustedMutationOrigin(base),false);assert.equal(trustedMutationOrigin({...base,origin:'null'}),false);assert.equal(trustedMutationOrigin({...base,origin:null}),true);
 assert.equal(trustedMutationOrigin({...base,requestUrl:'https://preview.vercel.app/api/profile',origin:'https://preview.vercel.app',deploymentHost:'preview.vercel.app'}),true);
 assert.equal(trustedMutationOrigin({...base,requestUrl:'https://evil.invalid/api/profile'}),false);
 assert.equal(trustedMutationOrigin({...base,requestUrl:'http://localhost:3032/api/profile',origin:'http://localhost:3032',development:true}),true);
});
test('JSON-LD cannot break out of its data script using a member-authored title',()=>{
 const {renderToStaticMarkup}=require('react-dom/server'),React=require('react');const JsonLd=load('../components/JsonLd.tsx',{}).default;
 const html=renderToStaticMarkup(React.createElement(JsonLd,{data:{name:'</script><script>window.attack=1</script>'}}));
 assert.equal((html.match(/<script/g)||[]).length,1);assert.equal(html.includes('</script><script>'),false);assert.match(html,/\\u003c/);assert.equal(JSON.parse(html.replace(/^.*?>/,"").replace(/<\/script>$/,"")).name,"</script><script>window.attack=1</script>");
});
