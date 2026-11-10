import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const ID = "a0000000-0000-4000-8000-000000000001";
const USER = "own-test-admin";
function fixture(options = {}) {
  const calls = [];
  const timeouts = [];
  const primary = { id: "primary", emailAddress: "own-admin@example.invalid", verification: { status: "verified" } };
  const user = options.user ?? { primaryEmailAddressId: "primary", emailAddresses: [primary] };
  const mocks = {
    "server-only": {},
    "@clerk/nextjs/server": { clerkClient: async () => ({ users: { getUser: async id => { calls.push({ kind: "user", id }); if (options.identityThrows) throw new Error("PRIVATE_IDENTITY_DETAILS"); return user; } } }) },
    resend: { Resend: class {
      constructor(key) { assert.equal(key, "not-a-real-key"); }
      emails = { get: async (id, config) => {
        calls.push({ kind: "read", id });
        assert.ok(config.signal instanceof AbortSignal);
        if (options.throws) throw new Error("PRIVATE_PROVIDER_DATA");
        return options.response ?? { error: null, data: { id: ID, to: [primary.emailAddress], subject: "PRIVATE_SUBJECT", html: "PRIVATE_BODY" } };
      } };
    } },
  };
  const code = ts.transpileModule(readFileSync(new URL("./listing-freshness-diagnostics.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", "process", "AbortSignal", code)(name => {
    assert.ok(Object.hasOwn(mocks, name), `Unexpected dependency ${name}`);
    return mocks[name];
  }, loaded, loaded.exports, { env: options.noKey ? {} : { RESEND_API_KEY: "not-a-real-key" } }, { timeout(milliseconds) { timeouts.push(milliseconds); return AbortSignal.timeout(milliseconds); } });
  return { check: loaded.exports.checkListingFreshnessReadAccess, calls, timeouts };
}
test("diagnostic requires valid input and configured key before any account or provider access", async () => {
  const f = fixture();
  assert.equal(await f.check(USER, "not-an-id"), "not_found");
  assert.equal(await f.check("", ID), "not_found");
  assert.deepEqual(f.calls, []);
  const noKey = fixture({ noKey: true });
  assert.equal(await noKey.check(USER, ID), "not_configured");
  assert.deepEqual(noKey.calls, []);
});
test("diagnostic requires the current admin's verified primary email, never a secondary fallback", async () => {
  for (const user of [
    { primaryEmailAddressId: "missing", emailAddresses: [] },
    { primaryEmailAddressId: "primary", emailAddresses: [{ id: "primary", emailAddress: "own@example.invalid", verification: { status: "unverified" } }, { id: "secondary", emailAddress: "verified@example.invalid", verification: { status: "verified" } }] },
  ]) {
    const f = fixture({ user });
    assert.equal(await f.check(USER, ID), "verified_email_required");
    assert.deepEqual(f.calls, [{ kind: "user", id: USER }]);
  }
});
test("diagnostic reads exactly one existing own message with timeout and exposes only a fixed status", async () => {
  const f = fixture({ response: { error: null, data: { id: ID, to: [" OWN-ADMIN@EXAMPLE.INVALID "], html: "PRIVATE_BODY", subject: "PRIVATE_SUBJECT" } } });
  assert.equal(await f.check(USER, ID.toUpperCase()), "readable");
  assert.deepEqual(f.calls, [{ kind: "user", id: USER }, { kind: "read", id: ID }]);
  assert.deepEqual(f.timeouts, [8_000]);
});
test("foreign, multiple-recipient, missing or mismatched messages are indistinguishable and reveal no data", async () => {
  for (const data of [null, { id: ID, to: ["foreign@example.invalid"] }, { id: ID, to: ["own-admin@example.invalid", "foreign@example.invalid"] }, { id: "other", to: ["own-admin@example.invalid"] }, { id: ID, to: [] }, { id: ID, to: [null] }]) {
    const f = fixture({ response: { error: null, data } });
    assert.equal(await f.check(USER, ID), "not_found");
    assert.equal(f.calls.filter(call => call.kind === "read").length, 1);
  }
});
test("diagnostic refuses CC and BCC recipients, including malformed recipient fields", async () => {
  for (const extra of [
    { cc: ["foreign@example.invalid"] }, { bcc: ["foreign@example.invalid"] },
    { cc: ["own-admin@example.invalid"] }, { bcc: ["own-admin@example.invalid"] },
    { cc: "foreign@example.invalid" }, { bcc: "foreign@example.invalid" },
  ]) {
    const f = fixture({ response: { error: null, data: { id: ID, to: ["own-admin@example.invalid"], ...extra } } });
    assert.equal(await f.check(USER, ID), "not_found");
    assert.equal(f.calls.filter(call => call.kind === "read").length, 1);
  }
  for (const extra of [{ cc: [], bcc: [] }, { cc: null, bcc: null }]) {
    const f = fixture({ response: { error: null, data: { id: ID, to: ["own-admin@example.invalid"], ...extra } } });
    assert.equal(await f.check(USER, ID), "readable");
  }
});
test("send-only credentials, missing messages and provider failure return bounded fixed outcomes without retries", async () => {
  for (const [statusCode, expected] of [[401, "permission_denied"], [403, "permission_denied"], [404, "not_found"], [429, "unavailable"], [500, "unavailable"]]) {
    const f = fixture({ response: { data: null, error: { statusCode, message: "PRIVATE_PROVIDER_DATA" } } });
    assert.equal(await f.check(USER, ID), expected);
    assert.equal(f.calls.filter(call => call.kind === "read").length, 1);
  }
  assert.equal(await fixture({ throws: true }).check(USER, ID), "unavailable");
});

test("identity service failure stops before provider access and returns no private exception", async () => {
  const f = fixture({ identityThrows: true });
  assert.equal(await f.check(USER, ID), "unavailable");
  assert.deepEqual(f.calls, [{ kind: "user", id: USER }]);
  assert.deepEqual(f.timeouts, []);
});
