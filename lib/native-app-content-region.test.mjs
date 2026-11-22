import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeAppContentRegion, nativeContentFocusDelta } from './native-app-content-region.ts';
import { mergeViewRecord, viewRecord, nativeViewScroll } from './navigation-context.ts';

test('the approved content region leaves16px above the default Genie row',()=>{
 const r=nativeAppContentRegion({top:0,height:884},100,32,0);assert.deepEqual(r,{top:112,bottom:724,height:612});assert.equal(884-88-56-r.bottom,16);
});
test('safe insets, keyboard viewport and rotation bound the actual visible content',()=>{
 assert.deepEqual(nativeAppContentRegion({top:0,height:884},112,44,34),{top:124,bottom:690,height:566});
 assert.deepEqual(nativeAppContentRegion({top:0,height:560},100,32,0),{top:112,bottom:400,height:288});
 assert.deepEqual(nativeAppContentRegion({top:24,height:480},100,32,0),{top:112,bottom:344,height:232});
 assert.deepEqual(nativeAppContentRegion({top:0,height:393},68,0,21),{top:80,bottom:212,height:132});
 const short=nativeAppContentRegion({top:0,height:180},100,32,34);assert.equal(short.height,0);assert.ok(short.bottom<=180);
});
test('missing measured header uses the same safe-area fallback; invalid dimensions cannot become negative',()=>{
 assert.deepEqual(nativeAppContentRegion({top:0,height:884},null,32,34),{top:112,bottom:690,height:578});
 assert.deepEqual(nativeAppContentRegion({top:NaN,height:-1},null,NaN,-1),{top:0,bottom:0,height:0});
});
test('focus reveal moves only enough to expose the field inside the bounded scroller',()=>{
 assert.equal(nativeContentFocusDelta({top:130,bottom:174},{top:112,bottom:400}),0);
 assert.equal(nativeContentFocusDelta({top:380,bottom:424},{top:112,bottom:400}),32);
 assert.equal(nativeContentFocusDelta({top:100,bottom:144},{top:112,bottom:400}),-20);
 assert.equal(nativeContentFocusDelta({top:150,bottom:550},{top:112,bottom:400}),30);
});
test('native scroll coordinates are route-, account- and session-bound while Next state and website position survive',()=>{
 const state=mergeViewRecord({__NA:true,__PRIVATE_NEXTJS_INTERNALS_TREE:['current']},'/search','member-a',{fields:{view:'grid'},y:71,nativeScroll:{session:'session-a',y:1240}});
 const own=viewRecord(state,'/search','member-a');assert.equal(nativeViewScroll(own,'session-a'),1240);assert.equal(own.y,71);assert.equal(own.fields.view,'grid');assert.equal(state.__NA,true);
 for(const [path,owner,session]of[['/search','member-b','session-a'],['/profile/one','member-a','session-a'],['/search','member-a','session-b'],['/search','guest',null]])assert.equal(nativeViewScroll(viewRecord(state,path,owner),session),null);
 const guest=mergeViewRecord({},'/creators','guest',{fields:{query:'Kamera'},nativeScroll:{session:null,y:340}});const adopted=viewRecord(guest,'/creators','member-a');assert.equal(adopted.fields.query,'Kamera');assert.equal(nativeViewScroll(adopted,'new-session'),null);
 for(const y of[-1,NaN,Infinity])assert.equal(nativeViewScroll({...own,nativeScroll:{session:'session-a',y}},'session-a'),null);
});
