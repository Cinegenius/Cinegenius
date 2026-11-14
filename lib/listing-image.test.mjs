import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {intlClientFor} from './i18n-test-fixture.mjs';
import * as protectedMedia from './protected-media.ts';
const require=createRequire(import.meta.url);
const compile=file=>ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const load=(source,mocks)=>{const mod={exports:{}};new Function('require','module','exports',source)(name=>mocks[name]??require(name),mod,mod.exports);return mod.exports.default;};
const MediaImage=load(compile('../components/MediaImage.tsx'),{'@/lib/protected-media':protectedMedia});
const source=compile('../components/ListingImage.tsx');
const src='/api/media/fixture-owner/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp';
for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv'])test(`${locale}: offer previews preserve checked thumbnails, retry once and explain permanent failure`,()=>{
 let failures=0;const ListingImage=load(source,{react:{...React,useState:()=>[failures,value=>{failures=typeof value==='function'?value(failures):value;}]},'next-intl':intlClientFor(locale),'@/components/MediaImage':MediaImage});
 const props={src,alt:'Original member title',width:96,height:64,mediaSize:'thumbnail',className:'rounded',style:{objectPosition:'25% 70%'}};
 const outer=ListingImage(props);let image=outer.type(outer.props);
 let html=renderToStaticMarkup(image);assert.match(html,/src="\/api\/media\/fixture-owner\/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp\?size=thumbnail"/);assert.doesNotMatch(html,/_next\/image|srcSet=/);assert.ok(html.includes('Original member title'));assert.ok(html.includes('25% 70%'));
 image.props.onError();image=outer.type(outer.props);assert.equal(image.type,MediaImage);assert.equal(image.props.src,src,'retry never switches to a public or alternate original');assert.equal(image.props.mediaSize,'thumbnail');
 image.props.onError();image=outer.type(outer.props);assert.equal(image.props.role,'img');assert.ok(image.props['aria-label'].includes('Original member title'));assert.equal(image.props.onError,undefined,'persistent failures cannot trigger an unbounded retry');assert.equal(image.props.style.width,96);assert.equal(image.props.style.height,64);
 const changed=ListingImage({...props,src:'/api/media/fixture-owner/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.webp'});assert.notEqual(changed.key,outer.key,'a different source mounts a fresh recovery state');
});
test('fill preview failure reserves its existing frame and does not invent a photo',()=>{
 const ListingImage=load(source,{react:{...React,useState:()=>[2,()=>{}]},'next-intl':intlClientFor('de'),'@/components/MediaImage':MediaImage});const outer=ListingImage({src,alt:'',fill:true,mediaSize:'thumbnail',sizes:'48px'});const fallback=outer.type(outer.props);assert.equal(fallback.props.role,'img');assert.match(fallback.props.className,/absolute inset-0/);assert.equal(fallback.props.style.width,undefined);assert.equal(fallback.props.src,undefined);
});
