import test from 'node:test';
import assert from 'node:assert/strict';
import {LOCALES,TEST_TO,TEST_KEY,createEmailHarness,htmlEscape} from './email-test-harness.mjs';
const name='Zoë 李 😀 & <script>name</script> "O’Neil"';
const passwordNative={de:'Passwort zurücksetzen',en:'Reset your password',es:'Restablecer contraseña',it:'Reimposta la password',cs:'Obnovit heslo',hu:'Jelszó visszaállítása',nl:'Wachtwoord resetten','nl-BE':'Wachtwoord resetten',sv:'Återställ lösenord'};
function assertClosed(h){assert.equal(h.state.networkAttempts,0);assert.equal(h.state.cookieReads,0);assert.ok(h.state.keys.every(k=>k===TEST_KEY));assert.ok(h.state.headerReads.every(key=>['svix-id','svix-timestamp','svix-signature'].includes(key)));}
function assertMail(mail,locale,from='noreply'){assert.equal(mail.to,TEST_TO);assert.equal(mail.from,`CineGenius <${from}@cinegenius.co>`);assert.ok(mail.html.includes(`<html lang="${locale}">`));assert.doesNotMatch(mail.subject,/[\r\n\u0000]/);assert.doesNotMatch(mail.html,/<script>name<\/script>/);}
function emailEvent(slug,data={}){return{type:'email.created',data:{to_email_address:TEST_TO,user_id:'recipient-user',subject:'Original vendor subject',body:'Original vendor body with fallback code 112233.',slug,data}};}
for(const locale of LOCALES)for(const slug of['verification_code','reset_password_code'])test(`${locale}: signed Clerk ${slug} uses recipient account language, native copy and exact OTP`,async()=>{
 const h=createEmailHarness({locale,senderLocale:locale==='de'?'sv':'de'}),t=h.translate(locale,'TransactionalEmail'),password=slug==='reset_password_code',code=password?'654321':'123456',event=emailEvent(slug,password?{code}:{otp_code:code});
 const response=await h.webhook(event);assert.equal(response.status,200);assert.equal(h.state.sent.length,1);const mail=h.state.sent[0];assertMail(mail,locale);
 assert.equal(t('otpPasswordHeading'),passwordNative[locale]);assert.equal(mail.subject,t(password?'otpPasswordHeading':'otpVerificationLabel'));assert.ok(mail.html.includes(code));assert.ok(!mail.html.includes('112233'));assert.ok(!mail.html.includes(event.data.subject));assert.ok(!mail.html.includes(event.data.body));
 for(const key of password?['otpPasswordWelcome','otpPasswordHeading','otpPasswordLabel','otpIgnore','brandFooter']:['otpVerificationWelcome','otpVerificationHeading','otpVerificationBody','otpVerificationLabel','otpIgnore','brandFooter'])assert.ok(mail.html.includes(htmlEscape(t(key))),key);
 if(password)assert.ok(mail.html.includes(t.markup('otpPasswordBody',{duration:chunks=>`<strong style="color:#EFEFEF;">${chunks}</strong>`})));
 assert.deepEqual(h.state.lookups,[{kind:'id',id:'recipient-user'}]);assert.ok(h.state.translations.every(call=>call.locale===locale));assert.equal(h.state.verifications.length,1);assert.equal(h.state.verifications[0].body,JSON.stringify(event));assertClosed(h);
});
for(const locale of LOCALES)test(`${locale}: signed user.created welcome uses primary recipient, escaped original name and localized labels/link`,async()=>{
 const h=createEmailHarness({locale,senderLocale:locale==='de'?'sv':'de'}),t=h.translate(locale,'TransactionalEmail');const response=await h.webhook({type:'user.created',data:{id:'recipient-user',email_addresses:[{id:'not-primary',email_address:'other@example.test'},{id:'primary',email_address:TEST_TO}],primary_email_address_id:'primary',first_name:name}});assert.equal(response.status,200);assert.equal(h.state.sent.length,1);const mail=h.state.sent[0];assertMail(mail,locale,'willkommen');
 assert.equal(mail.subject,t('welcomeAccountNamedSubject',{name}));assert.ok(mail.html.includes(htmlEscape(t('welcomeGreetingShort',{name}))));assert.ok(mail.html.includes(htmlEscape(name)));
 for(const key of['welcomeTitle','welcomeLabel','welcomeDachIntro','profileStep','portfolioStepDescription','firstListing','firstListingDescription','discoverStep','discoverStepDescription','dashboard','brandFooter'])assert.ok(mail.html.includes(htmlEscape(t(key))),key);
 assert.ok(mail.html.includes('href="https://cinegenius.co/dashboard"'));assert.match(mail.headers['X-Entity-Ref-ID'],/^welcome-\d+$/);assert.equal(mail.headers.Precedence,'bulk');assert.deepEqual(h.state.lookups,[{kind:'id',id:'recipient-user'}]);assertClosed(h);
});
for(const locale of LOCALES)test(`${locale}: invalid webhook signature sends no mail and does not resolve any recipient`,async()=>{
 const h=createEmailHarness({locale,signatureValid:false});const response=await h.webhook(emailEvent('verification_code',{otp_code:'123456'}));assert.equal(response.status,400);assert.equal(h.state.sent.length,0);assert.equal(h.state.lookups.length,0);assert.equal(h.state.translations.length,0);assert.equal(h.state.verifications.length,1);assertClosed(h);
});
for(const locale of LOCALES)test(`${locale}: unknown vendor security template preserves original subject, HTML, user content and action URL`,async()=>{
 const h=createEmailHarness({locale}),subject='Original security: Έλεγχος 東京 & user title',html='<html lang="xx"><body><h1>Vendor security template</h1><p>Opaque Cologne &amp; München 😀</p><a href="https://accounts.example.test/review?ticket=opaque%2Ftoken&amp;code=123456">Review action</a></body></html>';
 const response=await h.webhook({type:'email.created',data:{to_email_address:TEST_TO,user_id:'recipient-user',subject,body:html,slug:'new_device_security_alert',data:{code:'999999'}}});assert.equal(response.status,200);assert.equal(h.state.sent.length,1);assert.equal(h.state.sent[0].to,TEST_TO);assert.equal(h.state.sent[0].subject,subject);assert.equal(h.state.sent[0].html,html);assertClosed(h);
});

test('missing signature/secret does not verify, look up or send',async()=>{
 for(const options of[{missingSignature:true},{env:{CLERK_WEBHOOK_SECRET:undefined}}]){const h=createEmailHarness(options),response=await h.webhook(emailEvent('verification_code',{otp_code:'123456'}));assert.ok([400,500].includes(response.status));assert.equal(h.state.sent.length,0);assert.equal(h.state.verifications.length,0);assert.equal(h.state.lookups.length,0);assertClosed(h);}
});
test('OTP extraction accepts a standalone six-digit fallback, never a seven-digit reference',async()=>{
 const h=createEmailHarness({locale:'nl'}),event=emailEvent('verification_code');event.data.body='Reference 1234567; your actual code: 654321.';const response=await h.webhook(event);assert.equal(response.status,200);assert.ok(h.state.sent[0].html.includes('654321'));assert.ok(!h.state.sent[0].html.includes('1234567'));assertClosed(h);
});
test('missing OTP retains original vendor message and unknown event sends no mail',async()=>{
 const h=createEmailHarness({locale:'sv'}),event=emailEvent('verification_code');event.data.body='Original security fallback without a code';assert.equal((await h.webhook(event)).status,200);assert.equal(h.state.sent[0].html,event.data.body);assert.equal(h.state.sent[0].subject,event.data.subject);const n=h.state.sent.length;assert.equal((await h.webhook({type:'session.created',data:{}})).status,200);assert.equal(h.state.sent.length,n);assertClosed(h);
});

// Security assertions deliberately remain strict: members' strings are plain text in headers/HTML.
test('user.created welcome subject rejects CRLF/header control characters in first_name',async()=>{
 const h=createEmailHarness({locale:'nl'});const response=await h.webhook({type:'user.created',data:{id:'recipient-user',email_addresses:[{id:'primary',email_address:TEST_TO}],primary_email_address_id:'primary',first_name:'Zoë\r\nBcc: attacker@example.test\u0000 😀'}});assert.equal(response.status,200);assert.equal(h.state.sent.length,1);assert.doesNotMatch(h.state.sent[0].subject,/[\r\n\u0000]/);assertClosed(h);
});
test('OTP argument cannot inject active HTML into a generated security template',async()=>{
 const h=createEmailHarness({locale:'en'});const response=await h.webhook(emailEvent('verification_code',{otp_code:'<img src=x onerror="alert(1)">'}));assert.ok([200,400,422].includes(response.status));for(const mail of h.state.sent)assert.doesNotMatch(mail.html,/<img\s+src=x\s+onerror=/);assertClosed(h);
});

for(const slug of ['verification_code','reset_password_code'])for(const withUserId of [true,false])test(`${slug}: signed mail survives optional ${withUserId?'account':'email'} language lookup failure with unchanged recipient and OTP`,async()=>{
 const h=createEmailHarness({clerkFailure:true,senderLocale:'sv'}),t=h.translate('de','TransactionalEmail'),event=emailEvent(slug,{otp_code:'654321'});
 if(!withUserId)delete event.data.user_id;
 const response=await h.webhook(event);assert.equal(response.status,200);assert.equal(h.state.sent.length,1);
 const mail=h.state.sent[0];assertMail(mail,'de');assert.equal(mail.subject,t(slug==='reset_password_code'?'otpPasswordHeading':'otpVerificationLabel'));assert.ok(mail.html.includes('654321'));assert.ok(!mail.html.includes('112233'));
 assert.equal(h.state.verifications.length,1);assert.equal(h.state.verifications[0].body,JSON.stringify(event));assert.equal(h.state.lookups.length,1);assert.equal(h.state.lookups[0].kind,withUserId?'id':'email');assert.ok(h.state.translations.every(call=>call.locale==='de'));assert.equal(h.state.logs.length,0);assertClosed(h);
});
test('valid native locale hints avoid an unavailable metadata service for every supported language',async()=>{
 for(const locale of LOCALES){
  const h=createEmailHarness({clerkFailure:true,senderLocale:locale==='de'?'sv':'de'}),event=emailEvent('verification_code',{otp_code:'654321'});event.data.locale=locale;
  const response=await h.webhook(event);assert.equal(response.status,200);assert.equal(h.state.sent.length,1);assertMail(h.state.sent[0],locale);assert.ok(h.state.sent[0].html.includes('654321'));assert.equal(h.state.lookups.length,0);assert.equal(h.state.verifications.length,1);assertClosed(h);
 }
});
test('fallback language cannot bypass invalid webhook signature verification',async()=>{
 const h=createEmailHarness({clerkFailure:true,signatureValid:false}),response=await h.webhook(emailEvent('verification_code',{otp_code:'654321'}));
 assert.equal(response.status,400);assert.equal(h.state.sent.length,0);assert.equal(h.state.lookups.length,0);assert.equal(h.state.translations.length,0);assert.equal(h.state.verifications.length,1);assertClosed(h);
});
test('failed language lookup preserves unknown vendor security template and destination exactly',async()=>{
 const h=createEmailHarness({clerkFailure:true,senderLocale:'sv'}),event=emailEvent('new_device_security_alert');event.data.subject='Vendor security subject';event.data.body='<html><body><a href="https://accounts.example.test/security?ticket=opaque">Review</a></body></html>';
 assert.equal((await h.webhook(event)).status,200);assert.equal(h.state.sent.length,1);assert.equal(h.state.sent[0].to,TEST_TO);assert.equal(h.state.sent[0].subject,event.data.subject);assert.equal(h.state.sent[0].html,event.data.body);assert.equal(h.state.verifications.length,1);assertClosed(h);
});
test('verified account-created event still sends escaped default-language welcome when metadata is unavailable',async()=>{
 const h=createEmailHarness({clerkFailure:true,senderLocale:'sv'}),event={type:'user.created',data:{id:'recipient-user',email_addresses:[{id:'primary',email_address:TEST_TO}],primary_email_address_id:'primary',first_name:name}};
 assert.equal((await h.webhook(event)).status,200);assert.equal(h.state.sent.length,1);assertMail(h.state.sent[0],'de','willkommen');assert.ok(h.state.sent[0].html.includes(htmlEscape(name)));assert.equal(h.state.verifications.length,1);assertClosed(h);
});
test('fallback language does not swallow actual verification-mail provider failures',async()=>{
 for(const providerFailure of ['throw','error']){
  const h=createEmailHarness({clerkFailure:true,providerFailure}),response=await h.webhook(emailEvent('verification_code',{otp_code:'654321'}));
  assert.equal(response.status,500);assert.equal(h.state.sent.length,1);assert.equal(h.state.verifications.length,1);assertClosed(h);
 }
});
