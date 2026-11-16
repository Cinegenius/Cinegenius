import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
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
  const mocks={'server-only':{},'next/headers':{cookies:async()=>({get:key=>({value:jar.get(key)})})},'@/lib/news-topic':topic};
  new Function('require','module','exports',source)(name=>mocks[name],module,module.exports);
  const read=module.exports.homeNewsTopic;
  assert.equal((await read('cg_news_country_guest')).selection,'technology');
  assert.equal((await read('cg_news_country_0123456789abcdef')).selection,'funding');
  assert.equal((await read('cg_news_country_fedcba9876543210')).selection,'all');
  jar.set('cg_news_topic_guest','<script>');
  assert.equal((await read('cg_news_country_guest')).selection,'all');
});
