import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {PLATFORMS,getPlatform} from './external-platforms.ts';

const source=readFileSync(new URL('../app/profile/[slug]/ProfileView.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('ProfileView.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const functions=ast.statements.filter(node=>ts.isFunctionDeclaration(node)&&['safeLink','ExternalProfilesDisplay'].includes(node.name?.text));
const fixture=ts.transpileModule(functions.map(node=>node.getText(ast)).join('\n')+'\nexports.render=ExternalProfilesDisplay;',{
 compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const mod={exports:{}};
new Function('React','getPlatform','ExternalLink','exports',fixture)(React,getPlatform,()=>null,mod.exports);

test('every configured external profile remains identifiable and linked without third-party icon requests',()=>{
 for(const platform of PLATFORMS){
  const href='https://'+(platform.urlHints[0]||'example.org')+'/own-test';
  const html=renderToStaticMarkup(React.createElement(mod.exports.render,{profiles:[{
   id:'own-profile-link',platform_type:platform.type,platform_name:platform.type==='other'?'Own platform':null,
   url:href,custom_label:'Own label',sort_order:0,is_public:true,
  }]}));
  assert.ok(html.includes('href="'+href+'"'));
  assert.ok(html.includes(platform.abbr));assert.ok(html.includes('Own label'));
  assert.doesNotMatch(html,/<img|google\.com|gstatic\.com|class="[^"]*\bhidden\b/);
  assert.match(html,/rel="noopener noreferrer"/);
 }
});
test('private or unusable external profile entries remain absent',()=>{
 const html=renderToStaticMarkup(React.createElement(mod.exports.render,{profiles:[
  {id:'private',platform_type:'crew_united',url:'https://crew-united.com/own-private',is_public:false},
  {id:'empty',platform_type:'crew_united',url:'',is_public:true},
 ]}));
 assert.doesNotMatch(html,/href=|own-private|<img/);
});
