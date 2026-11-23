import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),ts=require('typescript');
const text=readFileSync(new URL('./native-work-team-container.ts',import.meta.url),'utf8');
const code=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function run(window){const exports={},context={exports,...(window===undefined?{}:{window})};vm.runInNewContext(code,context);return exports;}
const cap={version:1,nonce:'12345678-1234-1234-1234-123456789abc',leaseId:'87654321-1234-1234-1234-123456789abc',accountId:'user_test',teamId:null,linking:true};
test('server and ordinary browsers retain the normal website, queries grant no container capability',()=>{
 assert.equal(run().nativeWorkTeamContainerAvailable(),false);
 for(const window of [{location:{search:'?native=1&team=anything'}},{__cgNativeWorkTeamContainer:cap},{webkit:{messageHandlers:{cinegeniusWorkTeamContainer:{postMessage(){}}}}}])assert.equal(run(window).nativeWorkTeamContainerAvailable(),false);
});
test('the exact volatile native handler and bounded shape are required',()=>{
 const messages=[],window={__cgNativeWorkTeamContainer:cap,webkit:{messageHandlers:{cinegeniusWorkTeamContainer:{postMessage:value=>messages.push(value)}}}};
 const api=run(window);assert.equal(api.nativeWorkTeamContainer(),cap);
 api.postNativeWorkTeamContainer(cap,'ready');assert.equal(messages.length,1);assert.equal(messages[0].nonce,cap.nonce);
 api.postNativeWorkTeamContainer({...cap},'close');assert.equal(messages.length,1,'a stale or copied capability does not acknowledge actions');
 for(const patch of [{version:2},{nonce:'bad'},{accountId:''},{accountId:'x'.repeat(201)},{teamId:'local-team'},{linking:'yes'}]){window.__cgNativeWorkTeamContainer={...cap,...patch};assert.equal(api.nativeWorkTeamContainerAvailable(),false);}
});
test('leave grants can only correlate to a native request in the same account and container',()=>{
 const window={__cgNativeWorkTeamContainer:cap,webkit:{messageHandlers:{cinegeniusWorkTeamContainer:{postMessage(){}}}}};const api=run(window),requestId='11223344-1234-1234-1234-123456789abc';
 assert.equal(api.nativeWorkTeamLeaveRequest({detail:{nonce:cap.nonce,leaseId:cap.leaseId,accountId:cap.accountId,requestId}},cap),requestId);
 for(const detail of [null,{}, {nonce:'foreign',accountId:cap.accountId,requestId},{nonce:cap.nonce,accountId:'other',requestId},{nonce:cap.nonce,leaseId:cap.leaseId,accountId:cap.accountId,requestId:'bad'}])assert.equal(api.nativeWorkTeamLeaveRequest({detail},cap),null);
});
