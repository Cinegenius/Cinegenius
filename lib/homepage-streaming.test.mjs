import {marketplaceFixture} from './home-marketplace-fixture.mjs';
import * as providerFilters from './profile-provider-filters.ts';
import {taxonomyLabel} from './departments.ts';
import * as companyCategories from './companyCategories.ts';
import {intlServerFor, translatorFor} from './i18n-test-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {createHash} from 'node:crypto';
import { createRequire } from 'node:module';
import { PassThrough } from 'node:stream';
import React from 'react';
import { renderToPipeableStream, renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const homeText=translatorFor('de','home');
const nativePattern=(key,before='',after='')=>new RegExp(before+renderToStaticMarkup(React.createElement(React.Fragment,null,homeText(key))).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+after);
// Retired runtime copy stays only as a fixed baseline for negative rendering checks.
const retiredMarketingSections = {
  "de": {
    "offerTitle": "Auch dein Ort, dein Können oder deine Ausrüstung ist gefragt.",
    "howTitle": "Einfach finden oder anbieten",
    "trustPayment": "Direkter Kontakt",
    "ctaTitle": "Dein nächstes Projekt"
  },
  "en": {
    "offerTitle": "Your space, skills or equipment are welcome here.",
    "howTitle": "Easy to find or offer",
    "trustPayment": "Direct contact",
    "ctaTitle": "Your next project"
  },
  "es": {
    "offerTitle": "Tu espacio, tus habilidades o tu equipo también son bienvenidos.",
    "howTitle": "Fácil de encontrar u ofrecer",
    "trustPayment": "Contacto directo",
    "ctaTitle": "Tu próximo proyecto"
  },
  "it": {
    "offerTitle": "Anche il tuo spazio, le tue capacità o la tua attrezzatura sono richiesti.",
    "howTitle": "Facile da trovare o proporre",
    "trustPayment": "Contatto diretto",
    "ctaTitle": "Il tuo prossimo progetto"
  },
  "cs": {
    "offerTitle": "Hodí se i tvůj prostor, schopnosti nebo vybavení.",
    "howTitle": "Snadno najít nebo nabídnout",
    "trustPayment": "Přímý kontakt",
    "ctaTitle": "Tvůj příští projekt"
  },
  "hu": {
    "offerTitle": "A helyedre, tudásodra vagy felszerelésedre is szükség lehet.",
    "howTitle": "Egyszerű keresni és kínálni",
    "trustPayment": "Közvetlen kapcsolat",
    "ctaTitle": "A következő projekted"
  },
  "nl": {
    "offerTitle": "Ook jouw locatie, talent of uitrusting is gewild.",
    "howTitle": "Eenvoudig vinden of aanbieden",
    "trustPayment": "Direct contact",
    "ctaTitle": "Je volgende project"
  },
  "nl-BE": {
    "offerTitle": "Ook jouw locatie, talent of uitrusting is gewild.",
    "howTitle": "Eenvoudig vinden of aanbieden",
    "trustPayment": "Direct contact",
    "ctaTitle": "Je volgende project"
  },
  "sv": {
    "offerTitle": "Även din plats, din kompetens eller din utrustning behövs.",
    "howTitle": "Enkelt att hitta eller erbjuda",
    "trustPayment": "Direktkontakt",
    "ctaTitle": "Ditt nästa projekt"
  }
};
const retiredPattern=(text,before='',after='')=>new RegExp(before+renderToStaticMarkup(React.createElement(React.Fragment,null,text)).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+after);

const crew = { user_id: 'own-crew', slug: 'own-crew', display_name: 'Own Crew', profile_type: 'lighting', profile_types: [], positions: [], created_at: '2026-10-30T08:00:00Z' };

function loadHomeCardRail(locale) {
  const source=readFileSync(new URL('../components/HomeCardRail.tsx',import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const mod={exports:{}};
  const styles=new Proxy({},{get:(_target,key)=>String(key)});
  new Function('require','module','exports',compiled)(name=>name==='next-intl'?{useTranslations:namespace=>translatorFor(locale,namespace)}:name.endsWith('.module.css')?{default:styles}:require(name),mod,mod.exports);
  return mod.exports;
}

function fixture({ queryResult, photoError = false, profiles = [], listings = [], companies = [], photoResult, privateIds = [], locale = 'de', viewerId = null, authResult } = {}) {
  const queries = [], queryCalls = [], photoCalls = [], ratingCalls = [], selections = [], companyCalls = [], privacyCalls = [];
  let ratingsStarted;
  const ratingsReady = new Promise(resolve => { ratingsStarted = resolve; });
  let started;
  const queriesStarted = new Promise(resolve => { started = resolve; });
  const db = { from(table) {
    const predicates=[],filters=[],orders=[];
    let rowLimit;
    const query = {
      select(fields) { selections.push({table,fields}); return query; }, eq(key,value) { filters.push(['eq',key,value]);predicates.push(row=>row[key]===value); return query; }, in(key,values) { filters.push(['in',key,values]);predicates.push(row=>values.includes(row[key])); return query; }, not() { return query; },
      neq() { return query; }, order(key,options) { orders.push({key,...options});return query; }, limit(value) { rowLimit=value;return query; }, range() { return query; },
      then(resolve, reject) {
        queries.push(table);
        queryCalls.push({table,filters,orders,limit:rowLimit});
        started();
        let rows=table==='profiles'?profiles:table==='listings'?listings.filter(row=>predicates.every(predicate=>predicate(row))):table==='companies'?companies:[];
        if(table==='listings')for(const {key,ascending} of orders)rows=[...rows].sort((a,b)=>String(a[key]??'').localeCompare(String(b[key]??''))*(ascending===false?-1:1));
        if(rowLimit!==undefined)rows=rows.slice(0,rowLimit);
        return Promise.resolve(queryResult ?? {data:rows,error:null}).then(resolve,reject);
      },
    };
    return query;
  } };
  const empty = () => null;
  const mocks = {
  '@/lib/home-marketplace': marketplaceFixture(db),
    '@/components/HomeCardRail':loadHomeCardRail(locale),
    '@/components/organizations/HomeOrganizations':{default:()=>null},
    '@/components/AiDisclosureBadge': {default:()=>null},
    '@/lib/profile-provider-filters':providerFilters,'@/lib/db': { db }, '@/lib/listing-price': { listingPriceLabel: () => 'VB' },
    '@/lib/listing-provider': { getListingProviders: async () => [] }, '@/lib/listing-routes': { listingDetailPath: () => '/props/own-prop' },
    '@clerk/nextjs/server': { auth: async () => authResult ?? ({ userId: viewerId }) },
    'next-intl/server': intlServerFor(locale),
    'next/link': { default: ({ href, children }) => React.createElement('a', { href }, children) },
    '@/components/ListingImage': { default: ({src,alt}) => React.createElement('img',{src,alt}) }, '@/components/MediaImage': { default: empty }, '@/components/PageHeader': { PageBackdrop: empty },
    '@/components/HeroSearch': { default: () => React.createElement('form', { action: '/search', 'data-home-search': true }) },
    '@/components/HomeCommunityBoard': { default: () => React.createElement('div',{'data-home-community-lazy':true}) }, '@/components/HomeCompanyPartners': { default: ({companies}) => {companyCalls.push(companies);return null;} },
    '@/components/HomePhotoDiscovery': { HomePhotoDiscovery: ({ newPhotos }) => React.createElement('div', { 'data-photo-count': newPhotos.length }) },
    '@/components/Skeleton': { SkeletonBox: () => React.createElement('div', { 'data-home-skeleton': true }) },
    '@/lib/companyCategories': companyCategories, '@/lib/departments':{taxonomyLabel},
    '@/lib/profile-types': { PROFILE_CATEGORY_MAP: { lighting: 'crew' }, PROFILE_TYPE_LABELS: { lighting: 'Lighting' } },
    '@/lib/trust': { getPrivateProfileIds: async ids => {privacyCalls.push(ids);return new Set(privateIds);} }, '@/lib/ratings': { fetchRatingSummaries: async (ids,type) => {ratingCalls.push({ids,type});ratingsStarted();return {};} },
    '@/lib/rating-ranking': { rankByRatingConfidence: rows => rows },
    '@/lib/community-media-server': { getCommunityMedia: async options => {
      photoCalls.push(options);
      if (photoError) throw new Error('Own fixture media failure');
      return photoResult ?? { photos: [] };
    } },
  };
  const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod, mod.exports);
  return { ...mod.exports, queries, queryCalls, queriesStarted, photoCalls, selections, ratingCalls, ratingsReady, companyCalls, privacyCalls };
}

function startStream(Page) {
  const output = new PassThrough(), errors = [];
  let html = '', ready;
  output.on('data', chunk => { html += chunk.toString(); });
  const finished = new Promise((resolve, reject) => { output.on('end', resolve); output.on('error', reject); });
  const shell = new Promise(resolve => { ready = resolve; });
  const stream = renderToPipeableStream(React.createElement(Page), {
    onShellReady() { stream.pipe(output); ready(); },
    onError(error) { errors.push(error); },
  });
  return { shell, finished, errors, html: () => html, abort: () => stream.abort() };
}

test('compact hero, search and final project link stream while recommendation data is still pending', { timeout: 3000 }, async context => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const home = fixture({ queryResult: pending });
  const stream = startStream(home.default);
  context.after(() => { release({ data: [], error: null }); stream.abort(); });
  await stream.shell;
  await home.queriesStarted;
  assert.ok(home.queries.length > 0, 'the recommendation queries actually started and remain pending');
  assert.match(stream.html(), nativePattern('heroTitle1','<h1[^>]*>'));
  assert.match(stream.html(), nativePattern('heroTitle2','<span[^>]*>','</span>'));
  assert.match(stream.html(), /data-home-search="true"/);
  assert.match(stream.html(), /href="\/projects\/alle"/);
  for (const [key, text] of Object.entries(retiredMarketingSections.de)) assert.doesNotMatch(stream.html(), retiredPattern(text), key);
  assert.match(stream.html(), /data-home-skeleton="true"/);
  assert.doesNotMatch(stream.html(), /id="home-crew-title"/);
  release({ data: [], error: null });
  await stream.finished;
  assert.doesNotMatch(stream.html(), /id="home-crew-title"/,'empty data must not invent a crew section');
  assert.ok(home.queries.every(table=>table!=='projects'),'the final project link needs no project query');
  assert.deepEqual(stream.errors, []);
});

test('database recommendation failure keeps the static homepage and renders its translated notice', { timeout: 3000 }, async context => {
  context.mock.method(console, 'error', () => {});
  const home = fixture({ queryResult: { data: null, error: { code: 'PGRST003' } } });
  const stream = startStream(home.default);
  context.after(stream.abort);
  await stream.finished;
  assert.match(stream.html(), nativePattern('heroTitle1'));
  assert.match(stream.html(), /data-home-search="true"/);
  assert.match(stream.html(), nativePattern('recommendationsUnavailable','role="status"[^>]*>'));
  assert.deepEqual(stream.errors, []);
});

test('an optional photo failure retains other recommendations and uses a bounded count-free photo request', { timeout: 3000 }, async context => {
  context.mock.method(console, 'error', () => {});
  const home = fixture({ profiles: [crew], photoError: true });
  const stream = startStream(home.default);
  context.after(stream.abort);
  await stream.finished;
  assert.match(stream.html(), /Own Crew/);
  assert.doesNotMatch(stream.html(), /data-photo-count=/,'optional photo failure should omit the photo section');
  assert.doesNotMatch(stream.html(), nativePattern('recommendationsUnavailable'));
  assert.equal(home.photoCalls[0].includeTotal, false);
  assert.ok(home.photoCalls[0].signal instanceof AbortSignal);
  assert.deepEqual(stream.errors, []);
});

test('the recommendation failure notice is present in every supported locale', () => {
  for (const locale of ['de', 'en', 'es', 'it', 'cs', 'hu', 'nl', 'nl-BE', 'sv']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    assert.ok(messages.home.recommendationsUnavailable?.trim(), locale);
  }
});


test('chronological people discovery selects ten eligible public people before pending photos without rating requests', {timeout:3000}, async context => {
  let release;const photoResult=new Promise(resolve=>{release=resolve});
  const publicPeople=Array.from({length:12},(_,index)=>({...crew,user_id:`own-person-${index}`,slug:`own-person-${index}`,display_name:`Own public crew ${String(index).padStart(2,'0')}`,created_at:new Date(Date.UTC(2026,10,10,index)).toISOString()}));
  const profiles=[...publicPeople.slice(0,6),{...crew,user_id:'own-provider',slug:'own-provider',display_name:'Company-only canary',profile_type:'company',positions:[],created_at:'2027-01-01T00:00:00Z'},...publicPeople.slice(6),{...crew,user_id:'private-crew',slug:'private-crew',display_name:'Private crew canary',created_at:'2027-01-02T00:00:00Z'}];
  const before=JSON.stringify(profiles);
  const home=fixture({photoResult,profiles,privateIds:['private-crew']});
  const stream=startStream(home.default);context.after(()=>{release({photos:[]});stream.abort()});
  await home.queriesStarted;
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(home.photoCalls.length,1);
  assert.deepEqual(home.ratingCalls,[],'chronological people discovery must not issue ranking requests');
  const profileSelect=home.selections.find(s=>s.table==='profiles').fields.split(',');
  assert.ok(profileSelect.includes('avatar_url'));assert.ok(!profileSelect.includes('profile_images'));assert.ok(!profileSelect.includes('portfolio_images'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(stream.html(),/Own public crew 11/,'public crew cards must stream before the pending optional photo request');
  const expected=Array.from({length:10},(_,index)=>String(11-index));
  assert.deepEqual([...stream.html().matchAll(/href="\/profile\/own-person-(\d+)"/g)].map(match=>match[1]),expected,'all ten newest public people are server rendered in order');
  assert.deepEqual(home.privacyCalls,[profiles.map(profile=>profile.user_id)],'privacy is checked across the candidate set before the ten-card cap');
  release({photos:[]});await stream.finished;assert.deepEqual(home.ratingCalls,[]);assert.doesNotMatch(stream.html(),/Private crew canary|Company-only canary|private-crew|own-provider/);assert.deepEqual(stream.errors,[]);assert.equal(JSON.stringify(profiles),before);
});

test('the location rail requests and server renders the ten newest published locations, excluding drafts and other offer types',{timeout:5000},async()=>{
  const locations=Array.from({length:12},(_,index)=>({id:`own-location-${index}`,type:'location',title:`Own location ${index}`,published:true,city:'Own city',price:0,metadata:{},created_at:new Date(Date.UTC(2026,10,10,index)).toISOString()}));
  const listings=[...locations.slice(0,6),{...locations[0],id:'private-location-canary',title:'Private location canary',published:false,created_at:'2027-01-01T00:00:00Z'},...locations.slice(6),{...locations[0],id:'own-prop',type:'prop',title:'Own prop'}];
  const before=JSON.stringify(listings);
  const home=fixture({listings}),stream=startStream(home.default);await stream.finished;
  const locationQuery=home.queryCalls.find(query=>query.table==='listings'&&query.filters.some(filter=>filter[0]==='eq'&&filter[1]==='type'&&filter[2]==='location'));
  assert.ok(locationQuery);assert.equal(locationQuery.limit,10);assert.deepEqual(locationQuery.orders,[{key:'created_at',ascending:false}]);
  assert.ok(locationQuery.filters.some(filter=>filter[0]==='eq'&&filter[1]==='published'&&filter[2]===true));
  assert.deepEqual([...stream.html().matchAll(/href="\/locations\/own-location-(\d+)"/g)].map(match=>match[1]),Array.from({length:10},(_,index)=>String(11-index)));
  assert.doesNotMatch(stream.html(),/Private location canary|private-location-canary/);
  assert.match(stream.html(),/id="home-locations-rail"[^>]*role="region"[^>]*aria-labelledby="home-locations-title"/);
  assert.deepEqual(home.queryCalls.filter(query=>query.table==='listings'&&query!==locationQuery).map(query=>query.limit).sort(),[4,undefined,undefined].sort());
  assert.equal(JSON.stringify(listings),before);assert.deepEqual(stream.errors,[]);
});

test('empty locations reserve no rail and a single public location has no redundant scroll controls',{timeout:5000},async()=>{
  for(const listings of [[],[{id:'own-only-location',type:'location',title:'Own only location',published:true,city:'Own city',price:0,metadata:{},created_at:'2026-11-10T12:00:00Z'}]]){
    const home=fixture({listings}),stream=startStream(home.default);await stream.finished;
    assert.equal(stream.html().includes('id="home-locations-rail"'),listings.length===1);
    assert.doesNotMatch(stream.html(),/id="home-locations-rail-hint"|aria-controls="home-locations-rail"/);
    if(listings.length)assert.match(stream.html(),/href="\/locations\/own-only-location"/);
    assert.deepEqual(stream.errors,[]);
  }
});

test('pending photos cannot delay public location, marketplace, job or crew cards and retain the exact viewer boundary', {timeout:5000}, async context=>{
  for (const viewerId of [null,'own-signed-in-viewer']) {
    let release;const photoResult=new Promise(resolve=>{release=resolve});
    const listings=['location','prop','job'].map((type,index)=>({id:`own-public-${index}`,type,title:`Own public ${type}`,published:true,city:'Own city',price:100,metadata:{},created_at:'2026-11-10T12:00:00Z'}));
    const home=fixture({photoResult,listings,profiles:[crew],viewerId}),stream=startStream(home.default);
    context.after(()=>{release({photos:[]});stream.abort()});
    await stream.shell;await home.queriesStarted;
    for(let n=0;n<3;n++)await new Promise(resolve=>setImmediate(resolve));
    for(const type of ['location','prop','job'])assert.match(stream.html(),new RegExp(`Own public ${type}`));
    assert.match(stream.html(),/Own Crew/);assert.doesNotMatch(stream.html(),/data-photo-count=/);
    assert.equal(home.photoCalls.length,1);assert.equal(home.photoCalls[0].viewerId,viewerId);
    assert.equal(home.photoCalls[0].limit,24);assert.equal(home.photoCalls[0].diverse,true);assert.equal(home.photoCalls[0].includeTotal,false);
    assert.ok(home.photoCalls[0].signal instanceof AbortSignal);assert.equal(home.photoCalls[0].signal.aborted,false);
    assert.ok(home.queries.every(table=>table!=='projects'));
    release({photos:[]});await stream.finished;assert.deepEqual(stream.errors,[]);
  }
});

test('all nine native compact homepages omit duplicate marketing sections and retain a final project destination', {timeout:5000},async()=>{
  for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv']){
    const listings=Array.from({length:2},(_,index)=>({id:`own-native-location-${index}`,type:'location',title:`Own native location ${index}`,published:true,city:'Own city',price:0,metadata:{},created_at:'2026-11-10T12:00:00Z'}));
    const profiles=[crew,{...crew,user_id:'own-native-person',slug:'own-native-person'}];
    const home=fixture({locale,listings,profiles}),stream=startStream(home.default);await stream.finished;
    const t=translatorFor(locale,'home'),text=stream.html().replace(/<[^>]*>/g,'').replace(/<!--.*?-->/g,'');
    assert.ok(text.includes(t('heroTitle1')),locale);assert.ok(text.includes(t('heroTitle2')),locale);
    for(const [key, previousText] of Object.entries(retiredMarketingSections[locale]))assert.ok(!text.includes(previousText),`${locale}: ${key} is absent`);
    assert.equal((stream.html().match(/<h1\b/g)??[]).length,1,locale);
    assert.match(stream.html(),/href="\/news"/);
    for(const key of ['newsShortcut','newsShortcutDescription'])assert.ok(text.includes(t(key)),`${locale}: ${key}`);
    assert.match(stream.html(),/href="\/projects\/alle"/);assert.match(stream.html(),/data-home-community-lazy="true"/);
    for(const key of ['crewScrollHint','locationScrollHint'])assert.ok(stream.html().includes(renderToStaticMarkup(React.createElement(React.Fragment,null,t(key)))),`${locale}: ${key}`);
    assert.ok(stream.html().includes(renderToStaticMarkup(React.createElement(React.Fragment,null,t('railPage',{page:1,total:2})))),`${locale}: localized page dots`);
    assert.ok(stream.html().lastIndexOf('href="/projects/alle"')>stream.html().indexOf('data-home-community-lazy='),locale+' project destination follows optional community');
    assert.ok(home.queries.every(table=>table!=='projects'));assert.deepEqual(stream.errors,[]);
  }
});

test('real HeroSearch preserves entered fields across all four native tabs and keeps GET fallback and router destinations stable in nine languages',()=>{
  for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv']){
    const values=[],destinations=[];let index=0;
    const react={...React,useState(initial){const slot=index++;if(!(slot in values))values[slot]=initial;return [values[slot],value=>{values[slot]=typeof value==='function'?value(values[slot]):value}];}};
    const mocks={react,'next/navigation':{useRouter:()=>({push:value=>destinations.push(value)})},'next-intl':{useTranslations:namespace=>translatorFor(locale,namespace)}};
    const source=readFileSync(new URL('../components/HeroSearch.tsx',import.meta.url),'utf8');
    const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    const mod={exports:{}};new Function('require','module','exports',code)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);
    const render=()=>{index=0;return mod.exports.default();};
    const find=(element,predicate,result=[])=>{if(!element||typeof element!=='object')return result;if(predicate(element))result.push(element);for(const child of React.Children.toArray(element.props?.children))find(child,predicate,result);return result;};
    let tree=render(),inputs=find(tree,node=>node.type==='input');
    inputs.find(node=>node.props.name==='q').props.onChange({target:{value:' PUBLIC EXAMPLE camera & sound '}});
    inputs.find(node=>node.props.name==='cityText').props.onChange({target:{value:' München '}});
    const t=translatorFor(locale);
    for(const [key,path] of [['nav.locations','/locations'],['nav.crew','/creators'],['companies.groupAusstattung','/props'],['nav.jobs','/jobs']]){
      tree=render();const tab=find(tree,node=>node.type==='button'&&node.props.children===t(key))[0];
      assert.ok(tab,`${locale}: ${key}`);assert.equal(tab.props.type,'button');tab.props.onClick();tree=render();
      const tabs=find(tree,node=>node.type==='button'&&typeof node.props['aria-pressed']==='boolean');
      assert.equal(tabs.length,4);assert.equal(tabs.filter(node=>node.props['aria-pressed']).length,1);assert.equal(tabs.find(node=>node.props['aria-pressed']).props.children,t(key));
      inputs=find(tree,node=>node.type==='input');
      assert.equal(inputs.find(node=>node.props.name==='q').props.value,' PUBLIC EXAMPLE camera & sound ');
      assert.equal(inputs.find(node=>node.props.name==='cityText').props.value,' München ');
      assert.ok(inputs.every(node=>node.props['aria-label']?.trim()),locale+' all inputs remain named');
      const form=find(tree,node=>node.type==='form')[0];assert.equal(form.props.method,'get');assert.equal(form.props.action,path);
      let prevented=false;form.props.onSubmit({preventDefault(){prevented=true}});assert.equal(prevented,true);
      const destination=new URL(destinations.at(-1),'https://www.cinegenius.co');
      assert.equal(destination.pathname,path);assert.equal(destination.searchParams.get('q'),'PUBLIC EXAMPLE camera & sound');assert.equal(destination.searchParams.get('cityText'),'München');assert.equal(destination.searchParams.has('city'),false);
    }
  }
});

test('homepage company categories use native catalogue labels while company identities and member names remain exact in nine languages',{timeout:5000},async()=>{
  const companies=[{id:'own-public-company',slug:'own-public-company',name:'Own member company name',logo_url:null,city:'Own city',categories:['lichtverleih']}];
  const before=JSON.stringify(companies);
  for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv']){
    const home=fixture({locale,companies}),stream=startStream(home.default);await stream.finished;
    assert.deepEqual(stream.errors,[]);assert.equal(home.companyCalls.length,1);
    assert.equal(home.companyCalls[0][0].category,translatorFor(locale)('Taxonomy.extra.x_a47a5b95a07c'));
    assert.equal(home.companyCalls[0][0].id,'own-public-company');assert.equal(home.companyCalls[0][0].name,'Own member company name');
    assert.equal(home.companyCalls[0][0].href,'/companies/own-public-company');assert.equal(JSON.stringify(companies),before);
  }
});

test('hero locations and editorial cards share one data read and recheck privacy on the next request',{timeout:5000},async context=>{
  const privateIds=[];
  const profiles=Array.from({length:11},(_,index)=>({...crew,user_id:`own-recheck-${index}`,slug:`own-recheck-${index}`,display_name:`Own rechecked person ${String(index).padStart(2,'0')}`,created_at:new Date(Date.UTC(2026,10,10,index)).toISOString()}));
  const listings=['location','prop','job'].map((type,index)=>({id:`own-shared-${index}`,type,title:`Own shared ${type}`,published:true,city:'Own city',price:100,metadata:{},created_at:'2026-11-10T12:00:00Z'}));
  const companies=[{id:'own-company',slug:'own-company',name:'Own company',logo_url:null,city:'Own city',categories:['lichtverleih']}];
  const home=fixture({listings,companies,profiles,privateIds});
  const first=startStream(home.default);context.after(first.abort);await first.finished;
  assert.deepEqual(first.errors,[]);assert.equal(home.queries.length,6);assert.equal(home.queries.filter(table=>table==='listings').length,4);assert.equal(home.privacyCalls.length,1);
  assert.match(first.html(),/Own shared location/);assert.match(first.html(),/Own rechecked person 10/);
  assert.deepEqual([...first.html().matchAll(/href="\/profile\/own-recheck-(\d+)"/g)].map(match=>match[1]),Array.from({length:10},(_,index)=>String(10-index)));
  const markers=['home-marketplace-title','home-crew-title','home-companies-title','home-jobs-title'].map(id=>first.html().indexOf(`aria-labelledby="${id}"`));
  assert.ok(markers.every(index=>index>=0));assert.deepEqual([...markers].sort((a,b)=>a-b),markers);
  assert.equal((first.html().match(/id="home-locations-title"/g)??[]).length,1);
  privateIds.push('own-recheck-10');
  const second=startStream(home.default);context.after(second.abort);await second.finished;
  assert.deepEqual(second.errors,[]);assert.equal(home.queries.length,12);assert.equal(home.privacyCalls.length,2);
  assert.doesNotMatch(second.html(),/Own rechecked person 10/);assert.match(second.html(),/Own shared location/);
  assert.deepEqual([...second.html().matchAll(/href="\/profile\/own-recheck-(\d+)"/g)].map(match=>match[1]),Array.from({length:10},(_,index)=>String(9-index)),'the eleventh eligible public person fills the withdrawn slot on the next request');
});

test('shared data rejection is handled before delayed auth and renders one native status',{timeout:4000},async context=>{
  context.mock.method(console,'error',()=>{});
  let releaseAuth;const authResult=new Promise(resolve=>{releaseAuth=resolve});
  const home=fixture({queryResult:{data:null,error:{code:'OWN_SYNTHETIC_FAILURE'}},authResult}),stream=startStream(home.default);
  context.after(()=>{releaseAuth({userId:null});stream.abort()});
  await home.queriesStarted;await new Promise(resolve=>setImmediate(resolve));
  assert.equal(stream.html(),'','auth remains the known shell boundary');
  releaseAuth({userId:null});await stream.finished;
  assert.deepEqual(stream.errors,[]);assert.match(stream.html(),nativePattern('heroTitle1'));
  assert.equal((stream.html().match(/role="status"/g)??[]).length,1);
  assert.match(stream.html(),nativePattern('recommendationsUnavailable'));assert.equal(home.queries.length,5);
});

test('approved Equipment and Crew card map bytes retain the reviewed thumbnail media choice',()=>{
  const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
  const file=ts.createSourceFile('homepage.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),found={};
  const visit=node=>{if(ts.isCallExpression(node)&&['newCrew.map','liveProps.map'].includes(node.expression.getText(file)))found[node.expression.getText(file)]=createHash('sha256').update(node.getText(file)).digest('hex');ts.forEachChild(node,visit);};visit(file);
  // Keep the reviewed thumbnail, content, links and image classes locked.
  // Crew wrapper now omits card-hover and uses transition-colors to stay still.
  assert.deepEqual(found,{'liveProps.map':'ca15f22de693280f6e21b52fbb1b851c9beeab7bad85f642a882a87bf80bb914','newCrew.map':'57964bf29552861a915e4ad3b05bd36cd0db6e290f60fa9de7874bbc97070e12'});
});

test('native Find cards follow search directly with six compact destinations and Jobs without Projects',{timeout:5000},async()=>{
  for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv']){
    const home=fixture({locale}),stream=startStream(home.default);await stream.finished;
    const html=stream.html(),search=html.indexOf('data-home-search="true"'),find=html.indexOf('aria-labelledby="home-find-title"');
    assert.ok(search>=0&&find>search,locale);assert.doesNotMatch(html.slice(search,find),/<a\b/);
    const section=html.slice(find,html.indexOf('</section>',find));
    assert.deepEqual([...section.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map(match=>match[1]),['/locations','/creators','/props','/companies','/jobs','/news'],locale+' has one direct link per choice');
    assert.doesNotMatch(section,/href="\/projects/,'Projects stays out of the Jobs choice');
    const t=translatorFor(locale,'home');assert.ok(section.includes(renderToStaticMarkup(React.createElement(React.Fragment,null,t('findTitle')))));
    assert.equal((section.match(/<h3\b/g)??[]).length,6);assert.deepEqual(stream.errors,[]);
  }
});

test('missing public recommendation groups do not reserve empty sections',{timeout:5000},async()=>{
  const listing=type=>({id:`own-${type}`,type,title:`Own ${type}`,published:true,city:'Own city',price:1,metadata:{},created_at:'2026-11-10T12:00:00Z'});
  const company={id:'own-company',slug:'own-company',name:'Own company',logo_url:null,city:'Own city',categories:[]};
  const cases=[[{profiles:[crew]},['home-crew-title']],[{listings:[listing('prop')]},['home-marketplace-title']],[{companies:[company]},['home-companies-title']],[{listings:[listing('job')]},['home-jobs-title']],[{profiles:[crew],companies:[company]},['home-crew-title','home-companies-title']],[{},[]]];
  for(const [data,expected] of cases){
    const home=fixture(data),stream=startStream(home.default);await stream.finished;
    for(const id of ['home-marketplace-title','home-crew-title','home-companies-title','home-jobs-title'])assert.equal(stream.html().includes(`id="${id}"`),expected.includes(id),id);
    assert.equal(home.queries.length,data.listings?.some(row=>row.type==='prop')?6:5);assert.deepEqual(stream.errors,[]);
  }
});
