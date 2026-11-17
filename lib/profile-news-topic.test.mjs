import test from 'node:test';
import assert from 'node:assert/strict';
import { profileNewsTopic } from './profile-news-topic.ts';
import { occupationChoices, occupationReference } from './primary-occupation.ts';

const ref = (department, title) => {
  const option = occupationChoices([title]).find(item => item.departmentId === department);
  assert.ok(option, `missing fixture occupation: ${department}/${title}`);
  return occupationReference(option);
};

test('technical members get technology from saved main, secondary or additional jobs', () => {
  for (const [department, title] of [
    ['kamera', '2nd AC (Clapper / Loader)'], ['licht', 'Gaffer (Oberbeleuchter)'],
    ['ton', 'Tonassistenz'], ['grip', 'Key Grip'], ['post', 'Colorist'],
    ['broadcast', 'Broadcast Engineer'], ['virtual', 'LED Wall Operator'],
    ['foto', 'Fotograf/in'], ['sfx', 'SFX Technician'],
  ]) {
    const selection = ref(department, title);
    assert.equal(profileNewsTopic({positions: [title], crew: {occupations: [selection], primaryOccupation: selection}}), 'technology');
  }
  const profile = {positions: ['Regisseur/in', 'Tonassistenz'], crew: {
    primaryOccupation: ref('regie', 'Regisseur/in'),
    occupations: [ref('regie', 'Regisseur/in'), ref('ton', 'Tonassistenz')],
    additionalOccupation: ref('ton', 'Tonassistenz'),
  }};
  assert.equal(profileNewsTopic(profile), 'technology');
  assert.equal(profileNewsTopic({...profile, positions: ['Regisseur/in']}), 'all');
});

test('legacy exact jobs work, but type labels, biographies and abandoned or invented IDs do not', () => {
  assert.equal(profileNewsTopic({role: 'Gaffer'}), 'technology');
  assert.equal(profileNewsTopic({positions: ['Oberbeleuchter', 'Gaffer']}), 'technology');
  for (const profile of [null, {}, {positions: ['Kostümbildner*in']},
    {positions: ['Produzent/in']}, {positions: ['Kamera', 'Techniker', 'unbekannt']},
    {positions: [], profile_type: 'lighting', bio: 'Ich arbeite als Gaffer'},
    {positions: [], crew: {occupations: [ref('licht', 'Gaffer')]}},
    {positions: ['unknown'], crew: {primaryOccupation: {departmentId:'licht', roleId:'licht/invented'}}},
  ]) assert.equal(profileNewsTopic(profile), 'all');
});

test('shared job labels follow their saved department, not a guessed technical synonym', () => {
  const title = 'Playback Operator';
  const options = occupationChoices([title]);
  assert.ok(options.some(option => option.departmentId === 'ton'));
  assert.ok(options.some(option => option.departmentId === 'kamera'));
  assert.equal(profileNewsTopic({positions: [title]}), 'all');
  assert.equal(profileNewsTopic({positions: [title], crew: {occupations: [ref('kamera', title)]}}), 'technology');
  assert.equal(profileNewsTopic({positions: [title], crew: {occupations: [ref('ton', title)]}}), 'technology');
});
