import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator} from 'next-intl';
import {PROFILE_TRAIT_MESSAGE_KEYS,profileTraitLabel,profileTraitOptions,profileTravelValue} from './profile-trait-labels.ts';
const require=createRequire(import.meta.url);
const locales=['de','en','es','it','cs','hu'];
const dictionaries=Object.fromEntries(locales.map(locale=>[locale,JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'))]));
const translate=locale=>createTranslator({locale,messages:dictionaries[locale],namespace:'profile'});
const htmlText=value=>renderToStaticMarkup(React.createElement('span',null,value)).slice(6,-7);

for(const locale of locales)test(`${locale}: all stable traits use the shared editor catalogue and keep filter identities`,()=>{
 const t=translate(locale);
 for(const [kind,keys] of Object.entries(PROFILE_TRAIT_MESSAGE_KEYS)){
  const values=Object.freeze(Object.keys(keys));
  const options=profileTraitOptions(kind,values,t,locale);
  assert.deepEqual(new Set(options.map(option=>option.value)),new Set(values));
  assert.deepEqual(options.map(option=>option.label),options.map(option=>option.label).toSorted(new Intl.Collator(locale,{sensitivity:'base'}).compare));
  for(const option of options){assert.equal(option.label,dictionaries[locale].profile[keys[option.value]]);assert.ok(option.label.trim());}
 }
 assert.equal(profileTraitLabel('eyes','brown',t),dictionaries[locale].profile.eyesBrown);
 assert.equal(profileTraitLabel('travel','national',t),dictionaries[locale].profile.travelNational);
});

test('unknown legacy/member values remain exact and are never guessed or rewritten',()=>{
 for(const kind of Object.keys(PROFILE_TRAIT_MESSAGE_KEYS))for(const value of ['Own custom trait / 42','Braun','unknown_legacy','constructor','__proto__','']){
  assert.equal(profileTraitLabel(kind,value,translate('de')),value);
  assert.equal(profileTraitOptions(kind,[value],translate('cs'),'cs')[0].value,value);
 }
});

test('explicit travel none and legacy readiness use the same precedence as directory/API values',()=>{
 assert.equal(profileTravelValue({availability_config:{travel:'none'},travel_ready:true}),'none');
 assert.equal(profileTravelValue({availability_config:{travel:'worldwide'},travel_ready:false}),'worldwide');
 assert.equal(profileTravelValue({availability_config:null,travel_ready:true}),'national');
 assert.equal(profileTravelValue({travel_ready:false}),'');
 assert.equal(profileTravelValue({availability_config:{travel:'Own legacy range'},travel_ready:false}),'Own legacy range');
 assert.equal(profileTraitLabel('travel','national',translate('de')),'Landesweit');
});

const nullComponent=()=>null;
const image=({src,alt})=>React.createElement('img',{src,alt});
const link=({href,children,...props})=>React.createElement('a',{href,...props},children);
async function load(file,locale,selections={},extraMocks={}){
 const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const mocks={
  'next/link':link,
  'next-intl':{useLocale:()=>locale,useTranslations:namespace=>createTranslator({locale,messages:dictionaries[locale],namespace,onError(){}})},
  '@clerk/nextjs':{useUser:()=>({user:null,isLoaded:true})},
  'next/navigation':{useRouter:()=>({refresh(){},push(){}})},
  '@/lib/use-view-url':{useViewUrl:()=>{}},
  '@/lib/use-view-state':{useViewState:(key,initial)=>React.useState(()=>Object.hasOwn(selections,key)?selections[key]:typeof initial==='function'?initial():initial)},
  '@/components/MediaImage':image,
  '@/components/ProfileCardPhoto':image,
  '@/components/EmptyState':({title})=>React.createElement('p',null,title),
  '@/components/PlaceFilters':nullComponent,
  '@/lib/profile-update-events':{subscribeToProfileUpdated:()=>()=>{}},
  './ProfileRoles':nullComponent,
  ...extraMocks,
 };
 for(const [,specifier]of source.matchAll(/require\("([^"]+)"\)/g)){
  if(Object.hasOwn(mocks,specifier))continue;
  if(specifier.startsWith('@/lib/'))mocks[specifier]=await import(new URL(`./${specifier.slice('@/lib/'.length)}.ts`,import.meta.url));
  else if(specifier.startsWith('@/components/'))mocks[specifier]=({children})=>React.createElement(React.Fragment,null,children);
 }
 const compiledModule={exports:{}};
 new Function('require','module','exports',source)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),compiledModule,compiledModule.exports);
 return compiledModule.exports;
}
const creator=(id,name,overrides={})=>({id,name,ownerId:id,role:'Own occupation',positions:[],location:'Own city',image:'',avatar:'',rating:0,reviews:0,dayRate:'',available:true,credits:[],skills:[],languages:[],verified:false,isReal:true,profile_type:'actor',profile_types:['actor'],hair_color:'brown',eye_color:'brown',body_type:'athletic',travel:'national',...overrides});
async function directory(locale,selections={}){
 const mobile=await load('../components/MobileBrowseControls.tsx',locale);
 const controls=({children,chips=[]})=>React.createElement('section',{'data-mobile-facets':true},children,...chips.map(chip=>React.createElement('span',{key:chip.id,'data-filter-chip':chip.id},chip.label)));
 const {default:Directory}=await load('../app/creators/CreatorsContent.tsx',locale,selections,{'@/components/MobileBrowseControls':{__esModule:true,...mobile,default:controls}});
 const profiles=[creator('matching-profile','Matching synthetic member'),creator('other-profile','Other synthetic member',{hair_color:'blonde',eye_color:'blue',body_type:'slim',travel:'worldwide'}),creator('no-travel-profile','No travel synthetic member',{eye_color:'Own custom eyes',travel:'none'}),creator('custom-travel-profile','Custom travel synthetic member',{travel:'Own legacy range'})];
 const before=JSON.stringify(profiles);
 const html=renderToStaticMarkup(React.createElement(Directory,{serverCreators:profiles,initialFilters:{query:'',city:'',sort:''}}));
 assert.equal(JSON.stringify(profiles),before,'Rendering must not rewrite source values');
 return html;
}
for(const locale of locales)test(`${locale}: actual mobile selects, selected desktop labels and chips use labels while filtering by raw IDs`,async()=>{
 const html=await directory(locale,{'crew.hairFilter':'brown','crew.eyeFilter':'brown','crew.bodyFilter':'athletic','crew.travelFilter':'national'});
 const t=translate(locale);
 assert.match(html,/<option value="brown" selected="">/);
 assert.ok(html.includes(`<option value="brown" selected="">${htmlText(t('eyesBrown'))}</option>`));
 assert.ok(html.includes(`<option value="athletic" selected="">${htmlText(t('bodyAthletic'))}</option>`));
 assert.ok(html.includes(`<option value="national" selected="">${htmlText(t('travelNational'))}</option>`));
 assert.ok(html.includes(`data-filter-chip="eyes">${htmlText(dictionaries[locale].creators.filterEyeColor+': '+t('eyesBrown'))}`));
 assert.ok(html.includes(`data-filter-chip="hair">${htmlText(dictionaries[locale].creators.filterHairColor+': '+t('hairBrown'))}`));
 assert.ok(html.includes('/profile/matching-profile'));assert.ok(!html.includes('/profile/other-profile'));assert.ok(!html.includes('/profile/no-travel-profile'));
});
test('travel none and unknown legacy eye values remain selectable with their exact original filters',async()=>{
 const html=await directory('de',{'crew.eyeFilter':'Own custom eyes','crew.travelFilter':'none'});
 assert.ok(html.includes('<option value="none" selected="">Nicht reisebereit</option>'));
 assert.ok(html.includes('<option value="Own custom eyes" selected="">Own custom eyes</option>'));
 assert.ok(html.includes('/profile/no-travel-profile'));assert.ok(!html.includes('/profile/matching-profile'));
 const customTravel=await directory('it',{'crew.travelFilter':'Own legacy range'});
 assert.ok(customTravel.includes('<option value="Own legacy range" selected="">Own legacy range</option>'));
 assert.ok(customTravel.includes('/profile/custom-travel-profile'));assert.ok(!customTravel.includes('/profile/matching-profile'));
});

for(const locale of locales)test(`${locale}: public actor/model facts and existing travel facts share the same translated labels`,async()=>{
 const {default:Profile}=await load('../app/profile/[slug]/ProfileView.tsx',locale);
 for(const type of ['actor','model','camera']){
  const profile={user_id:'own-synthetic',display_name:'Synthetic public profile',profile_type:type,profile_types:[type],physical:{hair_color:'brown',eye_color:'brown',body_type:'athletic'},availability_config:{travel:'none'},travel_ready:true,available:true,profile_images:[],portfolio_images:[],positions:[],languages:[],skills:[],filmography:[],awards:[],performance:{},visibility:{},crew:{}};
  const before=JSON.stringify(profile),html=renderToStaticMarkup(React.createElement(Profile,{profile,isOwner:false}));
  const t=translate(locale);
  if(type==='actor'||type==='model'){assert.ok(html.includes(htmlText(t('hairBrown'))));assert.ok(html.includes(htmlText(t('eyesBrown'))));}
  if(type==='actor')assert.ok(html.includes(htmlText(t('bodyAthletic'))));
  if(type!=='model')assert.ok(html.includes(htmlText(t('travelNone'))));
  assert.equal(JSON.stringify(profile),before);
 }
});


for(const locale of locales)test(`${locale}: legacy creator detail retains its boolean readiness and localizes the existing hint`,async()=>{
 const {default:CreatorDetail}=await load('../components/CreatorDetail.tsx',locale);
 const source=creator('legacy-profile','Synthetic legacy profile',{travel_ready:true});
 const before=JSON.stringify(source),html=renderToStaticMarkup(React.createElement(CreatorDetail,{creator:source}));
 assert.ok(html.includes(htmlText(dictionaries[locale].profile.fieldTravelReady)));
 assert.equal(JSON.stringify(source),before);
 const without=renderToStaticMarkup(React.createElement(CreatorDetail,{creator:{...source,travel_ready:false}}));
 assert.ok(!without.includes(htmlText(dictionaries[locale].profile.fieldTravelReady)));
});
