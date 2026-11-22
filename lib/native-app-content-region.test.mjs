import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeAppContentRegion, nativeContentFocusDelta, nativeContentUnobscuredRegion } from './native-app-content-region.ts';
import { mergeViewRecord, viewRecord, nativeViewScroll } from './navigation-context.ts';

test('visual content reaches the viewport bottom while control clearance becomes trailing padding',()=>{
 const r=nativeAppContentRegion({top:0,height:884},100,32,0);assert.deepEqual(r,{top:112,bottom:884,height:772,clearance:160});
 const safe=nativeAppContentRegion({top:0,height:852},127,59,34);assert.deepEqual(safe,{top:139,bottom:852,height:713,clearance:194});
 assert.equal(safe.bottom-safe.clearance,658,'the former hard clip is now only an unobscured interaction boundary');
});
test('safe insets, keyboard viewport and rotation bound the actual visible content',()=>{
 assert.deepEqual(nativeAppContentRegion({top:0,height:884},112,44,34),{top:124,bottom:884,height:760,clearance:194});
 assert.deepEqual(nativeAppContentRegion({top:0,height:560},100,32,0),{top:112,bottom:560,height:448,clearance:160});
 assert.deepEqual(nativeAppContentRegion({top:24,height:480},100,32,0),{top:112,bottom:504,height:392,clearance:160});
 assert.deepEqual(nativeAppContentRegion({top:0,height:393},68,0,21),{top:80,bottom:393,height:313,clearance:181});
 const short=nativeAppContentRegion({top:0,height:180},100,32,34);assert.equal(short.height,68);assert.equal(short.bottom,180);
});
test('missing measured header uses the same safe-area fallback; invalid dimensions cannot become negative',()=>{
 assert.deepEqual(nativeAppContentRegion({top:0,height:884},null,32,34),{top:112,bottom:884,height:772,clearance:194});
 assert.deepEqual(nativeAppContentRegion({top:NaN,height:-1},null,NaN,-1),{top:0,bottom:0,height:0,clearance:160});
 for(const viewport of [{top:0,height:0},{top:40,height:80},{top:0,height:393}]){const r=nativeAppContentRegion(viewport,500,59,34);assert.equal(r.top+r.height,r.bottom);assert.ok(r.height>=0);assert.equal(r.bottom,viewport.top+viewport.height);}
});
test('focus reveal uses the unobscured scroll padding while the visual canvas continues below it',()=>{
 const visual={top:139,bottom:852},unobscured=nativeContentUnobscuredRegion(visual,12,206);
 assert.deepEqual(unobscured,{top:151,bottom:646});
 assert.equal(nativeContentFocusDelta({top:620,bottom:664},unobscured,0),18,'a field behind the control clearance must scroll into view');
 assert.equal(nativeContentFocusDelta({top:600,bottom:644},unobscured,0),0);
 const rail=nativeContentUnobscuredRegion(visual,76,206);assert.equal(nativeContentFocusDelta({top:180,bottom:224},rail,0),-35,'sticky rail clearance still protects the top');
 for(const [top,bottom]of[[0,0],[12,1000],[1000,206],[-1,NaN]]){const r=nativeContentUnobscuredRegion({top:139,bottom:180},top,bottom);assert.ok(r.top>=139&&r.bottom<=180&&r.bottom>=r.top);}
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
