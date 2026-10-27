import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import * as paths from './protected-media.ts';
const require=createRequire(import.meta.url),path=`owner/${'b'.repeat(32)}.webp`;
function fixture({storageAckLost=false,journalAckLost=false,journalFails=false,allowed=false}={}){
 const files=new Map(),rows=new Map(),counts={uploads:0,downloads:0,removals:0};
 const db={from:()=>{let key;const q={select:()=>q,eq:(field,value)=>{if(field==='storage_path')key=value;return q;},maybeSingle:async()=>({data:rows.get(key)??null,error:null}),insert:async row=>{if(!journalFails)rows.set(row.storage_path,row);return {error:journalFails||journalAckLost?Error('Own simulated lost response'):null};}};return q;},rpc:async()=>({data:allowed?[{storage_path:path,mime_type:'image/webp'}]:[],error:null}),storage:{from:()=>({upload:async(key,buffer)=>{counts.uploads++;if(files.has(key))return{error:Error('Collision')};files.set(key,new Uint8Array(buffer));return{error:storageAckLost?Error('Own simulated lost acknowledgement'):null};},download:async key=>{counts.downloads++;return{data:files.has(key)?new Blob([files.get(key)]):null,error:null};},remove:async keys=>{counts.removals++;for(const key of keys)files.delete(key);return{error:null};}})}};
 const code=ts.transpileModule(readFileSync(new URL('./protected-media-server.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};const deps={'server-only':{},'@/lib/db':{db},'@/lib/protected-media':paths};new Function('require','module','exports',code)(n=>deps[n]??require(n),m,m.exports);return {...m.exports,files,rows,counts};
}
test('private upload retries preserve the same immutable file and reject reusing its identifier for different bytes',async()=>{
 const f=fixture({allowed:true}),bytes=new Uint8Array([1,2,3]).buffer;const first=await f.storeProtectedMedia('owner',path,bytes,'image/webp');assert.equal(first,'/api/media/'+path);
 assert.equal(await f.storeProtectedMedia('owner',path,bytes,'image/webp'),first);assert.equal(f.counts.uploads,1);
 await assert.rejects(f.storeProtectedMedia('owner',path,new Uint8Array([4,5,6]).buffer,'image/webp'),/identifier already used/);assert.deepEqual([...f.files.get(path)],[1,2,3]);
});
test('lost storage or journal acknowledgements are confirmed before reporting durable success',async()=>{
 for(const mode of [{storageAckLost:true},{journalAckLost:true}]){const f=fixture(mode);assert.equal(await f.storeProtectedMedia('owner',path,new Uint8Array([1,2,3]).buffer,'image/webp'),'/api/media/'+path);assert.equal(f.rows.size,1);assert.equal(f.files.size,1);assert.equal(f.counts.removals,0);}
});
test('a failed association cleans only its own unbound copy; foreign paths and denied readers never access bytes',async()=>{
 const f=fixture({journalFails:true});f.files.set('existing',new Uint8Array([9]));await assert.rejects(f.storeProtectedMedia('owner',path,new Uint8Array([1]).buffer,'image/webp'));assert.equal(f.files.has('existing'),true);assert.equal(f.files.has(path),false);
 const g=fixture();await assert.rejects(g.storeProtectedMedia('other',path,new Uint8Array([1]).buffer,'image/webp'),/owner mismatch/);assert.equal(g.counts.uploads,0);assert.equal(await g.downloadProtectedMedia('/api/media/'+path,'other'),null);assert.equal(g.counts.downloads,0);
});
