import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';

const require=createRequire(import.meta.url);
function component(path){
 const source=readFileSync(new URL(path,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports',code)(require,mod,mod.exports);
 return mod.exports.default;
}
const Provider=component('../components/AppIntlProvider.tsx');
const CalendarDate=component('../components/DashboardDate.tsx');
function render(locale,now,tz){
 const previous=process.env.TZ;
 try{
  process.env.TZ=tz;
  return renderToStaticMarkup(React.createElement(Provider,{locale,messages:{},now},React.createElement(CalendarDate)));
 }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
}
test('old independent date formatting reproduces a different day between UTC and Safari in Berlin',()=>{
 const instant=new Date('2026-10-30T23:01:16Z');
 const previous=process.env.TZ;
 try{
  process.env.TZ='UTC';const server=instant.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'});
  process.env.TZ='Europe/Berlin';const browser=instant.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'});
  assert.notEqual(server,browser);
  assert.match(server,/30/);assert.match(browser,/31/);
 }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
for(const locale of ['de','en','es','it','cs','hu']){
 for(const instant of ['2026-10-30T23:01:16Z','2026-03-29T01:01:00Z','2026-10-25T01:01:00Z']){
  test(`actual dashboard date renders identical HTML across time zones: ${locale}, ${instant}`,()=>{
   const now=new Date(instant),server=render(locale,now,'UTC');
   assert.equal(render(locale,now,'Europe/Berlin'),server);
   assert.equal(render(locale,new Date(JSON.parse(JSON.stringify(now))),'America/Los_Angeles'),server);
   assert.ok(server.includes(instant.replace('Z','.000Z')));
   assert.ok(!server.includes('Invalid Date'));
  });
 }
}
test('root supplies the request clock to the shared provider and dashboard uses the tested component',()=>{
 const layout=readFileSync(new URL('../app/layout.tsx',import.meta.url),'utf8');
 assert.match(layout,/getNow\(\)/);assert.match(layout,/<AppIntlProvider[^>]+now=\{now\}/);
 const dashboard=readFileSync(new URL('../app/dashboard/page.tsx',import.meta.url),'utf8');
 assert.ok(dashboard.includes('<DashboardDate />'));
 assert.ok(!dashboard.includes('new Date().toLocaleDateString'));
});
