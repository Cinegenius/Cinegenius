import test from 'node:test';
import assert from 'node:assert/strict';
import {LOCALES,TEST_BASE,TEST_TO,createEmailHarness,htmlEscape,normalized} from './email-test-harness.mjs';
for(const locale of LOCALES)test(`${locale}: actual acceptance mail confirms the request without claiming payment`,async()=>{
 const h=createEmailHarness({locale,senderLocale:locale==='de'?'sv':'de'}),t=h.translate(locale,'TransactionalEmail');
 const title='Original Cologne · 東京 & <b>member title</b> 🎬\r\nBcc: injected@example.test',ref='CG-東京<&"';
 await h.load('lib/email.ts').sendBookingAcceptedEmail(TEST_TO,title,ref);assert.equal(h.state.sent.length,1);const m=h.state.sent[0];
 assert.equal(m.to,TEST_TO);assert.equal(m.from,'CineGenius <noreply@cinegenius.co>');assert.ok(m.html.includes(`<html lang="${locale}">`));assert.equal(m.subject,t('bookingAcceptedSubject',{title:normalized(title)}));assert.doesNotMatch(m.subject,/[\r\n\u0000]/);
 for(const key of ['bookingAcceptedHeading','bookingAcceptedBody','viewBooking','bookingQuestions','footer'])assert.ok(m.html.includes(htmlEscape(t(key))),key);
 assert.ok(m.html.includes(htmlEscape(title)));assert.ok(m.html.includes(htmlEscape(t('bookingReference',{ref}))));assert.ok(m.html.includes(`href="${TEST_BASE}/dashboard?tab=bookings"`));
 assert.ok(!m.html.includes(htmlEscape(t('bookingPaymentProcessed'))),'must not assert payment was processed');const incoming=h.translate(locale,'BookingRequest')('incomingBody',{name:'Provider',title});assert.ok(!m.html.includes(htmlEscape(incoming)));
 assert.doesNotMatch(m.html,/<b>member title<\/b>/);assert.equal(h.state.cookieReads,0);assert.equal(h.state.headerReads.length,0);assert.equal(h.state.networkAttempts,0);assert.equal(h.state.lookups[0].options.emailAddress[0],TEST_TO);
});
