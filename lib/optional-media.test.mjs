import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as gallery from './listing-image-gallery.ts';
const require=createRequire(import.meta.url);
const dictionaries=Object.fromEntries(['de','en','es','it','cs','hu'].map(locale=>[locale,JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'))]));
function load(file,locale='de') {
 const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const mocks={'next-intl':{useTranslations:namespace=>(key,values={})=>Object.entries(values).reduce((text,[name,value])=>text.replaceAll(`{${name}}`,String(value)),key.split('.').reduce((value,part)=>value?.[part],dictionaries[locale][namespace])??key)},'next/dynamic':()=>()=>null,'@/components/MediaImage':({src,alt})=>React.createElement('img',{src,alt}),'@/lib/listing-image-gallery':gallery};
 const result={exports:{}};new Function('require','module','exports',source)(name=>mocks[name]??require(name),result,result.exports);return result.exports.default;
}
for(const locale of Object.keys(dictionaries))test(`${locale}: an empty shared listing gallery is compact, localized and has no fake image or photo action`,()=>{
 const Gallery=load('../components/ListingPhotoGallery.tsx',locale);
 const html=renderToStaticMarkup(React.createElement(Gallery,{images:['',' '],title:'Own photo-free listing'}));
 assert.match(html,/data-empty-gallery/);assert.ok(html.includes(dictionaries[locale].OptionalMedia.noPhotos));
 assert.doesNotMatch(html,/<img|<button|aspect-\[4\/3\]|lg:h-96|sm:h-72|zoom/);
});
test('a supplied photo keeps the existing gallery and enlarge action',()=>{
 const Gallery=load('../components/ListingPhotoGallery.tsx');
 const html=renderToStaticMarkup(React.createElement(Gallery,{images:['https://own-test.invalid/photo.jpg'],title:'Own illustrated listing'}));
 assert.doesNotMatch(html,/data-empty-gallery/);assert.match(html,/<img/);assert.match(html,/<button/);assert.match(html,/photo\.jpg/);
});
test('optional media copy has complete equal keys and interpolation placeholders in all supported locales',()=>{
 const expected=Object.keys(dictionaries.de.OptionalMedia).sort();
 for(const locale of Object.keys(dictionaries)) {
  const copy=dictionaries[locale].OptionalMedia;assert.deepEqual(Object.keys(copy).sort(),expected);
  for(const key of expected){assert.ok(copy[key].trim());assert.deepEqual(copy[key].match(/\{\w+\}/g)??[],dictionaries.de.OptionalMedia[key].match(/\{\w+\}/g)??[]);}
 }
});
