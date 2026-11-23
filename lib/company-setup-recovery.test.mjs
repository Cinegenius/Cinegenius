import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {setImmediate as turn} from 'node:timers/promises';
import ts from 'typescript';
import {createTranslator} from 'next-intl';
import {fetchSetup} from './setup-fetch.ts';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../app/company-setup/page.tsx',import.meta.url),'utf8');
const syntax=ts.createSourceFile('company.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const libs={};
for(const s of syntax.statements){if(!ts.isImportDeclaration(s)||s.importClause?.isTypeOnly)continue;const n=s.moduleSpecifier.text;if(n.startsWith('@/lib/')&&!['use-form-draft','use-form-router','compressImage'].includes(n.split('/').at(-1)))libs[n]=await import(new URL(`../${n.slice(2)}.ts`,import.meta.url));}
const messages=JSON.parse(readFileSync(new URL('../messages/de.json',import.meta.url),'utf8'));
const translate=namespace=>createTranslator({locale:'de',messages,namespace,onError(e){throw e;}});
const original={name:'Own test company',city:'Berlin, Deutschland',description:'Preserve my description',responsible:{firstName:'Own',lastName:'Contact',function:'owner',customFunction:'',public:false},step:3};
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
const text=n=>n==null||typeof n==='boolean'?'':typeof n==='string'||typeof n==='number'?String(n):Array.isArray(n)?n.map(text).join(' '):text(n.props?.children);

/** Real company page handlers; isolated account/draft and network fixtures. */
async function fixture({handler,privateDraft=null,flush=true,companyDraft=original,timeoutMs=1000}={}){
 let cursor=0,dirty=true,tree,effects=[],draftOptions,restored=false;
 const slots=[],requests=[],snapshots=[],navigation=[],focus=[];
 const equal=(a,b)=>a?.length===b?.length&&Array.isArray(b)&&b.every((v,i)=>Object.is(v,a[i]));
 const react={
  useState(value){const i=cursor++;slots[i]??={value:typeof value==='function'?value():value};return[slots[i].value,next=>{slots[i].value=typeof next==='function'?next(slots[i].value):next;dirty=true;}];},
  useRef(value){const i=cursor++;return slots[i]??={current:value};},
  useEffect(run,deps){const i=cursor++,old=slots[i];if(!old||!equal(old.deps,deps)){slots[i]={deps,cleanup:old?.cleanup};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=run();});}},
 };
 const transport=async(url,init={})=>{const r={url,method:init.method??'GET',body:init.body?JSON.parse(init.body):null};requests.push(r);const custom=await handler?.(r,init);if(custom)return custom;
  if(url==='/api/companies?mine=true')return Response.json({data:[]});
  if(url==='/api/onboarding'&&r.method==='GET')return Response.json({draft:{companyDraft:structuredClone(companyDraft)}});
  if(url==='/api/companies'&&r.method==='POST')return Response.json({data:{id:'own-company',slug:'own-test-company'}});
  if(r.method==='DELETE')return Response.json({completed:true});
  throw Error('Unexpected request '+url);
 };
 const imports={...libs,react,'react/jsx-runtime':require('react/jsx-runtime'),'next-intl':{useTranslations:translate},'@clerk/nextjs':{useUser:()=>({isLoaded:true,user:{id:'own-account'}})},
 '@/lib/setup-fetch':{fetchSetup:(url,init)=>fetchSetup(url,init,transport,timeoutMs)},
 '@/lib/use-form-router':{useFormRouter:()=>({replace:href=>navigation.push(href)})},
 '@/lib/compressImage':{safeObjectURL(){throw Error('No uploads');}},
 '@/lib/use-form-draft':{useFormDraft(options){draftOptions=options;react.useEffect(()=>{if(options.ready&&privateDraft&&!restored){restored=true;options.restore(privateDraft);}},[options.ready]);return{loaded:options.ready&&(!privateDraft||restored),status:'saved',complete:async()=>{},flush:async()=>{snapshots.push(structuredClone(draftOptions.value));return flush;}};}},
 };
 for(const s of syntax.statements){if(!ts.isImportDeclaration(s)||s.importClause?.isTypeOnly)continue;const n=s.moduleSpecifier.text;if(n.startsWith('@/components/')||n==='lucide-react'){imports[n]={__esModule:true,default:n.split('/').at(-1)};for(const b of s.importClause?.namedBindings?.elements??[])imports[n][b.propertyName?.text??b.name.text]=b.name.text==='focusResponsiblePerson'?()=>focus.push('responsible'):b.name.text;}}
 const mod={exports:{}};new Function('require','module','exports','window','document','requestAnimationFrame',compiled)(n=>{assert.ok(Object.hasOwn(imports,n),`Unknown import ${n}`);return imports[n];},mod,mod.exports,{location:{search:'?onboarding=1'}},{getElementById:id=>({scrollIntoView(){},focus(){focus.push(id);}})},run=>run());
 function render(){for(let n=0;n<30;n++){cursor=0;dirty=false;tree=mod.exports.default();const pending=effects;effects=[];pending.forEach(fn=>fn());if(!dirty)return;}assert.fail('Effects must settle');}
 async function settle(){for(let n=0;n<8;n++){await turn();if(dirty)render();}}
 render();await settle();
 return {requests,snapshots,navigation,focus,render,settle,tree:()=>tree,fields:()=>draftOptions.value,alerts:()=>nodes(tree).filter(n=>n.props?.role==='alert').map(text),
 async submit(){const form=nodes(tree).find(n=>n.type==='form');assert.ok(form,'editable form');await form.props.onSubmit({preventDefault(){}});await settle();},
 async retryLoad(){const b=nodes(tree).find(n=>n.type==='button'&&text(n)===translate()('notifications.retry'));assert.ok(b);b.props.onClick();await settle();},
 cleanup(){slots.forEach(s=>s.cleanup?.());}};
}

test('company retry uses the previously persisted creation key after a lost response, and cleanup cannot undo success',async()=>{
 let creates=0;
 const f=await fixture({handler:r=>{if(r.url==='/api/companies'&&++creates===1)throw new TypeError('Failed to fetch');if(r.method==='DELETE')throw new TypeError('Failed to fetch');}});
 try{await f.submit();assert.ok(f.alerts().length);assert.equal(f.fields().description,original.description);assert.equal(f.navigation.length,0);await f.submit();const posts=f.requests.filter(r=>r.method==='POST');assert.equal(posts.length,2);assert.ok(posts[0].body.onboarding_request_key);assert.equal(posts[0].body.onboarding_request_key,posts[1].body.onboarding_request_key);assert.equal(f.snapshots[0].creationKey,posts[0].body.onboarding_request_key);assert.deepEqual(f.navigation,['/companies/own-test-company?welcome=1']);}finally{f.cleanup();}
});

test('reopening a private company draft retains its request key and content',async()=>{
 const key='10000000-0000-4000-8000-000000000007';const f=await fixture({privateDraft:{...original,creationKey:key}});
 try{await f.submit();assert.equal(f.requests.find(r=>r.method==='POST').body.onboarding_request_key,key);assert.equal(f.snapshots[0].description,original.description);}finally{f.cleanup();}
});

test('failed company read cannot show/save an empty replacement and supports reload',async()=>{
 let reads=0;const f=await fixture({handler:r=>r.url==='/api/companies?mine=true'&&++reads===1?Response.json({error:'Temporary failure'},{status:503}):null});
 try{assert.ok(f.alerts().length);assert.equal(nodes(f.tree()).some(n=>n.type==='form'),false);assert.equal(f.requests.some(r=>r.method==='POST'),false);await f.retryLoad();assert.equal(f.fields().name,original.name);await f.submit();assert.equal(f.navigation.length,1);}finally{f.cleanup();}
});

test('company creation waits for durable recovery, instead of risking duplicates after reload',async()=>{
 const f=await fixture({flush:false});try{await f.submit();assert.ok(f.alerts().length);assert.equal(f.requests.some(r=>r.method==='POST'),false);assert.equal(f.fields().name,original.name);}finally{f.cleanup();}
});

test('invalid company basics return to the editable field instead of a silently disabled finish button',async()=>{
 const f=await fixture({companyDraft:{...original,city:''}});try{await f.submit();assert.ok(f.alerts().length);assert.deepEqual(f.focus,['company-city']);assert.equal(f.requests.some(r=>r.method==='POST'),false);}finally{f.cleanup();}
});

test('a timed-out company save releases the form and retains the same retry key',async()=>{
 let first=true;const f=await fixture({timeoutMs:30,handler:(r,init)=>{if(r.method==='POST'&&first){first=false;return new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));}}});
 const keepAlive=setTimeout(()=>{},1000);try{await f.submit();assert.ok(f.alerts().length);assert.equal(nodes(f.tree()).find(n=>n.type==='fieldset').props.disabled,false);await f.submit();assert.equal(f.navigation.length,1);const p=f.requests.filter(r=>r.method==='POST');assert.equal(p[0].body.onboarding_request_key,p[1].body.onboarding_request_key);}finally{clearTimeout(keepAlive);f.cleanup();}
});
