import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server.js';
import {createEmailHarness,htmlEscape,LOCALES} from './email-test-harness.mjs';
import {validatePublicReport} from './public-report.ts';
import {isAppLocale} from './i18n/locales.ts';
import {trustedMutationOrigin} from './request-origin.ts';

const sample={target:'/props/synthetic',category:'rights',details:'A synthetic report about a specific item, no actual provider delivery.',reporterName:'Test Reporter',reporterEmail:'reporter@example.invalid',goodFaith:true};
const copy=h=>Object.fromEntries(['subject','heading','intro','reference','next','footer'].map(key=>[key,h.translate('it','PublicReportEmail')(key)]));
function fixture(options={}) {
  const h=createEmailHarness(options),state={limits:[]};
  const mail=h.load('lib/email.ts');
  const mocks={
    crypto:{createHash},'next/server':{NextRequest,NextResponse},
    'next-intl/server':{getTranslations:async input=>h.translate(typeof input==='string'?'de':input.locale,typeof input==='string'?input:input.namespace)},
    '@/lib/email':mail,'@/lib/i18n/locales':{isAppLocale},'@/lib/public-report':{validatePublicReport},
    '@/lib/rateLimit':{rateLimit:async(...args)=>{state.limits.push(args);return{allowed:!options.limited}}},
    '@/lib/request-origin':{trustedMutationOrigin},
  };
  const module={exports:{}},code=ts.transpileModule(readFileSync(new URL('../app/api/public-reports/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const context=vm.createContext({module,exports:module.exports,process:{env:{NODE_ENV:'production'}},require:id=>{assert.ok(Object.hasOwn(mocks,id),id);return mocks[id]}});
  vm.runInContext(code,context);
  const post=(body=sample,origin='https://www.cinegenius.co')=>module.exports.POST(new NextRequest('https://www.cinegenius.co/api/public-reports',{method:'POST',headers:{origin,'content-type':'application/json','x-forwarded-for':'192.0.2.20'},body:JSON.stringify(body)}));
  return {h,state,mail,post};
}

test('public report HTML treats every reporter-controlled value as text, including tags, quotes and entities',async()=>{
  const f=fixture(),input={...sample,target:'/props/<img src=x onerror="test">&amp;',reporterName:'<b>Reporter</b> " & \'',reporterEmail:'<b>@reporter.example.invalid',details:'Details <a href="https://example.invalid">test</a> &amp; "'};
  const parsed=validatePublicReport(input);assert.equal(parsed.ok,true);
  const result=await f.mail.sendPublicReportEmails(parsed.value,copy(f.h),'it');
  assert.equal(result.operatorSent,true);assert.equal(f.h.state.sent.length,2);
  const html=f.h.state.sent[0].html;
  for(const field of ['target','reporterName','reporterEmail','details'])assert.ok(html.includes(htmlEscape(parsed.value[field])),field);
  assert.doesNotMatch(html,/<img src=x|<b>Reporter|<a href="https:\/\/example.invalid"/);
  assert.equal(f.h.state.networkAttempts,0);
});

for(const locale of LOCALES)test(`${locale}: guest report route sends localized receipt and catalog-based operator copy with correct reference`,async()=>{
  const f=fixture(),response=await f.post({...sample,locale}),result=await response.json();
  assert.equal(response.status,200);assert.equal(result.receiptSent,true);assert.equal(f.h.state.sent.length,2);
  const [operator,receipt]=f.h.state.sent;
  assert.ok(operator.html.includes('<html lang="de">'));
  assert.ok(operator.html.includes(htmlEscape(f.h.translate('de','PublicReportEmail')('operator.heading'))));
  assert.ok(receipt.html.includes(`<html lang="${locale}">`));
  assert.equal(receipt.subject,f.h.translate(locale,'PublicReportEmail')('subject'));
  assert.ok(receipt.html.includes(result.reference));assert.doesNotMatch(receipt.html,/\{reference\}|PublicReportEmail.reference/);
  assert.ok(receipt.html.includes(htmlEscape(f.h.translate(locale,'PublicReportEmail')('heading'))));
  assert.match(response.headers.get('cache-control'),/private.*no-store/);
  assert.equal(f.state.limits.length,1);assert.deepEqual(f.state.limits[0].slice(1),[5,3600]);
  assert.equal(f.h.state.networkAttempts,0);
});

test('foreign origins, durable limit and invalid reports never send mail; anonymous contacts remain optional',async()=>{
  const foreign=fixture();assert.equal((await foreign.post(sample,'https://foreign.example')).status,403);assert.equal(foreign.state.limits.length,0);assert.equal(foreign.h.state.sent.length,0);
  const limited=fixture({limited:true});assert.equal((await limited.post()).status,429);assert.equal(limited.h.state.sent.length,0);
  const invalid=fixture();assert.equal((await invalid.post({...sample,goodFaith:false})).status,400);assert.equal(invalid.h.state.sent.length,0);
  const anonymous=fixture();const response=await anonymous.post({...sample,reporterName:'',reporterEmail:'',locale:'invalid'});assert.equal(response.status,200);assert.equal((await response.json()).receiptSent,false);assert.equal(anonymous.h.state.sent.length,1);
  assert.ok(anonymous.h.state.sent[0].html.includes(htmlEscape(anonymous.h.translate('de','PublicReportEmail')('operator.anonymous'))));
});

for(const providerFailure of ['throw','reject'])test(`unconfirmed operator delivery (${providerFailure}) reports failure and sends no receipt`,async()=>{
  const f=fixture({providerFailure});const response=await f.post();assert.equal(response.status,503);assert.equal(f.h.state.sent.length,1);assert.equal(f.h.state.networkAttempts,0);
  assert.ok(!JSON.stringify(f.h.state.logs).includes(sample.reporterEmail));
});
