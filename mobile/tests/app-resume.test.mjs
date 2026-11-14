import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const origin = 'https://www.cinegenius.co';
const script = readFileSync(new URL('../src/app-resume.js', import.meta.url), 'utf8')
  .replace('null /* CINEGENIUS_RESUME_ORIGIN */', () => JSON.stringify(origin));
function resume(current = origin, subframe = false) {
  const events = [];
  const window = {location:{origin:current},dispatchEvent:event=>events.push(event)};
  window.self = window; window.top = subframe ? {} : window;
  vm.runInNewContext(script, {window, Event});
  return events;
}
test('native resume dispatches the shared event once without any payload', () => {
  const events = resume();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'cinegenius:app-resume');
  assert.equal(events[0].detail, undefined);
});
test('resume ignores offline, external, lookalike, wrong-port and embedded pages', () => {
  for (const url of ['capacitor://localhost','http://www.cinegenius.co','https://www.cinegenius.co:8443',
    'https://www.cinegenius.co.evil.example','https://clerk.cinegenius.co']) assert.deepEqual(resume(url), []);
  assert.deepEqual(resume(origin, true), []);
});
