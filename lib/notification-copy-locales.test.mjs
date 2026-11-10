import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {notificationCopy, translatorFor} from './i18n-test-fixture.mjs';
import {SUPPORTED_LOCALES} from './i18n/locales.ts';

const {canonicalNotification, localizeNotification} = notificationCopy;
const index = JSON.parse(readFileSync(new URL('./i18n/notification-index.json', import.meta.url), 'utf8'));
const values = {value0:'Márta Andersson ✓', value1:'東京 – member title {never_translate}', value2:5,
  title:'Lumière & Özgür {member_text}', ref:'CG-001/abc', name:'Ana «Zoë»', company:'My Company GmbH', roles:'My Own Role'};
const stored = (type, field, text) => Object.freeze({id:'same-stored-id', user_id:'member-1', type,
  title:'Unrecognized human title', body:'Personal member text stays exactly as written.', [field]:text,
  href:'/dashboard?ref=opaque&lang=en', read:false, created_at:'2026-11-01T12:00:00Z', metadata:{original:'unchanged'}});

for (const locale of SUPPORTED_LOCALES) {
  test(`canonical notifications use the ${locale} reader catalogue and preserve stored identities and member values`, () => {
    const t = translatorFor(locale, 'NotificationCopy');
    for (const [key, entry] of Object.entries(index)) {
      const parameters = {...values, value1:key==='n_35bffb78df4b'?5:values.value1};
      const original = stored(entry.types[0], entry.field, canonicalNotification(key, parameters));
      const before = JSON.stringify(original);
      const projected = localizeNotification(original, t);
      assert.equal(projected[entry.field], t(key, parameters), key);
      for (const field of Object.keys(original).filter(field => field !== entry.field)) {
        assert.deepEqual(projected[field], original[field], `${key}: preserve ${field}`);
      }
      assert.equal(JSON.stringify(original), before, `${key}: no storage mutation`);
    }
    for (const count of [1,2,4,5,1000]) {
      for (const [key, type, field, parameters] of [
        ['n_794be4485c9a','review','body',{...values,value1:'Tokyo Studio',value2:count}],
        ['n_35bffb78df4b','booking_request','body',{...values,value1:count}],
      ]) {
        if (key==='n_794be4485c9a' && count>5) continue; // Ratings only allow one to five stars.
        const original = stored(type, field, canonicalNotification(key, parameters));
        assert.equal(localizeNotification(original, t)[field], t(key, parameters), `${key}: count ${count}`);
      }
    }
  });

  test(`documented older-language templates project to ${locale} without changing free text or database rows`, () => {
    const t = translatorFor(locale, 'NotificationCopy');
    for (const [key, entry] of Object.entries(index)) {
      for (const template of [entry.legacy, ...(entry.legacyVariants ?? [])]) {
        const parameters = {...values, value1:key==='n_35bffb78df4b'?5:values.value1, legacySuffix:'e'};
        const text = template.replace(/\{(\w+)\}/g, (_match,name) => String(parameters[name]));
        const original = stored(entry.types[0], entry.field, text);
        const before = JSON.stringify(original);
        assert.equal(localizeNotification(original,t)[entry.field], t(key,parameters), `${key}: ${template}`);
        assert.equal(JSON.stringify(original),before);
      }
    }
    for (const original of [
      stored('friend_request','body','Mi mensaje personal. Meine persönliche Nachricht. My message.'),
      stored('admin_custom','body',canonicalNotification('bookingSentBody',values)),
      stored('review','body','x'.repeat(16_001)),
      stored('review','body','Ana hat dein Inserat „Studio" mit NaN Sternen bewertet.'),
      stored('booking_request','body','Ana hat dein Inserat für 1.5 Tag(e) gebucht.'),
    ]) assert.deepEqual(localizeNotification(original,t),original);
  });
}

test('ambiguous legacy delimiters never rewrite member company or role content',()=>{
  const parameters={value0:'Ana',value1:'Film als Kunst GmbH',value2:'Director'};
  const original=stored('company_join_request','body',canonicalNotification('n_4226c25553e7',parameters));
  assert.deepEqual(localizeNotification(original,translatorFor('nl','NotificationCopy')),original);
});
