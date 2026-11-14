import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as records from './navigation-context.ts';

function fixture(owner='guest') {
 const listeners=new Map(),layouts=[];let value;
 const browser={history:{state:records.mergeViewRecord({},'/creators',owner,{fields:{department:'licht'}})},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const mocks={
  react:{useState:initial=>{value=typeof initial==='function'?initial():initial;return[value,next=>{value=next}]},useRef:current=>({current}),useEffect:()=>{},useLayoutEffect:fn=>layouts.push(fn),useCallback:fn=>fn,useContext:()=>null},
  'next/navigation':{usePathname:()=>'/creators'},'@clerk/nextjs':{useAuth:()=>({userId:owner==='guest'?null:owner,isLoaded:true})},
  '@/lib/navigation-context':records,'@/lib/server-admin-context':{ServerAdminContext:{}},
 };
 const module={exports:{}};
 const source=ts.transpileModule(readFileSync(new URL('./use-view-state.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports','window',source)(name=>{assert.ok(Object.hasOwn(mocks,name),name);return mocks[name]},module,module.exports,browser);
 module.exports.useViewState('department','all');for(const layout of layouts)layout();
 return{browser,value:()=>value,traverse:state=>listeners.get('popstate')({state})};
}

test('Back restores the destination event even when an earlier router listener rewrote current history',()=>{
 const f=fixture();assert.equal(f.value(),'licht');
 const destination=records.mergeViewRecord({},'/creators','guest',{fields:{department:'kamera'}});
 // Current history still contains Licht because a preceding router callback replaced it.
 f.traverse(destination);assert.equal(f.value(),'kamera');
 const forward=records.mergeViewRecord({},'/creators','guest',{fields:{department:'licht'}});
 f.browser.history.state=destination;f.traverse(forward);assert.equal(f.value(),'licht');
});

test('a restored snapshot from a different signed-in account cannot supply private controls',()=>{
 const f=fixture('member-a');f.traverse(records.mergeViewRecord({},'/creators','member-b',{fields:{department:'private-other-account'}}));assert.equal(f.value(),'all');
});
