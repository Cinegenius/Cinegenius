import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const compiled = ts.transpileModule(readFileSync(new URL("./rateLimit.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture(result) {
  const calls = [], logs = [];
  const mocks = {
    "./db": { db: { rpc(name, params) {
      calls.push({ name, params });
      return typeof result === "function" ? result() : Promise.resolve(result);
    } } },
  };
  const loaded = { exports: {} };
  new Function("require", "module", "exports", "console", compiled)(name => {
    assert.ok(Object.hasOwn(mocks, name), `Unmocked dependency: ${name}`);
    return mocks[name];
  }, loaded, loaded.exports, { error: (...values) => logs.push(values) });
  return { rateLimit: loaded.exports.rateLimit, calls, logs };
}

test("valid persistent counters retain the exact allowance and one atomic RPC", async () => {
  for (const [count, expected] of [
    [1, { allowed: true, remaining: 9 }],
    [10, { allowed: true, remaining: 0 }],
    [11, { allowed: false, remaining: 0 }],
  ]) {
    const f = fixture({ data: count, error: null });
    const before = Date.now();
    assert.deepEqual(await f.rateLimit("own-test-bucket", 10, 60), expected);
    const after = Date.now();
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].name, "upsert_rate_limit");
    assert.equal(f.calls[0].params.p_key, "own-test-bucket");
    assert.equal(f.calls[0].params.p_limit, 10);
    const end = Date.parse(f.calls[0].params.p_window_end);
    assert.ok(end >= before + 60_000 && end <= after + 60_000);
    assert.deepEqual(f.logs, []);
  }
});

test("missing, nonnumeric and invalid counters deny instead of creating an allowance", async () => {
  for (const count of [null, undefined, "1", true, {}, [], NaN, Infinity, -Infinity, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const f = fixture({ data: count, error: null });
    assert.deepEqual(await f.rateLimit("own-test-bucket", 10, 60), { allowed: false, remaining: 0 });
    assert.equal(f.calls.length, 1);
    assert.equal(f.logs.length, 1);
  }
});

test("RPC errors, thrown transports and absent results deny without retries or private diagnostics", async () => {
  const privateValue = "PRIVATE_BACKEND_VALUE";
  for (const result of [
    { data: 1, error: { message: privateValue, details: privateValue, hint: privateValue } },
    () => { throw new Error(privateValue); },
    () => Promise.reject(new Error(privateValue)),
    null,
    undefined,
  ]) {
    const f = fixture(result);
    assert.deepEqual(await f.rateLimit(privateValue, 10, 60), { allowed: false, remaining: 0 });
    assert.equal(f.calls.length, 1);
    assert.deepEqual(f.logs, [["[rateLimit] backend unavailable or invalid — denying request"]]);
    assert.ok(!JSON.stringify(f.logs).includes(privateValue));
  }
});
