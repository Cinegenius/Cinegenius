import test from 'node:test';
import assert from 'node:assert/strict';
import * as history from './recent-searches.ts';
test('retiring search history removes only its legacy key and never reads its contents', () => {
  const saved = new Map([['cg_recent_searches', '["private search"]'], ['filters', 'Berlin'], ['draft', 'unfinished'], ['cg_cookies_ok', '1']]);
  const storage = {removeItem(key) {saved.delete(key)}, getItem() {assert.fail('Must not read retired history')}, setItem() {assert.fail('Must not save search history')}};
  history.removeRecentSearches(storage);
  assert.deepEqual([...saved], [['filters', 'Berlin'], ['draft', 'unfinished'], ['cg_cookies_ok', '1']]);
  history.removeRecentSearches(storage);
  assert.equal(saved.size, 3);
});
test('blocked legacy deletion remains nonfatal and there is no history reader or writer', () => {
  history.removeRecentSearches({removeItem() {throw new Error('Blocked')}});
  assert.deepEqual(Object.keys(history), ['removeRecentSearches']);
});
