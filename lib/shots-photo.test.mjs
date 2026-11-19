import test from 'node:test';
import assert from 'node:assert/strict';
import {importShotPhoto,renderShotPhoto,shotPhotoDimensions,ShotPhotoError,SHOT_EXPORT_BYTES} from './shots-photo.ts';

function fixture(t,{width=2400,height=3200,oversize=false}={}){
 const previous=Object.fromEntries(['Image','document'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;const urls=new Set(),revoked=[],canvases=[],draws=[];
 URL.createObjectURL=()=>{const url=`blob:own-${urls.size}`;urls.add(url);return url;};URL.revokeObjectURL=url=>revoked.push(url);
 class Image {naturalWidth=width;naturalHeight=height;set src(value){if(value)queueMicrotask(()=>this.onload?.());}}
 globalThis.Image=Image;globalThis.document={createElement(tag){assert.equal(tag,'canvas');const canvas={width:0,height:0,pixels:null,getContext(){return{fillRect(){},set fillStyle(_v){},drawImage(...args){draws.push(args);},getImageData(){return{data:new Uint8ClampedArray([80,110,140,255])}},putImageData(value){canvas.pixels=value.data;}};},toBlob(callback,type,quality){assert.equal(type,'image/jpeg');assert.equal(quality,.84);callback(new Blob([oversize?new Uint8Array(SHOT_EXPORT_BYTES+1):JSON.stringify(canvas.pixels?Array.from(canvas.pixels):['normalized'])],{type:'image/jpeg'}));}};canvases.push(canvas);return canvas;}};
 t.after(()=>{for(const[key,value]of Object.entries(previous)){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;});return{urls,revoked,canvases,draws};
}
test('photo imports validate type/bytes and preserve full aspect within1600px/40MP',async()=>{
 assert.deepEqual(shotPhotoDimensions(4000,3000),{width:1600,height:1200});assert.deepEqual(shotPhotoDimensions(100,200),{width:100,height:200});assert.throws(()=>shotPhotoDimensions(9000,9000),ShotPhotoError);
 await assert.rejects(importShotPhoto(new File(['x'],'private.heic',{type:'image/heic'})),error=>error.code==='fileType');
 await assert.rejects(importShotPhoto(new File([],'empty.jpg',{type:'image/jpeg'})),error=>error.code==='fileSize');
 await assert.rejects(importShotPhoto(new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'],'renamed.jpg',{type:'image/jpeg'})),error=>error.code==='fileType');
});
test('import redraws pixels to a fresh bounded JPEG instead of uploading the device file or its EXIF',async t=>{
 const f=fixture(t),file=new File([new Uint8Array([255,216,255]),'PRIVATE_EXIF_GPS_CANARY'],'original-secret-name.jpg',{type:'image/jpeg'});const photo=await importShotPhoto(file);
 assert.deepEqual([photo.width,photo.height],[1200,1600]);assert.equal(photo.blob.type,'image/jpeg');assert.notEqual(photo.blob,file);assert.doesNotMatch(await photo.blob.text(),/PRIVATE_EXIF|secret-name/);assert.equal(f.draws.length,1);assert.equal(f.revoked.length,1);assert.equal(f.canvases[0].width,0);
});
test('effects are deterministic, non-destructive and grayscale preserves equal channels without grain',async t=>{
 const f=fixture(t,{width:1,height:1}),source={blob:new Blob(['normalized'],{type:'image/jpeg'}),width:1,height:1};
 assert.equal(await renderShotPhoto(source,'original',0),source);const a=await renderShotPhoto(source,'film',20),b=await renderShotPhoto(source,'film',20);assert.equal(await a.blob.text(),await b.blob.text());assert.equal(await source.blob.text(),'normalized');
 const bw=await renderShotPhoto(source,'bw',0),values=JSON.parse(await bw.blob.text());assert.equal(values[0],values[1]);assert.equal(values[1],values[2]);assert.ok(f.canvases.every(canvas=>canvas.width===0));
});
test('abort and output-size failures release decode URLs and never return a stale photo',async t=>{
 const f=fixture(t,{oversize:true}),controller=new AbortController();controller.abort();await assert.rejects(importShotPhoto(new File([new Uint8Array([255,216,255]),'x'],'photo.jpg',{type:'image/jpeg'}),controller.signal),error=>error.name==='AbortError');assert.equal(f.urls.size,0);
 await assert.rejects(importShotPhoto(new File([new Uint8Array([255,216,255]),'x'],'photo.jpg',{type:'image/jpeg'})),error=>error.code==='export');assert.equal(f.revoked.length,1);assert.equal(f.canvases[0].height,0);
});
