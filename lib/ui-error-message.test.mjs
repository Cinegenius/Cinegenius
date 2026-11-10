import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createTranslator } from 'use-intl/core';
import { uiErrorMessage } from './ui-error-message.ts';

for (const locale of ['de', 'en', 'es', 'it', 'cs', 'hu', 'nl', 'sv', 'nl-BE']) {
  test(`browser and transport exceptions use the native ${locale} fallback`, () => {
    const messages = JSON.parse(fs.readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    const translate = createTranslator({ locale, messages, onError(error) { throw error; } });
    const fallback = translate('System.requestFailed');
    assert.notEqual(fallback, 'System.requestFailed');
    for (const error of [
      new TypeError('Failed to fetch'), new SyntaxError('Unexpected token < in JSON at position 0'),
      new DOMException('The operation was aborted.', 'AbortError'),
      new DOMException('Failed to execute readAsDataURL', 'NotReadableError'),
      { name: 'NetworkError', message: 'NetworkError when attempting to fetch resource.' },
      new Error('Load failed'), new Error('TypeError: Failed to fetch'), new Error('HTTP 503'), new Error('HTTP/1.1 502 Bad Gateway'),
      new Error('Request failed with status code 500'), new Error('UPLOAD_FAILED'),
      new Error('permission_denied'), new Error('auth/session-expired'), new Error('PGRST116'),
      new Error('23505'), new Error('ECONNRESET'), undefined, {}, new Error('  '),
    ]) assert.equal(uiErrorMessage(error, fallback), fallback);
    const localizedBusinessError = translate('mediaSecurity.tooLarge');
    assert.equal(uiErrorMessage(new Error(localizedBusinessError), fallback), localizedBusinessError);
  });
}

test('unknown vendor prose and member values stay exact', () => {
  const fallback = 'Localized fallback';
  for (const message of [
    'Vendor-specific service is temporarily unavailable. Contact Example support.',
    'The requested profile is private.', '  Este anuncio ya no está disponible.  ',
    'Anna Müller', 'Film als Kunst GmbH', 'North-Star Productions', 'North-Star', 'María-José', 'ELENA',
    'https://member.example/portfolio', 'crew@example.com', 'B2B',
  ]) {
    assert.equal(uiErrorMessage(new Error(message), fallback), message);
    assert.equal(uiErrorMessage({ name: 'UnknownVendorError', message }, fallback), message);
  }
});

test('error inspection is pure and tolerates inaccessible error properties', () => {
  const error = Object.freeze({ name: 'CustomBusinessError', message: 'Cannot join this private team.' });
  assert.equal(uiErrorMessage(error, 'Fallback'), error.message);
  assert.deepEqual(error, { name: 'CustomBusinessError', message: 'Cannot join this private team.' });
  const inaccessible = { get message() { throw new Error('Blocked getter'); } };
  assert.equal(uiErrorMessage(inaccessible, 'Fallback'), 'Fallback');
});
