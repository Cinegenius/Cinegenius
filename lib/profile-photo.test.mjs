import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { crewPhotoInput, dragProfilePhoto, profilePhotoCrop, profilePhotoStyle } from './profile-photo.ts';
import { validProfileFocalPoint, profileCoverStyle } from './profile-cover.ts';
import { compressProfileEditorDraft, expandProfileEditorDraft } from './profile-editor-private-draft.ts';
import * as protectedMedia from './protected-media.ts';
import { publishProfileUpdated, subscribeToProfileUpdated, PROFILE_UPDATED_EVENT } from './profile-update-events.ts';

test('card crop honors legacy focus, defaults to a portrait-friendly position, and bounds malformed values',()=>{
  assert.deepEqual(profilePhotoCrop(null),{x:50,y:33,zoom:1});
  assert.deepEqual(profilePhotoCrop({x:20,y:70}),{x:20,y:70,zoom:1});
  assert.deepEqual(profilePhotoCrop({x:20,y:70,card:{x:80,y:15,zoom:1.8}}),{x:80,y:15,zoom:1.8});
  assert.deepEqual(profilePhotoCrop({x:NaN,y:Infinity,card:{x:-20,y:150,zoom:100}}),{x:0,y:100,zoom:3});
});

test('portrait, landscape and square photos pan according to real cover overflow including zoom for baked-in borders',()=>{
  const start={x:50,y:50,zoom:1},frame={width:200,height:200};
  assert.deepEqual(dragProfilePhoto(start,{x:50,y:0},frame,{width:400,height:200}),{x:25,y:50,zoom:1});
  assert.deepEqual(dragProfilePhoto(start,{x:0,y:50},frame,{width:200,height:400}),{x:50,y:25,zoom:1});
  assert.deepEqual(dragProfilePhoto(start,{x:50,y:50},frame,{width:200,height:200}),start);
  assert.deepEqual(dragProfilePhoto({...start,zoom:2},{x:50,y:50},frame,{width:200,height:200}),{x:25,y:25,zoom:2});
  assert.deepEqual(dragProfilePhoto(start,{x:50,y:50},{width:0,height:0},{width:200,height:400}),start);
});

test('the actual portrait is preferred over portfolio media and only its own crop applies',()=>{
  const focal={x:25,y:70,card:{x:50,y:30,zoom:1.5}};
  assert.deepEqual(crewPhotoInput({avatar:'/portrait.jpg',image:'/portfolio.jpg',focal_point:focal}),{src:'/portrait.jpg',focalPoint:focal});
  assert.deepEqual(crewPhotoInput({avatar:' ',image:'/legacy-portfolio.jpg',focal_point:focal}),{src:'/legacy-portfolio.jpg',focalPoint:undefined});
  assert.equal(crewPhotoInput({avatar:'',image:''}).src,'');
});

test('card settings survive existing private draft recovery and cannot change the cover or legacy avatar focus',()=>{
  const focal={x:15,y:80,opacity:1,cover:{x:10,y:90},card:{x:70,y:25,zoom:1.75}};
  const draft=expandProfileEditorDraft(compressProfileEditorDraft({focalPoint:focal}));
  assert.deepEqual(draft.focalPoint,focal);
  assert.deepEqual(profilePhotoStyle(draft.focalPoint),{objectPosition:'70% 25%',transformOrigin:'70% 25%',transform:'scale(1.75)'});
  assert.deepEqual(profileCoverStyle(draft.focalPoint),{objectPosition:'10% 90%',filter:'brightness(1)'});
  assert.equal(validProfileFocalPoint(focal),true);
  for(const card of [null,[],{x:50,y:50},{x:101,y:50,zoom:1},{x:0,y:0,zoom:0.9},{x:0,y:0,zoom:3.1},{x:0,y:NaN,zoom:1}]) assert.equal(validProfileFocalPoint({...focal,card}),false);
});

const require=createRequire(import.meta.url);
function load(path,mocks){
  const mod={exports:{}};
  const source=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','module','exports',source)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);
  return mod.exports.default;
}

test('actual crew photo component fills its reserved frame and requests protected thumbnails without the shared optimizer',()=>{
  const Image=load('components/MediaImage.tsx',{'@/lib/protected-media':protectedMedia,'next/image':{default:({fill,unoptimized,quality,...props})=>React.createElement('img',{...props,'data-unoptimized':Boolean(unoptimized)})}});
  const Photo=load('components/ProfileCardPhoto.tsx',{'@/components/MediaImage':{default:Image},'@/lib/profile-photo':{profilePhotoStyle}});
  const src='/api/media/user_own/0123456789abcdef0123456789abcdef.webp';
  const html=renderToStaticMarkup(React.createElement(Photo,{src,name:'Own Portrait',focalPoint:{card:{x:70,y:30,zoom:1.5}},className:'h-20 w-20',sizes:'80px'}));
  assert.match(html,/class="object-cover"/);assert.doesNotMatch(html,/object-contain/);
  assert.ok(html.includes(src+'?size=thumbnail'));assert.match(html,/data-unoptimized="true"/);
  assert.match(html,/object-position:70% 30%/);assert.match(html,/transform:scale\(1.5\)/);
  const empty=renderToStaticMarkup(React.createElement(Photo,{src:'',name:'Own Portrait',className:'h-20 w-20',sizes:'80px'}));
  assert.doesNotMatch(empty,/<img/);assert.match(empty,/>O<\/div>/);
});

test('saved crop updates reach the existing profile event subscription and malformed crop events are ignored',()=>{
  const oldWindow=globalThis.window,oldStorage=globalThis.localStorage;
  globalThis.window=new EventTarget();let stored;
  globalThis.localStorage={setItem:(key,value)=>{stored={key,value}}};
  try{
    const received=[],stop=subscribeToProfileUpdated(value=>received.push(value));
    const focalPoint={x:50,y:33,card:{x:20,y:80,zoom:1.6}};
    publishProfileUpdated({userId:'own-test',focalPoint});
    assert.deepEqual(received[0],{userId:'own-test',focalPoint});
    assert.deepEqual(JSON.parse(stored.value).focalPoint,focalPoint);
    window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT,{detail:{userId:'own-test',focalPoint:{card:{x:999,y:30,zoom:1}}}}));
    assert.equal(received.length,1);stop();
  }finally{
    if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;
    if(oldStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=oldStorage;
  }
});
