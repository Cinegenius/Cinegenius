import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILE_ABOUT_HUES, profileAboutTheme } from './profile-about-theme.ts';
import { departments } from './departments.ts';
import { FILM_DEPARTMENTS } from './filmRoles.ts';

test('every stable profile and film department has its own curated About color', () => {
  for (const department of [...departments, ...FILM_DEPARTMENTS]) assert.ok(Object.hasOwn(PROFILE_ABOUT_HUES, department.id), department.id);
  assert.equal(new Set(Object.values(PROFILE_ABOUT_HUES)).size, Object.keys(PROFILE_ABOUT_HUES).length);
  assert.equal(PROFILE_ABOUT_HUES.licht, 48, 'light retains the requested yellow');
  assert.equal(PROFILE_ABOUT_HUES.maske, 341, 'make-up retains the requested soft pink');
});

test('About decoration follows explicit primary occupation, then existing canonical department, without mutating content', () => {
  const crew = Object.freeze({ primaryOccupation: Object.freeze({ departmentId: 'licht', roleId: 'role' }), occupations: Object.freeze([{ departmentId: 'maske', roleId: 'role' }]), department: 'kamera' });
  const before = JSON.stringify(crew);
  assert.equal(profileAboutTheme(crew).department, 'licht');
  assert.equal(profileAboutTheme({ occupations: [{ departmentId: 'maske', roleId: 'role' }] }).department, 'maske');
  assert.equal(profileAboutTheme({ department: 'kamera' }).department, 'kamera');
  assert.equal(JSON.stringify(crew), before);
});

test('unknown IDs, translated words and absent or hidden occupation information use neutral glass', () => {
  for (const department of ['', 'Licht', 'Lighting', 'constructor', '__proto__', 'private-department-canary']) assert.deepEqual(profileAboutTheme({ department }), { department: 'neutral', hue: 210, saturation: '0%' });
  assert.equal(profileAboutTheme(null).department, 'neutral');
  assert.equal(profileAboutTheme({ primaryOccupation: { departmentId: 'private-department-canary', roleId: 'role' }, department: 'maske' }).department, 'neutral', 'unknown explicit primary is never guessed from a secondary field');
});
