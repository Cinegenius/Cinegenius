import test from 'node:test';
import assert from 'node:assert/strict';
import {createFormDraftQueue,draftFingerprint,validFormDraftData,validFormDraftKey,mergeFormDraft,draftContentFingerprint} from './form-draft.ts';

test('draft changes include images, order, prices and crops, but object key order is stable',()=>{
 const initial={text:'Own draft',price:'100',images:['/api/media/a','/api/media/b'],crop:{x:20,y:30}};
 assert.equal(draftFingerprint(initial),draftFingerprint({...initial,crop:{y:30,x:20}}));
 for(const patch of [{text:'Changed'}, {price:'VB'}, {images:[...initial.images].reverse()}, {images:initial.images.slice(1)}, {crop:{x:21,y:30}}]) assert.notEqual(draftFingerprint(initial),draftFingerprint({...initial,...patch}));
});
test('only explicit form sources and durable references can be saved',()=>{
 for(const key of ['profile:edit','listing:new','company:new','project:quick','board:compose','setup:quick','guided:location'])assert.equal(validFormDraftKey(key),true);
 for(const key of ['messages:all','../profiles','company:foreign','admin:settings'])assert.equal(validFormDraftKey(key),false);
 assert.equal(validFormDraftData({images:['/api/media/profiles/own/photo.webp']}),true);
 for(const value of [{image:'blob:temporary'}, {image:'data:image/png;base64,test'}, {password:'secret'}, {text:'x'.repeat(250001)}])assert.equal(validFormDraftData(value),false);
});
test('a successful write acknowledges only its sent snapshot, never newer typing',async()=>{
 let resolve;const written=[];
 const q=createFormDraftQueue((snapshot,revision)=>new Promise(r=>{written.push({snapshot,revision});resolve=()=>r({data:snapshot,revision:revision+1})}));
 const initial={text:''},a={text:'a'},b={text:'ab'};q.load(initial,0);
 assert.equal(q.isSaved(initial),true);const task=q.save(a);await Promise.resolve();await Promise.resolve();
 assert.equal(q.isSaved(b),false);resolve();await task;assert.equal(q.isSaved(a),true);assert.equal(q.isSaved(b),false);
 assert.equal(written.length,1);
});
test('serial writes do not duplicate identical snapshots; failure and retry preserve the baseline',async()=>{
 let fail=true, calls=0;const q=createFormDraftQueue(async(data,revision)=>{calls++;if(fail)throw Error('offline');return{data,revision:revision+1}});
 q.load({text:''},0);await assert.rejects(q.save({text:'own'}));assert.equal(q.isSaved({text:'own'}),false);
 fail=false;await Promise.all([q.save({text:'own'}),q.save({text:'own'})]);assert.equal(calls,2);assert.equal(q.isSaved({text:'own'}),true);
 await q.save(null);assert.equal(q.isSaved(null),true);
});

test('older drafts preserve new defaults, dynamic metadata and completed recovery snapshots',async()=>{
 const old={form:{title:'Own title'},social:{instagram:'https://example.invalid/own'},images:['/api/media/own/a']};
 const restored=mergeFormDraft({form:{title:'',city:''},social:{},images:[],crop:null},old);
 assert.deepEqual(restored,{form:{title:'Own title',city:''},social:{instagram:'https://example.invalid/own'},images:['/api/media/own/a'],crop:null});
 const q=createFormDraftQueue(async(data,revision)=>({data,revision:revision+1}));q.load(old,3);
 assert.deepEqual(q.confirmed(),old);await q.save({...old,form:{title:'Changed'}});assert.equal(q.confirmed().form.title,'Changed');
});

test('opening sections and changing wizard steps alone never count as unsaved user input',()=>{
 const value={form:{name:'Own test'},step:1,composerOpen:false};
 assert.equal(draftContentFingerprint(value),draftContentFingerprint({...value,step:4,composerOpen:true}));
 assert.notEqual(draftContentFingerprint(value),draftContentFingerprint({...value,form:{name:'Changed'}}));
});
