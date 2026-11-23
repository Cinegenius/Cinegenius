import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {fetchSetup} from './setup-fetch.ts';
import {responsiblePersonErrors,marketplaceResponsibleErrors} from './responsible-person.ts';
const source=readFileSync(new URL('../app/inserat/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('inserat.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),methods={};
function visit(node){if(ts.isFunctionDeclaration(node)&&['handleSubmit','handlePublishDraft'].includes(node.name?.text))methods[node.name.text]=node.getText(ast);if(ts.isArrowFunction(node)&&node.getText(ast).startsWith('async (e) =>')&&node.getText(ast).includes('setLocFloorUploading(true)'))methods.floorUpload=node.getText(ast);ts.forEachChild(node,visit);}visit(ast);
// Execute the actual save handlers with isolated UI state and transport. This
// does not simulate category editors or claim real-account publication tests.
function fixture(type,handler){
 const requests=[],state={loading:false,saving:false,step:2,error:'',createdId:null},person={firstName:'Own',lastName:'Provider',function:'',customFunction:'',public:false};let complete=0;
 const transport=async(url,init={})=>{requests.push({url,method:init.method,body:init.body?JSON.parse(init.body):null});const custom=await handler?.(url,init);return custom??Response.json({data:{id:'own-listing',moderation_status:'draft',published:false}});};
 const body=`
 const userId='own-account', selected={type:${JSON.stringify(type)}}, createInFlight={current:false}, publishInFlight={current:false};
 let createdId=null, createdIsDraft=false, marketReview=true;
 const router={push(){throw Error('No navigation')}}, listingDraft={loaded:true,complete:async()=>done()}, responsible=person;
 const articleGalleryState={uploading:false,failed:0},locationGalleryState=articleGalleryState;
 const marketText=key=>key,uiText=key=>key,moderation=key=>key,form={selected_place_city_id:''};
 const setResponsibleErrors=()=>{},focusResponsiblePerson=()=>{},setMarketReview=()=>{};
 const setSavingPrivate=v=>state.saving=v,setLoading=v=>state.loading=v,setError=v=>state.error=v,setStep=v=>state.step=v;
 const setCreatedId=v=>{state.createdId=v;createdId=v;},setCreatedIsDraft=v=>{createdIsDraft=v;},setCreatedPublished=v=>state.published=v;
 const setPublishingDraft=v=>state.publishing=v;
 const selectedCompanyId='',imageUrl=null,locExtraImages=[],articleImages=[],pendingImageFile=null;
 const buildPayload=()=>({type:selected.type,title:'Original title',city:'Berlin',category:'own-category'});
 const fetchSetup=(url,init)=>bounded(url,init,transport,30);
 ${methods.handleSubmit}
 return {save:handleSubmit};`;
 const compiled=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 const functions=new Function('state','person','transport','bounded','responsiblePersonErrors','marketplaceResponsibleErrors','done',compiled)(state,person,transport,fetchSetup,responsiblePersonErrors,marketplaceResponsibleErrors,()=>complete++);
 return {...functions,state,requests,complete:()=>complete};
}
for(const type of ['location','job','animal','creator'])test(`${type}: slow create releases its button, keeps recovery, and does not start duplicate concurrent creates`,async()=>{
 const f=fixture(type,(_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true})));
 const keepAlive=setTimeout(()=>{},1000);try{await Promise.all([f.save(),f.save()]);assert.equal(f.requests.length,1);assert.equal(f.state.loading,false);assert.equal(f.state.saving,false);assert.ok(f.state.error);assert.equal(f.complete(),0);assert.equal(f.state.step,2);}finally{clearTimeout(keepAlive);}
});
test('an unreadable create success does not clear the private draft or claim a saved listing',async()=>{const f=fixture('location',()=>new Response('not JSON'));await f.save();assert.equal(f.complete(),0);assert.equal(f.state.step,2);assert.ok(f.state.error);});
test('saved location is shown immediately even when legacy draft cleanup never responds',async()=>{const f=fixture('location',(url,init)=>init.method==='DELETE'?new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true})):null);await f.save();assert.equal(f.state.step,3);assert.equal(f.state.createdId,'own-listing');assert.equal(f.complete(),1);assert.equal(f.state.loading,false);await new Promise(r=>setTimeout(r,50));assert.ok(f.state.error,'separate cleanup failure stays truthful');});

for(const failure of ['network','http'])test(`optional floor-plan upload: ${failure} failure restores the picker and releases the spinner`,async()=>{
 assert.ok(methods.floorUpload,'actual floor-plan upload handler');
 const state={loading:false,preview:null,url:null,error:''};
 const code=`const setLocFloorUploading=v=>state.loading=v,setLocFloorPlanPreview=v=>state.preview=v,setLocFloorPlanUrl=v=>state.url=v,setError=v=>state.error=v;
 const safeObjectURL=()=>'/own-preview',uiText=key=>key,uiErrorMessage=(_cause,fallback)=>fallback;
 return (${methods.floorUpload});`;
 const compiled=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 const upload=new Function('state','fetchSetup',compiled)(state,async()=>{if(failure==='network')throw new TypeError('Failed to fetch');return Response.json({error:'Unavailable'},{status:503});});
 await upload({target:{files:[new File(['own drawing'],'own-plan.png',{type:'image/png'})]}});
 assert.equal(state.loading,false);assert.equal(state.preview,null);assert.equal(state.url,null);assert.ok(state.error);
});
