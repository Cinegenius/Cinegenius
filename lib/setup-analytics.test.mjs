import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {setupAnalyticsArea,setupAnalyticsFlow,setupAnalyticsProperties} from './setup-analytics.ts';

test('closed taxonomy rejects unrelated routes, unknown values and false completion stages',()=>{
 const base={flow:'profile_setup',step:'review',area:'crew'};
 for(const path of ['/admin','/dashboard','/profile/person','/sign-in','/profile-setup/private','/profile-setup?private=value','//profile-setup']) {
  assert.equal(setupAnalyticsFlow(path),null);assert.equal(setupAnalyticsProperties('setup_completed',base,path),null);
 }
 for(const values of [{...base,area:'private name'},{...base,step:'private text'},{...base,flow:'unknown'},{...base,step:'details'}])assert.equal(setupAnalyticsProperties('setup_completed',values,'/profile-setup'),null);
 assert.equal(setupAnalyticsProperties('$pageview',base,'/profile-setup'),null);
 assert.equal(setupAnalyticsProperties('setup_error',{...base,error_code:'email@example.invalid'},'/profile-setup'),null);
 assert.equal(setupAnalyticsProperties('setup_submitted',{flow:'registration',step:'credentials',area:'company'},'/sign-up'),null);
 assert.equal(setupAnalyticsArea([]),'unselected');assert.equal(setupAnalyticsArea(['invalid-person-name']),'unselected');assert.equal(setupAnalyticsArea(['crew','company']),'multiple');
 for(const area of ['crew','talent','company','location','equipment','search'])assert.equal(setupAnalyticsArea([area]),area);
});

// Execute the actual completion method with controlled transports; do not infer
// completion from the review page, a click, or a partially saved content record.
const source=readFileSync(new URL('../components/ProfileSetupWizard.tsx',import.meta.url),'utf8');
const syntax=ts.createSourceFile('wizard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let completion;
function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='clearAndContinue')completion=node.getText(syntax);ts.forEachChild(node,visit)}visit(syntax);
assert.ok(completion);
const body=ts.transpileModule(completion+'\nreturn clearAndContinue;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
for(const area of ['crew','talent','company','location','equipment'])test(`${area}: actual completion waits for server acknowledgement; failures never count as completed`,async()=>{
 for(const scenario of ['ok','http-error','unconfirmed','network']){
  const observations=[],state=[];
  const response=scenario==='ok'?Response.json({completed:true}):scenario==='http-error'?Response.json({completed:true},{status:503}):Response.json({completed:false});
  const complete=new Function('setCompletionPending','saveQueue','fetchSetup','uiText','setRetrySeconds','setProfilePublic','draftProtection','setFinished','setSaveState','requestAnimationFrame','window','captureSetup',body)(
   value=>state.push(['pending',value]),{settle:async()=>{}},async()=>{if(scenario==='network')throw Error('private failure');return response},key=>key,()=>{},()=>{}, {complete:()=>state.push(['protected-complete'])},value=>state.push(['finished',value]),()=>{},fn=>fn(),{scrollTo(){}},event=>observations.push(event));
  const draft={intents:[area],completed:{profile:false,listings:{}}};
  if(scenario==='ok'){await complete(draft);assert.deepEqual(observations,['setup_completed']);assert.ok(state.some(x=>x[0]==='finished'));}
  else {await assert.rejects(complete(draft));assert.deepEqual(observations,[]);assert.ok(!state.some(x=>x[0]==='finished'));}
 }
});
