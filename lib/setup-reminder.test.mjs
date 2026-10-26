import test from 'node:test';
import assert from 'node:assert/strict';
import { getSetupReminder } from './setup-reminder.ts';
import { START_QUICK_START_DRAFT, normalizeQuickStartDraft, createQuickStartIntentData } from './quick-start-flow.ts';

test('welcome is once per new setup; existing and legacy progress do not restart welcome', () => {
  assert.equal(START_QUICK_START_DRAFT.welcomeAcknowledged, false);
  assert.equal(normalizeQuickStartDraft({ version: 3, name: 'Alex', step: 'location' }).welcomeAcknowledged, true);
  assert.equal(normalizeQuickStartDraft({ version: 3, welcomeAcknowledged: true }).welcomeAcknowledged, true);
  assert.equal(normalizeQuickStartDraft({ intent: 'company', name: 'Alex' }).welcomeAcknowledged, true);
});
test('completed people, searchers and providers receive no setup reminder', () => {
  for (const exists of [true,false]) assert.equal(getSetupReminder(exists, { setupComplete: true }), null);
  assert.equal(getSetupReminder(true, null), null); // bio, photos and filmography never required
});
test('unfinished personal profile identifies first required field and direct resume link', () => {
  const draft = { ...START_QUICK_START_DRAFT, name: 'Alex', personCity: 'München', intents: ['crew'], sections: { crew: createQuickStartIntentData() } };
  const notice = getSetupReminder(false, { quickStart: draft });
  assert.equal(notice.title, 'Dein Profil ist noch nicht öffentlich sichtbar.');
  assert.match(notice.description, /dein Gewerk/);
  assert.equal(notice.href, '/profile-setup?resume=1');
  const existing = getSetupReminder(true, { quickStart: draft });
  assert.doesNotMatch(existing.title, /nicht öffentlich/); // other offers can remain unfinished
});
test('company, location, marketplace and searchers are never told to create a crew profile', () => {
  for (const intent of ['company','location','equipment','search']) {
    const notice = getSetupReminder(false, { quickStart: { ...START_QUICK_START_DRAFT, name: 'Alex', intents: [intent] } });
    assert.doesNotMatch(notice.title, /Dein Profil/);
    assert.doesNotMatch(notice.description, /Gewerk|Tätigkeit/);
  }
});
test('legacy provider drafts keep their existing continuation route', () => {
  assert.equal(getSetupReminder(false, { intent: 'company' }).href, '/company-setup?onboarding=1&resume=1');
  assert.equal(getSetupReminder(false, { intent: 'location' }).href, '/guided-listing?type=location&resume=1');
});
