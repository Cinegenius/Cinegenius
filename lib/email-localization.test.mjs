import test from 'node:test';
import assert from 'node:assert/strict';
import {LOCALES,TEST_BASE,TEST_TO,TEST_KEY,createEmailHarness,htmlEscape,normalized} from './email-test-harness.mjs';
const opaqueName='Zoë 李 😀 & <script>name</script> "O’Neil"';
const opaqueTitle='Cologne · München & <em>Original film</em> 🎬';
const opaqueRef='CG-Öé-東京<&"';
const cases=[
 {fn:'sendFriendRequestEmail',args:[opaqueName],subject:'friendRequestSubject',values:{name:normalized(opaqueName)},heading:'friendRequestHeading',button:'viewRequest',path:'/dashboard?tab=friends',body:['friendRequestBody'],opaque:[opaqueName]},
 {fn:'sendFriendAcceptedEmail',args:[opaqueName],subject:'friendAcceptedSubject',values:{name:normalized(opaqueName)},heading:'friendAcceptedHeading',button:'viewProfile',path:'/dashboard?tab=friends',body:['friendAcceptedBody'],opaque:[opaqueName]},
 {fn:'sendNewMessageEmail',args:[opaqueName,'Member message: Deutschland, Bayern, Cologne <img src=x onerror=alert(1)> & Français 😀','conv/東京?x=1&y="value"'],subject:'messageSubject',values:{name:normalized(opaqueName)},heading:'messageLabel',button:'openChat',path:'/messages',body:['messageIntro','messageAuthHint','messageFooter'],opaque:[opaqueName,'Member message: Deutschland, Bayern, Cologne <img src=x onerror=alert(1)> & Français 😀']},
 {fn:'sendNewApplicationEmail',args:[opaqueName,opaqueTitle],subject:'applicationSubject',values:{title:normalized(opaqueTitle)},heading:'applicationHeading',button:'viewApplication',path:'/dashboard?tab=messages',body:['applicationBody'],opaque:[opaqueName,opaqueTitle]},
 {fn:'sendWelcomeEmail',args:[opaqueName],subject:'welcomeSubject',heading:'welcomeIntro',button:'dashboard',path:'/dashboard?welcome=1',body:['welcomeIntro','nextSteps','profileStep','profileStepDescription','listingStep','listingStepDescription','supportReply'],opaque:[opaqueName]},
 {fn:'sendNewBookingEmail',args:[opaqueTitle,opaqueName],namespace:'BookingRequest',subject:'incomingSubject',values:{title:normalized(opaqueTitle)},heading:'incomingTitle',button:'viewRequest',path:'/dashboard?tab=bookings',body:['requestOnly'],opaque:[opaqueName,opaqueTitle]},
 {fn:'sendBookingConfirmedEmail',args:[opaqueTitle,opaqueRef],subject:'bookingConfirmedSubject',values:{title:normalized(opaqueTitle)},heading:'bookingConfirmedHeading',button:'viewBooking',path:'/dashboard?tab=bookings',body:['bookingPaymentProcessed','bookingQuestions'],opaque:[opaqueTitle,opaqueRef]},
];
function assertClosed(h){assert.equal(h.state.headerReads.length,0);assert.equal(h.state.networkAttempts,0);assert.equal(h.state.cookieReads,0);assert.ok(h.state.keys.every(k=>k===TEST_KEY));}
function assertMail(mail,locale){assert.equal(mail.to,TEST_TO);assert.equal(mail.from,'CineGenius <noreply@cinegenius.co>');assert.ok(mail.html.includes(`<html lang="${locale}">`));assert.doesNotMatch(mail.subject,/[\r\n\u0000]/);assert.doesNotMatch(mail.html,/<script>|<img src=x|<em>Original film<\/em>/);}
function hrefs(html){return[...html.matchAll(/href="([^"]*)"/g)].map(m=>m[1].replaceAll('&amp;','&'));}
for(const locale of LOCALES)for(const item of cases)test(`${locale}: actual ${item.fn} uses recipient language, catalog, original arguments and safe HTML/URLs`,async()=>{
 const h=createEmailHarness({locale,senderLocale:locale==='de'?'sv':'de'}),t=h.translate(locale,item.namespace??'TransactionalEmail'),email=h.load('lib/email.ts');await email[item.fn](TEST_TO,...item.args);assert.equal(h.state.sent.length,1);const mail=h.state.sent[0];assertMail(mail,locale);
 assert.equal(mail.subject,t(item.subject,item.values));assert.ok(mail.html.includes(htmlEscape(t(item.heading))));assert.ok(mail.html.includes(htmlEscape(t(item.button))));
 for(const key of item.body){if(['friendRequestBody','friendAcceptedBody','applicationBody'].includes(key)){assert.ok(mail.html.includes(t.markup(key,{name:htmlEscape(opaqueName),person:chunks=>`<strong style="color:#f0f0f0">${chunks}</strong>`})));}else assert.ok(mail.html.includes(htmlEscape(t(key))),key);}
 for(const value of item.opaque)assert.ok(mail.html.includes(htmlEscape(value)),`opaque argument changed: ${value}`);
 const links=hrefs(mail.html);if(item.fn==='sendNewMessageEmail'){const link=links.find(link=>new URL(link).pathname==='/messages');assert.ok(link);assert.equal(new URL(link).origin,TEST_BASE);assert.equal(new URL(link).searchParams.get('conv'),item.args[2]);}else assert.ok(links.includes(TEST_BASE+item.path));
 assert.deepEqual(h.state.lookups,[{kind:'email',options:{emailAddress:[TEST_TO],limit:1}}]);assert.ok(h.state.translations.every(call=>call.locale===locale));assertClosed(h);
});
for(const item of cases)test(`${item.fn}: explicit recipient locale bypasses lookup; CRLF subject values stay normalized`,async()=>{
 const h=createEmailHarness({locale:'de',senderLocale:'de'}),args=item.args.map((v,i)=>i===0?'Zoë\r\nBcc: injected@example.test\u0000 😀':v);await h.load('lib/email.ts')[item.fn](TEST_TO,...args,'nl-BE');assert.equal(h.state.sent.length,1);assertMail(h.state.sent[0],'nl-BE');assert.equal(h.state.lookups.length,0);assertClosed(h);
});
test('message preview preserves Unicode code points, bounded text and opaque member language without active HTML',async()=>{
 const h=createEmailHarness({locale:'sv'});await h.load('lib/email.ts').sendNewMessageEmail(TEST_TO,'😀'.repeat(101),'🎬'.repeat(201),'opaque&conv');const m=h.state.sent[0];assertMail(m,'sv');assert.ok(m.subject.includes('😀'.repeat(100)));assert.ok(!m.subject.includes('😀'.repeat(101)));assert.ok(m.html.includes('🎬'.repeat(200)+'…'));assert.ok(!m.html.includes('🎬'.repeat(201)));assert.doesNotMatch(m.html,/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u);assertClosed(h);
});
test('missing dummy provider configuration skips sends and lookups without global environment',async()=>{
 const h=createEmailHarness({env:{RESEND_API_KEY:undefined}}),email=h.load('lib/email.ts');for(const item of cases)await email[item.fn](TEST_TO,...item.args);assert.equal(h.state.sent.length,0);assert.equal(h.state.lookups.length,0);assert.equal(h.state.keys.length,0);assertClosed(h);
});
for(const failure of ['throw','reject'])test(`best-effort provider ${failure} does not fail caller or log member data`,async()=>{
 const h=createEmailHarness({providerFailure:failure});await h.load('lib/email.ts').sendNewMessageEmail(TEST_TO,opaqueName,opaqueTitle,'controlled');assert.equal(h.state.sent.length,1);const log=JSON.stringify(h.state.logs);for(const value of[TEST_TO,opaqueName,opaqueTitle])assert.ok(!log.includes(value));assertClosed(h);
});
