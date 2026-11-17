import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import ts from "typescript";
import {translatorFor,intlServerFor} from "./i18n-test-fixture.mjs";
import {SUPPORTED_LOCALES} from "./i18n/locales.ts";
import {taxonomyLabel} from "./departments.ts";
import * as messaging from "./messaging-ui.ts";
const require=createRequire(import.meta.url);
const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const options={module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX};
function sourceFunction(path,name,scope){
 const parsed=ts.createSourceFile(path,source(path),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const node=parsed.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);
 assert.ok(node,path+" / "+name);
 const code=ts.transpileModule(node.getText(parsed).replace(/^export\s+/,""),{compilerOptions:options}).outputText;
 return new Function("require","exports",...Object.keys(scope),code+";return "+name)(require,{},...Object.values(scope));
}
function elements(node,predicate,result=[]){
 if(Array.isArray(node))node.forEach(child=>elements(child,predicate,result));
 else if(node?.props){if(predicate(node))result.push(node);elements(node.props.children,predicate,result);}
 return result;
}
function peoplePicker(locale){
 const code=ts.transpileModule(source("components/messaging/PeoplePicker.tsx"),{compilerOptions:options}).outputText;
 const mocks={react:{useState:initial=>[initial,()=>assert.fail("A passive people list must not change input")],useEffect:()=>{}},"next-intl":{useTranslations:namespace=>translatorFor(locale,namespace)},"lucide-react":{Check:"check-icon",Loader2:"loader-icon",Search:"search-icon",User:"user-icon",X:"close-icon"},"@/components/UnoptimizedImage":{default:"media-image"},"@/lib/messaging-ui":messaging,"@/lib/departments":{taxonomyLabel}};
 const mod={exports:{}};
 new Function("require","module","exports",code)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);
 return mod.exports.default;
}
const titles=["Gaffer (Oberbeleuchter)","Oberbeleuchterin","Own custom profession"];
for(const locale of SUPPORTED_LOCALES)test(`public collaboration, metadata and recipient titles use ${locale} display labels without rewriting member wording`,async()=>{
 const ui=translatorFor(locale),expected=titles.map(title=>taxonomyLabel(title,ui));
 assert.equal(expected[0],expected[1]);assert.equal(expected[2],titles[2]);
 const collaborators=titles.map((role,index)=>({label:"Own collaboration label",display_name:"Member "+index,avatar_url:null,slug:"member-"+index,role}));
 const snapshot=JSON.stringify(collaborators);
 const Collaborations=sourceFunction("app/profile/[slug]/ProfileView.tsx","CollaborationsSection",{useTranslations:namespace=>translatorFor(locale,namespace),taxonomyLabel,Divider:()=>null,SectionLabel:"h2",Link:"a",Users2:"users-icon"});
 const tree=Collaborations({collaborations:collaborators});
 for(const label of expected)assert.ok(elements(tree,node=>node.type==="p"&&node.props.children===label).length,label);
 assert.equal(elements(tree,node=>node.type==="p"&&node.props.children==="Own collaboration label").length,3);
 assert.equal(JSON.stringify(collaborators),snapshot);
 const recipients=titles.map((role,index)=>({id:"member-"+index,name:"Member "+index,role}));
 const picker=peoplePicker(locale),recipientSnapshot=JSON.stringify(recipients);
 const pickerTree=picker({contacts:recipients,selected:[],onChange:()=>assert.fail("Showing people must not send or select")});
 for(const label of expected)assert.ok(elements(pickerTree,node=>node.type==="span"&&node.props.children===label).length,label);
 assert.equal(JSON.stringify(recipients),recipientSnapshot);
 for(const [index,role]of titles.entries()){
  const profile={user_id:"public-member",display_name:"Unchanged member name",role,avatar_url:null,tagline:"Own member wording"};
  const before=JSON.stringify(profile),intl=intlServerFor(locale);
  const metadata=sourceFunction("app/profile/[slug]/page.tsx","generateMetadata",{getPageTranslations:intl.getTranslations,getMetadataTranslations:intl.getTranslations,getProfile:async()=>profile,auth:async()=>({userId:"reader"}),canViewProfile:async()=>true,taxonomyLabel});
  const result=await metadata({params:Promise.resolve({slug:"public-member"})});
  assert.equal(result.title,"Unchanged member name — "+expected[index]+" · CineGenius");
  assert.equal(result.description,"Own member wording");assert.equal(JSON.stringify(profile),before);
 }
});
