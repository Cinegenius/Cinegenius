import test from 'node:test';
import assert from 'node:assert/strict';
import { validPronouns, publicPronouns } from './profile-identity.ts';
test('pronouns require explicit visibility and accept international self-description', () => {
  for (const value of ['er/ihm', 'sie/ihr', 'they/them', '彼／彼女', 'вона/її', null, '']) assert.ok(validPronouns(value));
  for (const value of ['x'.repeat(61), '<script>', 'a\nb', '\u0085', {}, false]) assert.equal(validPronouns(value), false);
  assert.equal(publicPronouns({pronouns:'they/them'}), null);
  assert.equal(publicPronouns({pronouns:'they/them',show_pronouns:false}), null);
  assert.equal(publicPronouns({pronouns:'they/them',show_pronouns:true}), 'they/them');
  assert.equal(publicPronouns({pronouns:' ',show_pronouns:true}), null);
});
