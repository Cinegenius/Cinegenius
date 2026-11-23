import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {createTranslator} from 'next-intl';
const require=createRequire(import.meta.url);
const image=({src,alt,className,style})=>React.createElement('img',{src:src||undefined,alt,className,style});
export async function verificationUI(file,locale='de',overrides={}) {
 const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const messages=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'));
 const mocks={
  'next-intl':{useLocale:()=>locale,useTranslations:namespace=>createTranslator({locale,messages,namespace})},
  'next/link':({children,href,...props})=>React.createElement('a',{href,...props},children),
  '@clerk/nextjs':{useUser:()=>({user:null,isLoaded:true})},
  'next/navigation':{useRouter:()=>({refresh(){},push(){}})},
  '@/lib/use-native-app-appearance':{useNativeAppAppearance:()=>false},
  '@/lib/use-view-url':{useViewUrl(){}},
  '@/lib/use-browse-geography':{useBrowseGeography:()=>({preferred:null,enabled:false,setEnabled(){}})},
  '@/lib/use-directory-map':{useDirectoryMap:(_scope,_key,items)=>({rows:items,bounds:null,setBounds(){}})},
  '@/lib/use-view-state':{useViewState:(_key,initial)=>React.useState(initial)},
  '@/components/MediaImage':image,'@/components/ProfileCardPhoto':image,'@/components/ResilientPublicImage':image,
  '@/components/ContentTranslation':{TranslatedText:({children})=>children,useTranslatedContent:({source})=>({text:source})},
  './ProfileRoles':()=>null,
  ...overrides,
 };
 for(const [,name] of code.matchAll(/require\("([^"]+)"\)/g)) {
  if(Object.hasOwn(mocks,name))continue;
  if(name.endsWith('/VerifiedBadge')||name==='./VerifiedBadge')mocks[name]=await verificationUI('../components/VerifiedBadge.tsx',locale);
  else if(name.startsWith('@/lib/'))mocks[name]=await import(new URL(`./${name.slice(6)}.ts`,import.meta.url));
  else if(['./MediaImage','./ListingImage'].includes(name))mocks[name]=image;
  else if(name==='./MapResultSummary')mocks[name]=()=>null;
  else if(name.startsWith('@/components/'))mocks[name]=({children})=>React.createElement(React.Fragment,null,children);
  else if(name.endsWith('.module.css'))mocks[name]={};
 }
 const mod={exports:{}};
 new Function('require','module','exports',code)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);
 return mod.exports;
}
export const verificationProfile=(type,verified,photo=false)=>({user_id:'synthetic-member',display_name:'Synthetic Crew Member',profile_type:type,profile_types:[type],verified,avatar_url:photo?'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="navy"/></svg>':null,physical:{},available:true,profile_images:[],portfolio_images:[],positions:[],languages:[],skills:[],filmography:[],awards:[],performance:{},visibility:{},crew:{}});
