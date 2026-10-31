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
 return {documentNavigations,routeNavigations,navigate:url=>mod.exports.navigate(url,'/dashboard',target=>{
  // Clerk's public navigate method chooses a document redirect for external ITP URLs.
  if(target.startsWith('/')) routeNavigations.push(target);
  else documentNavigations.push(target);
 })};
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

test('session finalization waits for the actual navigation before publishing auth state',async()=>{
 let finishRoute;
 const routeFinished=new Promise(resolve=>{finishRoute=resolve});
 const events=[];
 const mod={exports:{}};
 new Function('window','resolveAuthNavigationUrl','exports',code)({location:{origin:'https://www.cinegenius.co',replace:()=>assert.fail('internal navigation must preserve the document')}},resolveAuthNavigationUrl,mod.exports);
 const completion=finalizeThenNavigate(async({navigate})=>{
  await navigate({decorateUrl:url=>url});
  events.push('session published');
  return {error:null};
 },'/dashboard',url=>mod.exports.navigate(url,'/dashboard',()=>{
  events.push('navigation started');
  return routeFinished;
 }));
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(events,['navigation started']);
 finishRoute();
 await completion;
 assert.deepEqual(events,['navigation started','session published']);
});

test('failed navigation is returned to finalization instead of reporting success',async()=>{
 const failure=new Error('route unavailable');
 await assert.rejects(finalizeThenNavigate(async({navigate})=>{
  await navigate({decorateUrl:url=>url});
  assert.fail('failed route must not finalize successfully');
 },'/dashboard',()=>Promise.reject(failure)),failure);
});

test('sign-in and registration both use the SDK awaitable replace adapter',()=>{
 for(const name of ['SignInForm','SignUpForm']){
  const form=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name).getText(ast);
  assert.match(form,/const clerk = useClerk\(\)/);
  assert.match(form,/finishNavigation\([\s\S]*?clerk\.navigate\(target, \{ replace: true \}\)/);
 }
 assert.doesNotMatch(node.getText(ast),/window\.location\.(replace|assign|href)/);
});

test('external Safari cookie refresh is delegated to Clerk so its unload tracker can stop activation',async()=>{
 const events=[];
 const mod={exports:{}};
 new Function('window','resolveAuthNavigationUrl','exports',code)({location:{origin:'https://www.cinegenius.co',replace:()=>assert.fail('raw document redirect bypasses Clerk unload notification')}},resolveAuthNavigationUrl,mod.exports);
 const target='https://clerk.cinegenius.co/v1/client/touch?redirect_url=%2Fdashboard';
 await finalizeThenNavigate(async({navigate})=>{
  await navigate({decorateUrl:()=>target});
  assert.deepEqual(events,['SDK document unload']);
  return {error:null};
 },'/dashboard',url=>mod.exports.navigate(url,'/dashboard',sdkTarget=>{
  assert.equal(sdkTarget,target);
  events.push('SDK document unload');
 }));
});
