import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createTranslator} from 'next-intl';
import {clientMessageOmissions,checkClientMessageOmissions} from '../scripts/client-message-usage.mjs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url), exports={};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./i18n/client-messages.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{exports,require:name=>name==='./client-message-omissions.json'?JSON.parse(readFileSync(new URL('./i18n/client-message-omissions.json',import.meta.url))):require(name)});
const {clientMessages}=exports;
test('all nine browser catalogs preserve retained text and formatting without mutating the full server catalog',()=>{
 for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv']){
  const original=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url))),before=JSON.stringify(original),selected=clientMessages(original);
  assert.ok(JSON.stringify(selected).length < before.length-50000);
  assert.equal(JSON.stringify(original),before);
  for(const [ns,values] of Object.entries(selected))for(const [key,value] of Object.entries(values))assert.deepEqual(value,original[ns][key]);
  const t=createTranslator({locale,messages:selected});
  assert.ok(t('System.requestFailed'));assert.ok(t('auth.retrySeconds',{seconds:30}).includes('30'));
  assert.deepEqual(selected.Taxonomy,original.Taxonomy);
  const taxonomyKeys=Object.values(JSON.parse(readFileSync(new URL('./i18n/taxonomy-label-index.json',import.meta.url),'utf8')));
  for(const key of taxonomyKeys) assert.equal(t.has(key),true,`Missing mapped category ${locale}: ${key}`);
 }
 assert.equal(checkClientMessageOmissions(),null);
});
test('client dependencies and lazy imports retain their keys; new references invalidate the generated selection',()=>{
 const root=mkdtempSync(join(tmpdir(),'cg-client-copy-'));
 const save=(name,content)=>{const file=join(root,name);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,content);};
 try{
  save('messages/de.json',JSON.stringify({Ui:{direct:'a',helper:'b',lazy:'c',server:'d',taxonomy:'t'},System:{one:'e',two:'f'}}));
  save('app/client.tsx',`"use client"; import {helper} from '@/lib/helper'; import('./lazy'); t('Ui.direct');`);
  save('lib/helper.ts',`import index from './labels.json' with {type:'json'}; export const helper = 'Ui.helper';`);
  save('lib/labels.json',JSON.stringify({category:'Ui.taxonomy'}));
  save('app/lazy.tsx',`t('Ui.lazy');`);
  save('app/server.tsx',`t('Ui.server');`);
  let result=clientMessageOmissions(root);assert.deepEqual(result.Ui,['server']);
  save('lib/i18n/client-message-omissions.json',JSON.stringify(result));assert.equal(checkClientMessageOmissions(root),null);
  save('lib/helper.ts',`export const helper = ['Ui.helper','Ui.server'];`);assert.ok(checkClientMessageOmissions(root));
  save('app/client.tsx',`"use client"; const t = useTranslations('Ui'); t(key);`);
  assert.deepEqual(clientMessageOmissions(root).Ui,[]);
  save('app/client.tsx','"use client"; t(`System.${key}`);');
  assert.deepEqual(clientMessageOmissions(root).System,[]);
  save('app/client.tsx','"use client"; const messages = useMessages();');
  assert.ok(Object.values(clientMessageOmissions(root)).every(keys=>keys.length===0));
 }finally{rmSync(root,{recursive:true,force:true});}
});
