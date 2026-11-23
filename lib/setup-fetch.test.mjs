import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {fetchSetup} from './setup-fetch.ts';
import {createOnboardingSaveQueue} from './onboarding-save.ts';

test('setup deadlines release stalled headers and stalled response bodies without retrying writes', async t => {
 const calls=[];
 const server=createServer((req,res)=>{calls.push(req.url);if(req.url==='/headers')return;if(req.url==='/body'){res.writeHead(200,{'Content-Type':'application/json'});res.write('{');return;}res.writeHead(429,{'Content-Type':'application/json','Retry-After':'17'});res.end('{"error":"Please retry"}');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const path of ['/headers','/body']) await assert.rejects(async()=>{const r=await fetchSetup(base+path,{method:'POST'},fetch,200);await r.json();},e=>['TimeoutError','AbortError'].includes(e.name));
 assert.deepEqual(calls,['/headers','/body'],'one attempt only, including uncertain POST outcomes');
 const response=await fetchSetup(base+'/limited',{},fetch,2000);assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'17');assert.equal((await response.json()).error,'Please retry');
});

test('caller cancellation and request identity survive setup transport',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 await assert.rejects(fetchSetup('https://example.invalid',{signal:controller.signal,method:'POST',body:'same-key'},async(input,init)=>{calls++;assert.equal(init.body,'same-key');assert.ok(init.signal.aborted);throw init.signal.reason;}));assert.equal(calls,1);
});

test('a timed-out autosave does not strand the following snapshot or mark it saved',async()=>{
 let calls=0;
 const request=async(_url,init)=>{if(++calls>1)return Response.json({saved:true});return new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));};
 const keepAlive=setTimeout(()=>{},1000);
 try{const queue=createOnboardingSaveQueue(async value=>{try{const response=await fetchSetup('/api/onboarding',{method:'PUT',body:JSON.stringify(value)},request,10);return (await response.json()).saved===true;}catch{return false;}});
 const first=queue.save({name:'First'}),last=queue.save({name:'Updated'});assert.equal(await first,false);assert.equal(await last,true);assert.equal(queue.matches({name:'Updated'}),true);assert.equal(calls,2);
 }finally{clearTimeout(keepAlive);}
});
