import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {intlServerFor,translatorFor} from './i18n-test-fixture.mjs';
import * as protectedMedia from './protected-media.ts';
import * as icons from 'lucide-react';

const picture='/api/media/own-fixture/0123456789abcdef0123456789abcdef.webp';
const logo='/api/media/own-fixture/fedcba9876543210fedcba9876543210.webp';
const organizations=Array.from({length:6},(_,index)=>({id:`org-${index}`,slug:`fixture-org-${index}`,name:index===0?'Fixture & Friends <Team>':`Fixture organization ${index}`,city:index===1?null:'Fixture city',logo_url:index%2?null:logo,private_contact:'PRIVATE_CONTACT_CANARY'}));
const entries=Array.from({length:3},(_,index)=>({id:`entry-${index}`,slug:`fixture-entry-${index}`,title:index===0?'Fixture <script>title</script> & "quoted"':`Fixture title ${index}`,summary:index===2?null:'Fixture public summary',entry_type:index===1?'event':'news',image_url:index===0?picture:null,created_at:'2026-11-10T12:00:00.000Z',starts_at:index===1?'2026-12-01T12:00:00.000Z':null,organization:index===1?[organizations[index]]:organizations[index],private_note:'PRIVATE_ENTRY_CANARY'}));
function compile(relative,mocks){
 const code=ts.transpileModule(readFileSync(new URL(relative,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const loaded={exports:{}};new Function('require','module','exports',code)(name=>{assert.ok(Object.hasOwn(mocks,name),`Unmocked editorial dependency ${name}`);return mocks[name];},loaded,loaded.exports);return loaded.exports;
}
function fixture({locale='de',orgs=organizations,posts=entries,orgResult,postResult}={}){
 const calls=[],images=[];
 const MediaImage=compile('../components/MediaImage.tsx',{
  'react/jsx-runtime':jsxRuntime,'@/lib/protected-media':protectedMedia,
  'next/image':{default:props=>{images.push(props);return React.createElement('img',{src:props.src,alt:props.alt,width:props.width,height:props.height,className:props.className});}},
 }).default;
 const component=compile('../components/organizations/HomeOrganizations.tsx',{
  'react/jsx-runtime':jsxRuntime,'next-intl/server':intlServerFor(locale),
  'lucide-react':icons,
  'next/link':{default:({href,children,...props})=>React.createElement('a',{href,...props},children)},
  '@/components/MediaImage':{default:MediaImage},
  '@/lib/organization-discovery':{
   organizationDiscovery:async(...args)=>{calls.push({kind:'organizations',args});return orgResult??{organizations:orgs,hasMore:false,page:1};},
   latestOrganizationEntries:async(...args)=>{calls.push({kind:'entries',args});return postResult??posts;},
  },
 }).default;
 return{component,calls,images,render:async()=>{const tree=await component();return tree?renderToStaticMarkup(tree):'';}};
}
const escaped=value=>renderToStaticMarkup(React.createElement(React.Fragment,null,value));
for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv'])test(`editorial organization footer ${locale}: native headings/dates, all approved preview links and safe optional media`,async()=>{
 const f=fixture({locale}),html=await f.render(),t=translatorFor(locale,'OrganizationDiscovery'),entryT=translatorFor(locale,'Organizations');
 for(const key of ['eyebrow','title','allEntries','organizations','allOrganizations'])assert.ok(html.includes(escaped(t(key))),`${locale}/${key}`);
 assert.ok(html.includes(escaped(entryT('entryType.news'))));assert.ok(html.includes(escaped(entryT('entryType.event'))));
 for(const entry of entries){const org=Array.isArray(entry.organization)?entry.organization[0]:entry.organization;assert.ok(html.includes(`href="/news/${org.slug}/${entry.slug}"`));}
 for(const org of organizations)assert.ok(html.includes(`href="/organizations/${org.slug}"`));
 const format=new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'Europe/Berlin'});
 assert.ok(html.includes(escaped(format.format(new Date(entries[0].created_at)))));assert.ok(html.includes(escaped(format.format(new Date(entries[1].starts_at)))));
 assert.deepEqual(f.calls,[{kind:'organizations',args:[1,6]},{kind:'entries',args:[]}]);
 assert.equal((html.match(/<article\b/g)??[]).length,3);assert.equal((html.match(/<li\b/g)??[]).length,6);
 assert.doesNotMatch(html,/PRIVATE_CONTACT_CANARY|PRIVATE_ENTRY_CANARY|<script>|src=""|src="null"/);
 for(const[,attributes]of html.matchAll(/<a\b([^>]*)>/g))assert.match(attributes,/min-h-11/);
 const thumbnails=f.images.filter(image=>image.width===80);assert.equal(thumbnails.length,1);assert.equal(thumbnails[0].height,56);
 for(const image of f.images){assert.equal(image.unoptimized,true);assert.match(image.src,/\?size=thumbnail$/);}
 const section=/<section\b([^>]*)>/.exec(html)?.[1]??'';assert.doesNotMatch(section,/bg-bg-primary|border-b/);
 assert.match(html,/lg:grid-cols-\[minmax\(0,2fr\)_minmax\(0,1fr\)\]/);assert.doesNotMatch(html,/browse-card|aspect-\[/);
});
test('image-free news and organizations retain their links without invented media or empty source attributes',async()=>{
 const f=fixture({orgs:organizations.map(org=>({...org,logo_url:null})),posts:entries.map(entry=>({...entry,image_url:null,organization:{...(Array.isArray(entry.organization)?entry.organization[0]:entry.organization),logo_url:null}}))});
 const html=await f.render();assert.equal(f.images.length,0);assert.doesNotMatch(html,/<img\b/);
 for(const entry of entries)assert.ok(html.includes(entry.slug));for(const org of organizations)assert.ok(html.includes(org.slug));
});
test('empty discovery stays absent while either available source still renders without a blank paired column',async()=>{
 assert.equal(await fixture({orgs:[],posts:[]}).render(),'');
 for(const options of [{orgs:[],posts:entries},{orgs:organizations,posts:[]}]){
  const html=await fixture(options).render();assert.ok(html.includes('home-industry-title'));assert.doesNotMatch(html,/lg:grid-cols-\[minmax\(0,2fr\)_minmax\(0,1fr\)\]/);
 }
});
test('discovery requests stay parallel and retain the bounded existing helper contracts',async()=>{
 let releaseOrgs,releasePosts;
 const orgResult=new Promise(resolve=>{releaseOrgs=resolve;}),postResult=new Promise(resolve=>{releasePosts=resolve;});
 const f=fixture({orgResult,postResult}),render=f.render();
 for(let i=0;i<8;i++)await Promise.resolve();assert.deepEqual(f.calls,[{kind:'organizations',args:[1,6]},{kind:'entries',args:[]}]);
 releaseOrgs({organizations,hasMore:false,page:1});releasePosts(entries);assert.ok((await render).includes('fixture-entry-0'));
});
test('query failures preserve the existing empty fallback and never print provider/private error details',async context=>{
 const logs=[];context.mock.method(console,'error',(...args)=>logs.push(args));
 const failed=Promise.reject(new Error('PRIVATE_DATABASE_ERROR'));const f=fixture({orgResult:failed});
 assert.equal(await f.render(),'');assert.deepEqual(logs,[['homepage_organization_discovery_unavailable']]);
});

test('news attribution shares the compact article grid and thumbnails are hidden only on the smallest layout',async()=>{
 const f=fixture(),html=await f.render();
 const articles=[...html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/g)];assert.equal(articles.length,3);
 for(const[,attributes,body]of articles){
  assert.match(attributes,/grid-cols-\[minmax\(0,1fr\)_6rem\]/);
  assert.equal((body.match(/<a\b/g)??[]).length,2,'both the post and its exact organization link remain in the same row');
  assert.doesNotMatch(body,/pl-\[92px\]|sm:line-clamp-2/);
 }
 const thumbnail=f.images.find(image=>image.width===80);assert.match(thumbnail.className,/hidden/);assert.match(thumbnail.className,/sm:block/);
});

test('news uses the exact organization logo with a named link and retains its name when no logo exists',async()=>{
 const f=fixture(),html=await f.render();
 const articles=[...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)];
 for(const [index,article]of articles.entries()){
  const org=Array.isArray(entries[index].organization)?entries[index].organization[0]:entries[index].organization;
  const attribution=[...article[1].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)][1];
  assert.ok(attribution[1].includes(`href="/organizations/${org.slug}"`));
  assert.ok(attribution[1].includes(`aria-label="${escaped(org.name)}"`));
  if(org.logo_url)assert.ok(attribution[2].includes(`src="${logo}?size=thumbnail"`));
  else {assert.doesNotMatch(attribution[2],/<img\b/);assert.ok(attribution[2].includes(escaped(org.name)));}
 }
});
