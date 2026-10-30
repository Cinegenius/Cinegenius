import * as marketplaceOffer from "./marketplace-offer.ts";
import * as marketplaceCatalog from "./marketplaceCategories.ts";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as taxonomy from './profile-types.ts';
import * as ranking from './rating-ranking.ts';
const require=createRequire(import.meta.url);
const checked='/api/media/profile-media/avatars/user_test/0123456789abcdef0123456789abcdef.webp';
const legacy='https://storage-test.supabase.co/storage/v1/object/public/listing-images/own-test.webp';
const clerk='https://img.clerk.com/own-test-avatar';
const rows=[checked,legacy,clerk,null,checked].map((avatar_url,index)=>({
 user_id:index===4?'private-test':`own-test-${index}`,slug:`own-test-${index}`,display_name:`Own Test ${index}`,
 avatar_url,location:'Own city',profile_type:'lighting',profile_types:['lighting'],positions:['Best Boy Electric'],
 created_at:new Date(Date.UTC(2026,9,28,12,index)).toISOString(),verified:false,role:null,tagline:null,
}));
function fixture(listings=[]){
 const db={from(table){const predicates=[];const q={select(){return q},eq(key,value){predicates.push(row=>row[key]===value);return q},in(key,values){predicates.push(row=>values.includes(row[key]));return q},not(key,_op,value){predicates.push(row=>row[key]!==value);return q},neq(){return q},order(){return q},limit(){return q},then(resolve){return Promise.resolve({data:table==='profiles'?rows:table==='listings'?listings.filter(row=>predicates.every(predicate=>predicate(row))):[],error:null}).then(resolve)}};return q}};
 const noop=()=>null;
 const mocks={
  '@/lib/listing-price':{listingPriceLabel:()=> 'VB'},'@/lib/db':{db},'@/lib/listing-provider':{getListingProviders:async()=>[]},'@/lib/listing-routes':{listingDetailPath:(type,id)=>`/${type==='vehicle'?'vehicles':'props'}/${id}`},
  '@clerk/nextjs/server':{auth:async()=>({userId:null})},'next/link':{default:({href,children})=>React.createElement('a',{href},children)},
  '@/components/MediaImage':{default:({src,alt})=>React.createElement('img',{src,alt})},'next-intl/server':{getLocale:async()=>"de",getTranslations:async()=>key=>key},
  '@/components/HeroSearch':{default:noop},'@/components/CommunityBoard':{default:noop},'@/components/HomeCompanyPartners':{default:noop},
  '@/components/PageHeader':{PageBackdrop:noop},'@/lib/companyCategories':{COMPANY_CATEGORIES:[]},'@/components/HomePhotoDiscovery':{HomePhotoDiscovery:noop},
  '@/components/Skeleton':{SkeletonBox:noop},
  '@/lib/profile-types':taxonomy,'@/lib/trust':{getPrivateProfileIds:async()=>new Set(['private-test'])},
  '@/lib/ratings':{fetchRatingSummaries:async()=>({})},'@/lib/community-media-server':{getCommunityMedia:async()=>({photos:[]})},
  '@/lib/rating-ranking':ranking,
 };
 const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8')+'\nexport {getHomeData,HomeRecommendations};';
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',code)(name=>Object.hasOwn(mocks,name)?mocks[name]:name==="@/lib/marketplace-offer"?marketplaceOffer:name==="@/lib/marketplaceCategories"?marketplaceCatalog:require(name),mod,mod.exports);return mod.exports;
}
test('homepage preserves checked-media, legacy Storage and existing Clerk avatar sources instead of silently dropping them',async()=>{
 const data=await fixture().getHomeData(null);
 const avatars=new Map(data.newCrew.map(profile=>[profile.id,profile.avatar]));
 assert.equal(avatars.get('own-test-0'),checked);
 assert.equal(avatars.get('own-test-1'),legacy);
 assert.equal(avatars.get('own-test-2'),clerk);
 assert.equal(avatars.get('own-test-3'),undefined);
 assert.equal(avatars.has('private-test'),false);
});
test('homepage cards render each stored public avatar and retain initials only for a genuinely missing avatar',async()=>{
 const html=renderToStaticMarkup(await fixture().HomeRecommendations({viewerId:null}));
 for(const src of [checked,legacy,clerk])assert.ok(html.includes(`src="${src}"`));
 assert.match(html,/Own Test 3/);assert.doesNotMatch(html,/Own Test 4|private-test/);
 assert.ok(html.includes('href="/profile/own-test-0"'));
});

test('ordinary homepage offers without images remain discoverable and never render an empty image source',async()=>{
 const listings=['prop','vehicle','location'].map((type,index)=>({id:`own-no-photo-${index}`,type,title:`Own media-free ${type}`,city:'Own city',price:0,published:true,image_url:null,metadata:{},created_at:'2026-10-29T08:00:00Z'}));
 const home=fixture(listings),data=await home.getHomeData(null);
 assert.equal(data.liveProps.length,2);assert.equal(data.liveLocations.length,1);
 const html=renderToStaticMarkup(await home.HomeRecommendations({viewerId:null}));
 for(const type of ['prop','vehicle','location'])assert.match(html,new RegExp(`Own media-free ${type}`));
 assert.doesNotMatch(html,/src=""|src="null"/);
});
