import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {resolveAuthNavigationUrl,finalizeThenNavigate} from './sign-in-flow.ts';

const text=readFileSync(new URL('../components/AuthForm.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('AuthForm.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const node=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='finishNavigation');
const code=ts.transpileModule(node.getText(ast)+'\nexports.navigate=finishNavigation;',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(){
 const documentNavigations=[],routeNavigations=[];const mod={exports:{}};
 new Function('window','resolveAuthNavigationUrl','exports',code)({location:{origin:'https://www.cinegenius.co',replace:url=>documentNavigations.push(url)}},resolveAuthNavigationUrl,mod.exports);
 return {documentNavigations,routeNavigations,navigate:url=>mod.exports.navigate(url,'/dashboard',target=>routeNavigations.push(target))};
}
test('ordinary sign-in destinations use the existing client router without replacing the document',async()=>{
 for(const target of ['/dashboard','/profile-setup?welcome=1','/inserat?group=locations','https://www.cinegenius.co/dashboard?tab=messages']){
  const f=fixture();await finalizeThenNavigate(async({navigate})=>{navigate({decorateUrl:()=>target});return{error:null}},target,f.navigate);
  assert.equal(f.routeNavigations.length,1);assert.equal(f.documentNavigations.length,0);
 }
});
test('Clerk Safari cookie touch keeps its external document navigation and is not sent through the app router',async()=>{
 const f=fixture(),target='https://clerk.cinegenius.co/v1/client/touch?redirect_url=%2Fdashboard';
 await finalizeThenNavigate(async({navigate})=>{navigate({decorateUrl:()=>target});return{error:null}},'/dashboard',f.navigate);
 assert.deepEqual(f.documentNavigations,[target]);assert.deepEqual(f.routeNavigations,[]);
});
test('unsafe navigation falls back to the already validated internal destination',()=>{
 const f=fixture();f.navigate('javascript:alert(1)');assert.deepEqual(f.routeNavigations,['/dashboard']);assert.deepEqual(f.documentNavigations,[]);
});
