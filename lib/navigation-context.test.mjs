import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeViewRecord, viewRecord, sameViewValue, VIEW_STATE_KEY } from './navigation-context.ts';

test('history round trip retains bounded controls and Next router state across multiple details', () => {
  const router = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ['original-tree'] };
  const first = mergeViewRecord(router, '/creators', 'member-a', {
    fields: { query: 'Licht', selectedRoles: new Set(['licht:gaffer']), pagination: { filterKey: 'light', visibleCount: 48 } }, y: 1860,
  });
  const browserEntry = structuredClone(first);
  const detail = mergeViewRecord(router, '/profile/test', 'member-a', { from: '/creators', y: 0 });
  assert.equal(viewRecord(detail, '/profile/test', 'member-a').from, '/creators');
  assert.equal(viewRecord(browserEntry, '/creators', 'member-a').y, 1860);
  assert.deepEqual(viewRecord(browserEntry, '/creators', 'member-a').fields.selectedRoles, new Set(['licht:gaffer']));
  const returned = mergeViewRecord(browserEntry, '/creators', 'member-a', { y: 2100 });
  assert.equal(viewRecord(returned, '/creators', 'member-a').fields.pagination.visibleCount, 48);
  assert.deepEqual(returned.__PRIVATE_NEXTJS_INTERNALS_TREE, router.__PRIVATE_NEXTJS_INTERNALS_TREE);
  assert.equal(returned.__NA, true);
});

test('history controls cannot leak into another account, route, or anonymous view', () => {
  const saved = mergeViewRecord({ __NA: true }, '/admin', 'admin-a', { fields: { search: 'private-filter', page: 4 }, y: 900 });
  for (const [path, owner] of [['/admin','admin-b'], ['/admin','guest'], ['/companies','admin-a']]) {
    assert.deepEqual(viewRecord(saved, path, owner).fields, {});
    assert.equal(viewRecord(saved, path, owner).y, undefined);
  }
  const other = mergeViewRecord(saved, '/admin', 'admin-b', { fields: { page: 1 } });
  assert.doesNotMatch(JSON.stringify(other[VIEW_STATE_KEY]), /private-filter/);
});

test('equivalent controls do not require repeated history writes, including structured-cloned sets',()=>{
  assert.equal(sameViewValue(new Set(['a','b']),structuredClone(new Set(['a','b']))),true);
  assert.equal(sameViewValue({page:2,filterKey:'camera'},{page:2,filterKey:'camera'}),true);
  assert.equal(sameViewValue(new Set(['a']),new Set(['b'])),false);
  assert.equal(sameViewValue({page:2},{page:3}),false);
});

test('all primary lists use shared view state; refreshed crew data cannot reset visible results', () => {
  for (const path of ['app/creators/CreatorsContent.tsx','app/companies/CompaniesContent.tsx','app/locations/LocationsContent.tsx','app/props/PropsContent.tsx','app/jobs/JobsContent.tsx','app/projects/ProjectsContent.tsx','components/CommunityBoard.tsx','app/admin/page.tsx']) {
    const source = readFileSync(path,'utf8');
    assert.match(source, /useViewState/);
  }
  const crew = readFileSync('app/creators/CreatorsContent.tsx','utf8');
  assert.doesNotMatch(crew, /CreatorsInner key=/);
  assert.doesNotMatch(crew, /setVisibleCount\(PAGE_SIZE\)/);
  assert.match(crew, /pagination.filterKey === filterKey/);
});

test('deferred message scrolls are conversation guarded and only scroll the message viewport', () => {
  const source = readFileSync('app/messages/page.tsx','utf8');
  assert.doesNotMatch(source, /scrollIntoView/);
  assert.match(source, /activeIdRef.current !== convId \|\| \(!options.scroll && !atBottomRef.current\)/);
  assert.match(source, /setNewMessagesAvailable\(true\)/);
  assert.match(source, /sequence !== conversationRequestSequence.current/);
});
