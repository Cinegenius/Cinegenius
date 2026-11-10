import test from 'node:test';
import assert from 'node:assert/strict';
import {LOCALES,TEST_TO,createEmailHarness} from './email-test-harness.mjs';
for(const locale of LOCALES)test(`${locale}: actual recipientEmailLocale resolves that account by email or ID, never sender cookie`,async()=>{
 const h=createEmailHarness({locale,senderLocale:locale==='de'?'sv':'de'}),resolve=h.recipientLocale();assert.equal(await resolve(TEST_TO),locale);assert.equal(await resolve(TEST_TO,'recipient-user'),locale);assert.deepEqual(h.state.lookups,[{kind:'email',options:{emailAddress:[TEST_TO],limit:1}},{kind:'id',id:'recipient-user'}]);assert.equal(h.state.cookieReads,0);assert.equal(h.state.headerReads.length,0);assert.equal(h.state.networkAttempts,0);
});
test('recipient helper canonicalizes explicit regional hints, metadata fallbacks and missing-account default',async()=>{
 const hinted=createEmailHarness({clerkFailure:true});assert.equal(await hinted.recipientLocale()(TEST_TO,'not-needed','NL_be'),'nl-BE');assert.equal(hinted.state.lookups.length,0);
 for(const[privateMetadata,unsafeMetadata,expected]of[[{cinegeniusLocale:'cs'},{} ,'cs'],[{}, {cinegeniusLocale:'hu'},'hu'],[{cinegeniusLocale:'bad'},{cinegeniusLocale:'sv'},'sv']]){const h=createEmailHarness({users:[{id:'recipient-user',emailAddresses:[{emailAddress:TEST_TO}],locale:'invalid',privateMetadata,unsafeMetadata}]});assert.equal(await h.recipientLocale()(TEST_TO),expected);assert.equal(h.state.cookieReads,0);}
 const absent=createEmailHarness({users:[],senderLocale:'sv'});assert.equal(await absent.recipientLocale()(TEST_TO),'de');assert.equal(absent.state.cookieReads,0);
});
test('failed recipient-language lookup prevents accidental use of sender language or sending incomplete transactional copy',async()=>{
 const h=createEmailHarness({clerkFailure:true,senderLocale:'sv'});await h.load('lib/email.ts').sendFriendRequestEmail(TEST_TO,'Opaque Person');assert.equal(h.state.sent.length,0);assert.equal(h.state.cookieReads,0);assert.equal(h.state.headerReads.length,0);assert.equal(h.state.networkAttempts,0);assert.ok(h.state.logs.length>0);assert.ok(!JSON.stringify(h.state.logs).includes(TEST_TO));
});
