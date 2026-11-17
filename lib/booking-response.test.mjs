import test from 'node:test';
import assert from 'node:assert/strict';
import { respondToBooking } from './booking-response.ts';

test('a booking status requires a successful, matching server acknowledgement', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  for (const [status, payload] of [[500, {}], [409, {}], [200, {}], [200, {success: true, status: 'rejected'}]]) {
    globalThis.fetch = async () => Response.json(payload, {status});
    await assert.rejects(respondToBooking('own-booking', 'confirmed'));
  }
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/bookings/own-booking');
    assert.deepEqual(JSON.parse(options.body), {status: 'confirmed'});
    assert.equal(options.cache, 'no-store');
    return Response.json({success: true, status: 'confirmed'});
  };
  assert.equal(await respondToBooking('own-booking', 'confirmed'), 'confirmed');
  globalThis.fetch = async () => { throw new Error('Connection interrupted'); };
  await assert.rejects(respondToBooking('own-booking', 'rejected'), /interrupted/);
});

// Exercise the actual dashboard action, including its failure and double-tap paths.
import { readFileSync } from 'node:fs';
import ts from 'typescript';
test('dashboard keeps a pending booking on failure and prevents duplicate decisions', async () => {
  const source = readFileSync(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'respondBooking') handler = node.initializer; ts.forEachChild(node, visit); }
  visit(ast); assert.ok(handler);
  const code = ts.transpileModule(`const respondBooking = ${handler.getText(ast)};`, {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText;
  let rows = [{id:'own',status:'pending'}], error = null, responding = null, reload = 0, calls = 0, release;
  const deps = {
    bookingResponseLock: {current:false}, bookingResponseAbort: {current:null},
    setRespondingBooking: value => { responding = value; }, setBookingResponseError: value => { error = value; },
    setIncomingBookings: update => { rows = update(rows); }, setIncomingReload: update => { reload = update(reload); },
    respondToBooking: async () => { calls++; await new Promise(resolve => { release = resolve; }); throw new Error('503'); },
  };
  const act = new Function(...Object.keys(deps), code+'return respondBooking;')(...Object.values(deps));
  const first = act('own','confirmed'); await act('own','rejected'); assert.equal(calls,1);
  release(); await first;
  assert.equal(rows[0].status,'pending'); assert.equal(error,'own'); assert.equal(responding,null); assert.equal(reload,1);
  assert.equal(deps.bookingResponseLock.current,false);
});
