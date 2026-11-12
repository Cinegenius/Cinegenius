import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCALES, TEST_BASE, TEST_TO, TEST_KEY, createEmailHarness, htmlEscape, normalized,
} from './email-test-harness.mjs';

const confirmationUrl = `${TEST_BASE}/newsletter/confirm?token=private-confirmation-token&source=explicit-signup`;

function confirmationCopy(harness, locale) {
  const t = harness.translate(locale, 'NewsletterSignup');
  return {
    subject: t('confirmSubject'),
    heading: t('confirmHeading'),
    body: t('confirmBody'),
    button: t('confirmButton'),
    ignore: t('confirmIgnore'),
  };
}

function assertIsolated(harness) {
  assert.equal(harness.state.networkAttempts, 0);
  assert.equal(harness.state.cookieReads, 0);
  assert.deepEqual(harness.state.headerReads, []);
  assert.deepEqual(harness.state.lookups, []);
  assert.ok(harness.state.keys.every(key => key === TEST_KEY));
}

function assertPrivateDiagnostics(harness, copy) {
  const diagnostics = JSON.stringify(harness.state.logs);
  assert.ok(harness.state.logs.length > 0);
  for (const value of [TEST_TO, confirmationUrl, 'private-confirmation-token', TEST_KEY, ...Object.values(copy)]) {
    assert.ok(!diagnostics.includes(value), `Diagnostic exposed confirmation material: ${value}`);
  }
}

for (const locale of LOCALES) {
  test(`${locale}: explicit newsletter confirmation uses its catalog without account lookup`, async () => {
    const harness = createEmailHarness({locale, senderLocale: locale === 'de' ? 'sv' : 'de'});
    const copy = confirmationCopy(harness, locale);
    const accepted = await harness.load('lib/email.ts').sendNewsletterConfirmationEmail(TEST_TO, confirmationUrl, copy, locale);

    assert.equal(accepted, true);
    assert.equal(harness.state.sent.length, 1);
    const mail = harness.state.sent[0];
    assert.equal(mail.to, TEST_TO);
    assert.equal(mail.from, 'CineGenius <noreply@cinegenius.co>');
    assert.equal(mail.replyTo, 'support@cinegenius.co');
    assert.equal(mail.subject, copy.subject);
    assert.ok(mail.html.includes(`<html lang="${locale}">`));
    for (const key of ['heading', 'body', 'button', 'ignore']) assert.ok(mail.html.includes(htmlEscape(copy[key])));
    assert.ok(mail.html.includes(`href="${htmlEscape(confirmationUrl)}"`));
    assert.deepEqual(harness.state.logs, []);
    assertIsolated(harness);
  });
}

test('newsletter confirmation preserves Unicode, escapes HTML and normalizes the subject', async () => {
  const harness = createEmailHarness();
  const opaque = 'Zoë 李 😀 & <script>private-copy</script> "O’Neil"';
  const copy = {subject: `${opaque}\r\nBcc: hidden@example.test\u0000`, heading: opaque, body: opaque, button: opaque, ignore: opaque};
  const accepted = await harness.load('lib/email.ts').sendNewsletterConfirmationEmail(TEST_TO, confirmationUrl, copy, 'nl-BE');

  assert.equal(accepted, true);
  const mail = harness.state.sent[0];
  assert.equal(mail.subject, normalized(copy.subject));
  assert.doesNotMatch(mail.subject, /[\r\n\u0000]/);
  assert.ok(mail.html.includes(htmlEscape(opaque)));
  assert.doesNotMatch(mail.html, /<script>/);
  assertIsolated(harness);
});

for (const providerFailure of ['reject', 'throw']) {
  test(`newsletter confirmation provider ${providerFailure} fails explicitly without logging private signup data`, async () => {
    const harness = createEmailHarness({providerFailure});
    const copy = confirmationCopy(harness, 'it');
    const accepted = await harness.load('lib/email.ts').sendNewsletterConfirmationEmail(TEST_TO, confirmationUrl, copy, 'it');

    assert.equal(accepted, false);
    assert.equal(harness.state.sent.length, 1);
    assertPrivateDiagnostics(harness, copy);
    assertIsolated(harness);
  });
}

test('newsletter confirmation missing provider configuration fails with a private generic diagnostic', async () => {
  const harness = createEmailHarness({env: {RESEND_API_KEY: undefined}});
  const copy = confirmationCopy(harness, 'de');
  const accepted = await harness.load('lib/email.ts').sendNewsletterConfirmationEmail(TEST_TO, confirmationUrl, copy, 'de');

  assert.equal(accepted, false);
  assert.deepEqual(harness.state.sent, []);
  assert.deepEqual(harness.state.keys, []);
  assertPrivateDiagnostics(harness, copy);
  assertIsolated(harness);
});
