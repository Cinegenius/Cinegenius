import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardLegacyDestination } from './personal-area-navigation.ts';

test('saved personal links lead to the one current destination for each task', () => {
  for (const [query, expected] of [
    ['tab=profil', '/profile'], ['tab=favorites', '/favorites'],
    ['tab=friends', '/messages?view=friends'], ['tab=firma', '/company-dashboard'],
    ['tab=messages', '/messages'], ['tab=messages&conv=chat-1', '/messages?conv=chat-1'],
    ['tab=messages&conversation=chat%20with%20space', '/messages?conv=chat%20with%20space'],
  ]) assert.equal(dashboardLegacyDestination(new URLSearchParams(query)), expected);
});

test('bookings, offer editing, analyses and settings stay in their existing dashboard flow', () => {
  for (const query of ['', 'tab=settings&section=privacy', 'tab=bookings', 'tab=listings&editListing=offer-1', 'tab=jobs', 'tab=analytics', 'tab=https://outside.invalid']) {
    assert.equal(dashboardLegacyDestination(new URLSearchParams(query)), null);
  }
  assert.equal(dashboardLegacyDestination(new URLSearchParams('tab=messages&conv=%2F%2Foutside.invalid')), '/messages?conv=%2F%2Foutside.invalid');
});
