import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as crypto from 'node:crypto';
import * as profileTopic from './profile-news-topic.ts';
import * as topic from './news-topic.ts';

test('only stable taxonomy values are accepted; countries and cookie injection are rejected', () => {
  for (const value of ['all','technology','funding','education']) assert.equal(topic.newsTopicChoice(value),value);
  for (const value of [null,42,'DE','Technik','technology; path=/','unknown']) assert.equal(topic.newsTopicChoice(value),undefined);
  assert.equal(topic.newsTopicCookieName('cg_news_country_0123456789abcdef'),'cg_news_topic_0123456789abcdef');
  assert.throws(()=>topic.newsTopicCookieName('other; injected=true'));
});

test('explicit selection persists only in its account scope and blocked cookies fail visibly', context => {
  const oldDocument=globalThis.document, oldLocation=globalThis.location;
  context.after(()=>{globalThis.document=oldDocument;globalThis.location=oldLocation;});
  globalThis.location={protocol:'https:'}; globalThis.document={cookie:''};
  assert.equal(topic.rememberNewsTopic('cg_news_topic_0123456789abcdef','technology'),true);
  assert.match(document.cookie,/^cg_news_topic_0123456789abcdef=technology;/);
  assert.match(document.cookie,/SameSite=Lax; Secure/);
  assert.equal(topic.rememberNewsTopic('cg_news_country_guest','technology'),false);
  assert.equal(topic.rememberNewsTopic('cg_news_topic_guest','arbitrary'),false);
  globalThis.document={get cookie(){return '';},set cookie(value){void value;}};
  assert.equal(topic.rememberNewsTopic('cg_news_topic_guest','funding'),false);
  globalThis.document={get cookie(){throw Error('SecurityError');},set cookie(value){void value;}};
  assert.equal(topic.rememberNewsTopic('cg_news_topic_guest','funding'),false);
});

test('server defaults to all topics and never reuses another account or guest preference', async () => {
  const jar=new Map([['cg_news_topic_guest','technology'],['cg_news_topic_0123456789abcdef','funding']]);
  const module={exports:{}};
  const source=ts.transpileModule(readFileSync(new URL('./news-topic-server.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const mocks={'server-only':{},'next/headers':{cookies:async()=>({get:key=>({value:jar.get(key)})})},'@/lib/news-topic':topic,
    'node:crypto':crypto,'@clerk/nextjs/server':{auth:async()=>({userId:null})}};
  new Function('require','module','exports',source)(name=>mocks[name],module,module.exports);
  const read=module.exports.homeNewsTopic;
  assert.equal((await read('cg_news_country_guest')).selection,'technology');
  assert.equal((await read('cg_news_country_0123456789abcdef')).selection,'funding');
  assert.equal((await read('cg_news_country_fedcba9876543210')).selection,'all');
  jar.set('cg_news_topic_guest','<script>');
  assert.equal((await read('cg_news_country_guest')).selection,'all');
});

function serverFixture() {
  const state={userId:'technical-member', profile:{positions:['Gaffer']}, error:null, thrown:false, reads:[], jar:new Map()};
  const loaded={exports:{}};
  const mocks={
    'server-only':{}, 'node:crypto':crypto, '@/lib/news-topic':topic, '@/lib/profile-news-topic':profileTopic,
    '@clerk/nextjs/server':{auth:async()=>({userId:state.userId})},
    'next/headers':{cookies:async()=>({get:key=>({value:state.jar.get(key)})})},
    '@/lib/db':{db:{from:table=>{
      const query={select(fields){state.reads.push([table,'select',fields]);return query;},
        eq(column,value){state.reads.push([table,'eq',column,value]);return query;},
        async maybeSingle(){if(state.thrown) throw Error('offline');return {data:state.profile,error:state.error};}};
      return query;
    }}},
  };
  const code=ts.transpileModule(readFileSync(new URL('./news-topic-server.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports','console',code)(name=>mocks[name],loaded,loaded.exports,{error(){}});
  const scope=id=>`cg_news_country_${crypto.createHash('sha256').update(id).digest('hex').slice(0,16)}`;
  return {state,scope,read:loaded.exports.homeNewsTopic};
}

test('fresh technical signup defaults to technology with only a current-account private read', async()=>{
  const f=serverFixture(),scope=f.scope(f.state.userId);
  assert.deepEqual(await f.read(scope),{cookieName:topic.newsTopicCookieName(scope),selection:'technology'});
  assert.deepEqual(f.state.reads,[['profiles','select','positions,role,crew'],['profiles','eq','user_id','technical-member']]);
  assert.equal(f.state.jar.size,0);
  f.state.profile={positions:['Regisseur/in']};
  assert.equal((await f.read(scope)).selection,'all');
});

test('URL and saved all/topics override inferred interests without extra profile reads', async()=>{
  const f=serverFixture(),scope=f.scope(f.state.userId);
  const cookie=topic.newsTopicCookieName(scope);
  f.state.jar.set(cookie,'funding');
  assert.equal((await f.read(scope)).selection,'funding');
  assert.equal((await f.read(scope,'education')).selection,'education');
  assert.equal((await f.read(scope,'all')).selection,'all');
  assert.equal((await f.read(scope,'invalid')).selection,'funding');
  f.state.jar.set(cookie,'all');
  assert.equal((await f.read(scope)).selection,'all');
  assert.equal(f.state.reads.length,0);
  assert.equal(f.state.jar.get(cookie),'all');
});

test('guest/account switches, missing profiles and failures never reuse another member interest', async()=>{
  const f=serverFixture(),scope=f.scope(f.state.userId);
  assert.equal((await f.read('cg_news_country_guest')).selection,'all');
  assert.equal((await f.read(f.scope('someone-else'))).selection,'all');
  assert.equal(f.state.reads.length,0);
  f.state.jar.set('cg_news_topic_guest','education');
  f.state.jar.set(topic.newsTopicCookieName(f.scope('someone-else')),'funding');
  assert.equal((await f.read(scope)).selection,'technology');
  f.state.profile=null;
  assert.equal((await f.read(scope)).selection,'all');
  f.state.profile={positions:['Gaffer']};f.state.error={message:'unavailable'};
  assert.equal((await f.read(scope)).selection,'all');
  f.state.error=null;f.state.thrown=true;
  assert.equal((await f.read(scope)).selection,'all');
  f.state.thrown=false;
  assert.equal((await f.read(scope)).selection,'technology');
  f.state.userId=null;
  assert.equal((await f.read(scope)).selection,'all');
});
