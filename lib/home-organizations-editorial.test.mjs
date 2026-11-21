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
import * as taxonomy from './organization-taxonomy.ts';
import * as newsGallery from './news-gallery.ts';

const picture='/api/media/own-fixture/0123456789abcdef0123456789abcdef.webp';
const logo='/api/media/own-fixture/fedcba9876543210fedcba9876543210.webp';
const organizations=Array.from({length:6},(_,index)=>({id:`org-${index}`,slug:`fixture-org-${index}`,name:index===0?'Fixture & Friends <Team>':`Fixture organization ${index}`,city:index===1?null:'Fixture city',logo_url:index%2?null:logo,private_contact:'PRIVATE_CONTACT_CANARY'}));
const entries=Array.from({length:3},(_,index)=>({id:`entry-${index}`,slug:`fixture-entry-${index}`,title:index===0?'Fixture <script>title</script> & "quoted"':`Fixture title ${index}`,summary:index===2?null:'Fixture public summary',entry_type:index===1?'event':'news',image_url:index===0?picture:null,created_at:'2026-11-10T12:00:00.000Z',starts_at:index===1?'2026-12-01T12:00:00.000Z':null,organization:index===1?[organizations[index]]:organizations[index],private_note:'PRIVATE_ENTRY_CANARY'}));
function compile(relative,mocks){
 const code=ts.transpileModule(readFileSync(new URL(relative,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const loaded={exports:{}};new Function('require','module','exports',code)(name=>{assert.ok(Object.hasOwn(mocks,name),`Unmocked editorial dependency ${name}`);return mocks[name];},loaded,loaded.exports);return loaded.exports;
}
function fixture({locale='de',orgs=organizations,posts=entries,orgResult,postResult,topic='all',country=''}={}){
 const calls=[],images=[],rails=[];
 const MediaImage=compile('../components/MediaImage.tsx',{
  'react/jsx-runtime':jsxRuntime,'@/lib/protected-media':protectedMedia,
  'next/image':{default:props=>{images.push(props);return React.createElement('img',{src:props.src,alt:props.alt,width:props.width,height:props.height,className:props.className});}},
 }).default;
 const component=compile('../components/organizations/HomeOrganizations.tsx',{
  '@/components/ContentTranslation':{TranslatedText:({children})=>children},
  'react/jsx-runtime':jsxRuntime,'next-intl/server':intlServerFor(locale),
  'lucide-react':icons,
  '@/lib/news-region-server':{newsRegion:async()=>({selection:'auto',country,cookieName:'cg_news_country_guest'})},
  '@/lib/news-discovery':{homeNewsFacets:async()=>({codes:['DE','CH'],topics:['technology','education']})},
  '@/lib/organization-taxonomy':taxonomy,
  '@/lib/news-topic-server':{homeNewsTopic:async()=>({selection:topic,cookieName:'cg_news_topic_guest'})},
  './HomeNewsRegion':{default:({empty,failed})=>React.createElement('div',{'data-region-empty':empty,'data-region-failed':failed})},
  'next/link':{default:({href,children,...props})=>React.createElement('a',{href,...props},children)},
  '@/components/MediaImage':{default:MediaImage},
  '@/components/ListingImage':{default:MediaImage},
  '@/lib/news-gallery':newsGallery,
  '@/components/HomeCardRail':{default:({children,...props})=>{rails.push({...props,pages:React.Children.toArray(children)});return React.createElement('div',{'data-news-rail':props.id},children);}},
  '@/lib/organization-discovery':{
   organizationDiscovery:async(...args)=>{calls.push({kind:'organizations',args});return orgResult??{organizations:orgs,hasMore:false,page:1};},
   latestOrganizationEntries:async(...args)=>{calls.push({kind:'entries',args});return postResult??posts;},
  },
 }).default;
 return{component,calls,images,rails,render:async()=>{const tree=await component();return tree?renderToStaticMarkup(tree):'';}};
}
const escaped=value=>renderToStaticMarkup(React.createElement(React.Fragment,null,value));
for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv','fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk'])test(`editorial organization footer ${locale}: native headings/dates, all approved preview links and safe optional media`,async()=>{
 const f=fixture({locale}),html=await f.render(),t=translatorFor(locale,'OrganizationDiscovery'),entryT=translatorFor(locale,'Organizations');
 for(const key of ['eyebrow','allEntries','organizations','allOrganizations'])assert.ok(html.includes(escaped(t(key))),`${locale}/${key}`);
 assert.ok(html.includes(escaped(entryT('entryType.news'))));assert.ok(html.includes(escaped(entryT('entryType.event'))));
 for(const entry of entries){const org=Array.isArray(entry.organization)?entry.organization[0]:entry.organization;assert.ok(html.includes(`href="/news/${org.slug}/${entry.slug}"`));}
 for(const org of organizations)assert.ok(html.includes(`href="/organizations/${org.slug}"`));
 const format=new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'Europe/Berlin'});
 assert.ok(html.includes(escaped(format.format(new Date(entries[0].created_at)))));assert.ok(html.includes(escaped(format.format(new Date(entries[1].starts_at)))));
 assert.deepEqual(f.calls,[{kind:'organizations',args:[1,6]},{kind:'entries',args:['','',12]}]);
 assert.equal((html.match(/<article\b/g)??[]).length,3);assert.equal((html.match(/<li\b/g)??[]).length,6);
 assert.doesNotMatch(html,/PRIVATE_CONTACT_CANARY|PRIVATE_ENTRY_CANARY|<script>|src=""|src="null"/);
 for(const[,attributes]of html.matchAll(/<a\b([^>]*)>/g))assert.match(attributes,/min-h-11/);
 const thumbnails=f.images.filter(image=>image.width===80);assert.equal(thumbnails.length,1);assert.equal(thumbnails[0].height,64);
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
 assert.match(await fixture({orgs:[],posts:[]}).render(), /data-region-empty="true"/);
 for(const options of [{orgs:[],posts:entries},{orgs:organizations,posts:[]}]){
  const html=await fixture(options).render();assert.ok(html.includes('home-industry-title'));assert.doesNotMatch(html,/lg:grid-cols-\[minmax\(0,2fr\)_minmax\(0,1fr\)\]/);
 }
});
test('discovery requests stay parallel and retain the bounded existing helper contracts',async()=>{
 let releaseOrgs,releasePosts;
 const orgResult=new Promise(resolve=>{releaseOrgs=resolve;}),postResult=new Promise(resolve=>{releasePosts=resolve;});
 const f=fixture({orgResult,postResult}),render=f.render();
 for(let i=0;i<16;i++)await Promise.resolve();assert.deepEqual(f.calls,[{kind:'organizations',args:[1,6]},{kind:'entries',args:['','',12]}]);
 releaseOrgs({organizations,hasMore:false,page:1});releasePosts(entries);assert.ok((await render).includes('fixture-entry-0'));
});
test('query failures preserve the existing empty fallback and never print provider/private error details',async context=>{
 const logs=[];context.mock.method(console,'error',(...args)=>logs.push(args));
 const failed=Promise.reject(new Error('PRIVATE_DATABASE_ERROR'));const f=fixture({orgResult:failed});
 assert.match(await f.render(),/data-region-failed="true"/);assert.deepEqual(logs,[['homepage_organization_discovery_unavailable']]);
});

test('news photos remain visible at mobile sizes without a reserved publisher-logo column',async()=>{
 const f=fixture(),html=await f.render();
 const articles=[...html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/g)];assert.equal(articles.length,3);
 for(const [index,[,attributes,body]]of articles.entries()){
  assert.doesNotMatch(attributes,/grid-cols/);
  assert.equal((body.match(/<a\b/g)??[]).length,1,'one full-card article target');
  const org=Array.isArray(entries[index].organization)?entries[index].organization[0]:entries[index].organization;
  assert.ok(body.includes(escaped(org.name)));
  assert.ok(!body.includes(logo),'publisher logos never masquerade as article photos');
  if(index>0)assert.doesNotMatch(body,/<img\b/,'no image means compact text without a placeholder');
 }
 const thumbnail=f.images.find(image=>image.width===80);assert.doesNotMatch(thumbnail.className,/hidden|sm:block/);assert.match(thumbnail.className,/object-contain/);
});

test('home forwards the selected topic to discovery and the full news destination',async()=>{
 const f=fixture({topic:'technology',country:'DE'}),html=await f.render();
 assert.ok(f.calls.some(call=>call.kind==='entries'&&call.args[0]==='DE'&&call.args[1]==='technology'));
 assert.match(html,/href="\/news\?country=auto&amp;topic=technology"/);
});


test('more approved news remains reachable in horizontal pages of three without a vertical scroll pane', async()=>{
 const posts=Array.from({length:10},(_,index)=>({...entries[index%entries.length],id:`extended-${index}`,slug:`extended-${index}`}));
 const f=fixture({posts}),html=await f.render();
 assert.equal(f.rails.length,1);const rail=f.rails[0];
 assert.equal(rail.variant,'news');assert.equal(rail.itemCount,4);assert.equal(rail.labelledBy,'home-industry-title');
 assert.deepEqual(rail.pages.map(page=>React.Children.toArray(page.props.children).length),[3,3,3,1]);
 for(const post of posts)assert.ok(html.includes(post.slug));
 assert.doesNotMatch(html,/overflow-y-auto|max-h-/);
 assert.ok(f.calls.some(call=>call.kind==='entries'&&call.args[2]===12));
});
