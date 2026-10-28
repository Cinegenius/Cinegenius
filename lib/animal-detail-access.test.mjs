import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function fixture(){
 let viewer=null,canEdit=false,error=null;
 const id='11111111-1111-4111-8111-111111111111';
 let row={id,user_id:'own-test-owner',company_id:'own-agency',type:'animal',title:'Own fictional film dog',category:'Hunde',city:'Own city',published:false,image_url:'/api/media/own-photo',extra_images:['/api/media/own-second'],metadata:{special_skills:'Own fictional skills'}};
 const queries=[];const query={select(value){queries.push(value);return query},eq(){return query},maybeSingle:async()=>({data:row,error})};
 const mocks={
  '@/components/JsonLd':{default:'json-ld'},'@/components/TiereDetail':{default:'animal-detail'},
  'next/navigation':{notFound(){throw new Error('404')}},'@clerk/nextjs/server':{auth:async()=>({userId:viewer})},
  'next-intl/server':{getTranslations:async()=>key=>key},'@/lib/db':{db:{from:()=>query}},
  '@/lib/listing-access':{canEditListing:async actor=>actor==='own-test-owner'&&canEdit},
  '@/lib/listing-provider':{getListingProvider:async()=>({contactUserId:'actual-company-owner',name:'Own fictional agency',href:'/companies/own-agency',imageUrl:null})},
 };
 const code=ts.transpileModule(readFileSync(new URL('../app/tiere/[slug]/page.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',code)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);
 return {page:mod.exports.default,metadata:mod.exports.generateMetadata,args:{params:Promise.resolve({slug:id}),searchParams:Promise.resolve({})},setViewer(value,allowed=false){viewer=value;canEdit=allowed},setPublic(value){row.published=value},fail(){error={message:'Own test connection failure'}},queries};
}
test('actual animal detail protects drafts, allows only authorized preview, and uses actual provider and ordered photos',async()=>{
 const f=fixture();await assert.rejects(f.page(f.args),/404/);
 f.setViewer('foreign-member');await assert.rejects(f.page({...f.args,searchParams:Promise.resolve({preview:'1'})}),/404/);
 f.setViewer('own-test-owner',true);await assert.rejects(f.page(f.args),/404/);
 let page=await f.page({...f.args,searchParams:Promise.resolve({preview:'1'})});
 let detail=page.props.children[1].props.animal;
 assert.equal(detail.privatePreview,true);assert.equal(detail.ownerHref,'/companies/own-agency');assert.equal(detail.ownerId,'actual-company-owner');assert.deepEqual(detail.extra_images,['/api/media/own-second']);assert.equal(page.props.children[0],false);
 assert.deepEqual((await f.metadata(f.args)).robots,{index:false,follow:false});
 f.setPublic(true);f.setViewer(null);page=await f.page(f.args);detail=page.props.children[1].props.animal;
 assert.equal(detail.privatePreview,false);assert.equal(page.props.children[0].props.data['@type'],'CreativeWork');assert.equal(page.props.children[0].props.data.offers,undefined);
 assert.equal((await f.metadata(f.args)).title,'Own fictional film dog');
 f.setPublic(false);await assert.rejects(f.page(f.args),/404/);
 f.fail();await assert.rejects(f.page(f.args),/could not be loaded/); // Technical error must not become an invented 404.
});
