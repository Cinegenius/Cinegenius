import test from 'node:test';
import assert from 'node:assert/strict';
import { previewConfig } from '../scripts/preview-config.mjs';

test('public preview stays HTTPS, with no wildcard navigation or native HTTP override', () => {
  const config = previewConfig();
  assert.equal(config.server.url, 'https://www.cinegenius.co/');
  assert.equal(config.server.cleartext, false);
  assert.deepEqual(config.server.allowNavigation, []);
  assert.equal(config.plugins.CapacitorHttp.enabled, false);
  assert.equal(config.plugins.CapacitorCookies.enabled, false);
});

test('only explicit local development ports can use HTTP', () => {
  for (const hostname of ['localhost', '127.0.0.1', '10.0.2.2']) {
    assert.equal(previewConfig(`http://${hostname}:3010`).server.cleartext, true);
  }
});

test('rejects lookalikes, credentials, token URLs and arbitrary hosts', () => {
  for (const url of [
    'http://www.cinegenius.co', 'https://www.cinegenius.co.evil.example',
    'https://www.cinegenius.co@evil.example', 'https://evil.example',
    'https://user:password@www.cinegenius.co', 'https://www.cinegenius.co/?token=secret',
    'https://www.cinegenius.co/#token', 'https://www.cinegenius.co/sign-in',
    'http://localhost', 'http://192.168.0.5:3010', 'file:///index.html',
  ]) assert.throws(() => previewConfig(url), undefined, url);
});
