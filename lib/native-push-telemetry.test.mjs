import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {filterKeyValueData} from '../node_modules/@sentry/core/build/esm/utils/data-collection/filterKeyValueData.js';

test('the actual telemetry SDK redacts installation proof in every request-header capitalization and runtime',()=>{
 for(const file of ['sentry.client.config.ts','sentry.server.config.ts','sentry.edge.config.ts']){
  const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  let settings;
  new Function('require','exports',code)(name=>{
   assert.equal(name,'@sentry/nextjs');return {init:value=>{settings=value}};
  },{});
  const fixture={'X-Push-Installation-Proof':'SYNTHETIC_PRIVATE_CANARY','x-push-installation-proof':'SYNTHETIC_PRIVATE_CANARY','X-PUSH-INSTALLATION-PROOF':'SYNTHETIC_PRIVATE_CANARY','x-public-fixture':'public'};
  const filtered=filterKeyValueData(fixture,settings.dataCollection.httpHeaders.request);
  assert.ok(!JSON.stringify(filtered).includes('SYNTHETIC_PRIVATE_CANARY'),file);
  assert.equal(filtered['x-public-fixture'],'public');
 }
});
