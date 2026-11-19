import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as jsx from 'react/jsx-runtime';
import ts from 'typescript';
import {translatorFor} from './i18n-test-fixture.mjs';
import * as taxonomy from './organization-taxonomy.ts';

const code=ts.transpileModule(readFileSync(new URL('../app/news/NewsBrowseControls.tsx',import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
}).outputText;
function nodes(tree,type) {
  if(Array.isArray(tree)) return tree.flatMap(child=>nodes(child,type));
  return tree?.props ? [...(tree.type===type?[tree]:[]),...nodes(tree.props.children,type)] : [];
}
function fixture({native=false,locale='de',topic='technology',facets=[{type:'news',topic:'technology',country:'DE'},{type:'news',topic:'funding',country:'DE'}]}={}) {
  const writes=[],navigations=[],slots=[],state={save:true};let cursor=0,tree;
  const mocks={
    'react/jsx-runtime':jsx,
    'lucide-react':{Globe:'globe-icon',Tag:'tag-icon'},
    react:{useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useTransition:()=>[false,fn=>fn()]},
    'next/navigation':{useRouter:()=>({push:(...args)=>navigations.push(args)})},
    'next-intl':{useLocale:()=>locale,useTranslations:namespace=>translatorFor(locale,namespace)},
    '@/components/MobileBrowseControls':{default:'browse',MobileFilterField:'field',MobileFilterSelect:'topic'},
    '@/lib/places/core':{UNASSIGNED_COUNTRY:'unassigned',countryName:code=>code},
    '@/lib/places/countries':{COUNTRY_CODES:['AT','DE','FR']},
    '@/components/app/NativeBrowseToolbar':{NativeBrowseQuickFilter:'quick-filter'},
    '@/components/BrowseGeography':{BrowsePreferenceControl:'preference'},
    '@/components/organizations/NewsCountrySelect':{default:'country'},
    '@/lib/news-region':{rememberNewsCountry:(...args)=>{writes.push(['country',...args]);return true;}},
    '@/lib/news-topic':{rememberNewsTopic:(...args)=>{writes.push(['topic',...args]);return state.save;}},
    '@/lib/organization-taxonomy':taxonomy,
  };
  const module={exports:{}};
  new Function('require','module','exports',code)(name=>{assert.ok(Object.hasOwn(mocks,name),name);return mocks[name];},module,module.exports);
  function render(){cursor=0;tree=module.exports.default({filters:{q:'kept query',topic,country:'auto'},facets,count:5,
    nativeViewControls:native?'views':undefined,region:{selection:'auto',country:'DE',cookieName:'cg_news_country_0123456789abcdef'},topicCookieName:'cg_news_topic_0123456789abcdef'});}
  render();
  return {writes,navigations,state,render,get tree(){return tree;},browse:()=>nodes(tree,'browse')[0].props,topic:()=>nodes(tree,'topic')[0].props,
    quick(index,value){nodes(tree,'browse')[0].props.nativeQuickFilters[index].props.onChange(value);render();},choose(value){nodes(tree,'topic')[0].props.onChange(value);render();},apply(){nodes(tree,'browse')[0].props.onSearch();render();}};
}

test('opening filters does not save the inferred topic; an unrelated search keeps the default automatic',()=>{
  const f=fixture();assert.deepEqual(f.writes,[]);assert.equal(f.topic().value,'technology');
  f.browse().onQueryChange('another query');f.render();f.apply();
  assert.deepEqual(f.writes,[['country','cg_news_country_0123456789abcdef','auto']]);
  const params=new URL(f.navigations[0][0],'https://example.test').searchParams;
  assert.equal(params.get('q'),'another query');assert.equal(params.get('topic'),'technology');
  assert.deepEqual(f.navigations[0][1],{scroll:false});
});

test('an explicit topic or all persists within this account and remains explicit in navigation',()=>{
  for(const [selected,expected] of [['funding','funding'],['','all']]) {
    const f=fixture();f.choose(selected);assert.deepEqual(f.writes,[]);f.apply();
    assert.deepEqual(f.writes[1],['topic','cg_news_topic_0123456789abcdef',expected]);
    const params=new URL(f.navigations[0][0],'https://example.test').searchParams;
    assert.equal(params.get('topic'),expected);assert.equal(params.get('q'),'kept query');
  }
});

test('removing the topic chip and reset both opt out of the inferred selection',()=>{
  const removed=fixture();removed.browse().chips.find(chip=>chip.id==='topic').onRemove();removed.render();
  assert.deepEqual(removed.writes[1],['topic','cg_news_topic_0123456789abcdef','all']);
  assert.match(removed.navigations[0][0],/topic=all/);
  const reset=fixture();reset.browse().onReset();reset.render();
  assert.deepEqual(reset.writes[1],['topic','cg_news_topic_0123456789abcdef','all']);
  const params=new URL(reset.navigations[0][0],'https://example.test').searchParams;
  assert.equal(params.get('topic'),'all');assert.equal(params.get('country'),'all');assert.equal(params.get('q'),null);
});

test('blocked storage preserves draft and retry without claiming the topic was saved',()=>{
  const f=fixture();f.state.save=false;f.choose('funding');f.apply();
  assert.deepEqual(f.navigations,[]);assert.equal(f.topic().value,'funding');assert.equal(f.browse().query,'kept query');
  assert.ok(nodes(f.tree,'p').some(node=>node.props.role==='alert'));
  f.state.save=true;f.apply();assert.equal(f.navigations.length,1);
  assert.equal(nodes(f.tree,'p').filter(node=>node.props.role==='alert').length,0);
  assert.deepEqual(f.writes.filter(write=>write[0]==='topic').map(write=>write[2]),['funding','funding']);
});

for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv','fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk']) {
  test(`missing technology results retain their localized selection and exit to all: ${locale}`,()=>{
    const f=fixture({locale,facets:[{type:'news',topic:'funding',country:'DE'}]});
    const option=f.topic().options.find(option=>option.value==='technology');
    assert.equal(option.label,translatorFor(locale,'Organizations')('topic.technology'));assert.equal(option.disabled,true);
    assert.equal(f.topic().options.some(option=>option.value==='industry'),false);
    f.choose('');f.apply();assert.match(f.navigations[0][0],/topic=all/);
  });
}


test('native quick filters apply actual country/topic while preserving the query and explicit topic preference',()=>{
 const country=fixture();country.quick(0,'all');assert.equal(country.navigations.length,1);let params=new URL(country.navigations[0][0],'https://example.test').searchParams;assert.equal(params.get('country'),'all');assert.equal(params.get('q'),'kept query');assert.equal(params.get('topic'),'technology');assert.equal(country.writes.filter(w=>w[0]==='topic').length,0);
 const topic=fixture();topic.quick(1,'funding');params=new URL(topic.navigations[0][0],'https://example.test').searchParams;assert.equal(params.get('topic'),'funding');assert.equal(params.get('q'),'kept query');assert.deepEqual(topic.writes[1],['topic','cg_news_topic_0123456789abcdef','funding']);
});

test('native News country choices include organization-only countries and Neutral without changing ordinary facets',()=>{const web=fixture();const native=fixture({native:true});const options=f=>f.browse().nativeQuickFilters[0].props.options;assert.ok(!options(web).some(x=>x.value==='AT'));assert.ok(options(native).some(x=>x.value==='AT'));assert.ok(options(native).some(x=>x.value==='unassigned'));native.quick(0,'AT');assert.equal(new URL(native.navigations.at(-1)[0],'https://example.test').searchParams.get('country'),'AT');});
