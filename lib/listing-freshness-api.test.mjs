import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
import * as locales from "./i18n/locales.ts";
import { trustedMutationOrigin } from "./request-origin.ts";

const ID = "10000000-0000-4000-8000-000000000001";
const COMPANY_ID = "20000000-0000-4000-8000-000000000001";
const SECOND_ID = "10000000-0000-4000-8000-000000000002";
const FOREIGN_ID = "10000000-0000-4000-8000-000000000003";
const REQUEST_ID = "30000000-0000-4000-8000-000000000001";
const USER = "own-fixture-provider";
const request = (path, method = "GET", body, headers = {}) => new NextRequest(`https://cinegenius.co${path}`, {
  method, headers: { Origin: "https://cinegenius.co", "Content-Type": "application/json", ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
function load(file, mocks) {
  const compiled = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)(name => {
    assert.ok(Object.hasOwn(mocks, name), `Unmocked dependency: ${name}`);
    return mocks[name];
  }, loaded, loaded.exports);
  return loaded.exports;
}
function noStore(response) {
  assert.match(response.headers.get("cache-control") ?? "", /private/);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(response.headers.get("location"), null);
}
function query(table, calls, resolve) {
  const call = { table, operations: [] };
  calls.push(call);
  const chain = {};
  for (const method of ["select", "eq", "in", "order", "limit", "range", "is", "not", "or"]) {
    chain[method] = (...args) => { call.operations.push([method, ...args]); return chain; };
  }
  chain.then = (yes, no) => Promise.resolve().then(() => resolve(call)).then(yes, no);
  chain.maybeSingle = async () => { const result = await resolve(call); return { ...result, data: result.data?.[0] ?? null }; };
  return chain;
}

class FreshnessError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}
function providerFixture(options = {}) {
  const calls = [];
  const state = { version: 7, cycle: 3, status: "active", due_at: "2027-01-01T12:00:00Z", reminder_sent_at: null, followup_sent_at: null, response_deadline_at: null };
  const route = load("../app/api/listing-freshness/[id]/route.ts", {
    "next/server": { NextRequest, NextResponse },
    "@/lib/auth": { requireAuth: async () => {
      calls.push({ kind: "auth" });
      return options.denied ? NextResponse.json({ code: "account" }, { status: 401 }) : { userId: USER };
    } },
    "@/lib/listing-freshness-server": {
      ListingFreshnessError: FreshnessError,
      getListingFreshness: async (id, userId) => {
        calls.push({ kind: "read", id, userId });
        if (options.error) throw options.error;
        return { listing: { id, title: "Own fixture listing", type: "prop", href: `/props/${id}`, published: true }, state, canRenew: true, canEnd: true };
      },
      actOnListingFreshness: async input => {
        calls.push({ kind: "write", input });
        if (options.error) throw options.error;
        return { ok: true, state: { ...state, version: 8, cycle: input.action === "renew" ? 4 : 3 } };
      },
    },
    "@/lib/i18n/locales": locales,
    "@/lib/request-origin": { trustedMutationOrigin },
    "@/lib/rateLimit": { rateLimit: async () => ({ allowed: true }) },
  });
  return { route, calls };
}
const params = () => ({ params: Promise.resolve({ id: ID }) });
const actionBody = { action: "renew", version: 7, cycle: 3, requestId: REQUEST_ID, locale: "cs" };

test("provider GET stays read-only even when an email URL preselects an action", async () => {
  const f = providerFixture();
  const response = await f.route.GET(request(`/api/listing-freshness/${ID}?action=end`), params());
  assert.equal(response.status, 200); noStore(response);
  assert.equal((await response.json()).listing.id, ID);
  assert.deepEqual(f.calls, [{ kind: "auth" }, { kind: "read", id: ID, userId: USER }]);
});

test("provider POST forwards the exact idempotency key, cycle and version with the authenticated actor", async () => {
  const f = providerFixture();
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await f.route.POST(request(`/api/listing-freshness/${ID}`, "POST", { ...actionBody, userId: "untrusted-other-account" }), params());
    assert.equal(response.status, 200); noStore(response);
    assert.equal((await response.json()).ok, true);
  }
  const writes = f.calls.filter(call => call.kind === "write");
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[0].input, { id: ID, userId: USER, ...actionBody });
  assert.deepEqual(writes[1].input, writes[0].input);
});

test("signed-out provider reads and writes stop before the private service and remain non-cacheable", async () => {
  for (const method of ["GET", "POST"]) {
    const f = providerFixture({ denied: true });
    const response = await f.route[method](request(`/api/listing-freshness/${ID}`, method, method === "POST" ? actionBody : undefined), params());
    assert.equal(response.status, 401); noStore(response);
    assert.deepEqual(f.calls, [{ kind: "auth" }]);
  }
});

test("provider permission and stale-state errors do not disclose private service exceptions or become redirects", async () => {
  for (const [code, status] of [["missing", 404], ["stale", 409], ["restricted", 409], ["unavailable", 503]]) {
    const error = new FreshnessError(code, status);
    error.message = "PRIVATE_SERVICE_EXCEPTION";
    const f = providerFixture({ error });
    const response = await f.route.POST(request(`/api/listing-freshness/${ID}`, "POST", actionBody), params());
    assert.equal(response.status, status); noStore(response);
    assert.doesNotMatch(JSON.stringify(await response.json()), /PRIVATE_|Own fixture listing/);
  }
  const unavailable = providerFixture({ error: new Error("PRIVATE_SERVICE_EXCEPTION") });
  const response = await unavailable.route.GET(request(`/api/listing-freshness/${ID}`), params());
  assert.equal(response.status, 503); noStore(response);
  assert.deepEqual(await response.json(), { code: "unavailable" });
});

test("provider writes reject hostile origins and malformed action bodies before invoking the mutation service", async () => {
  const origin = providerFixture();
  const denied = await origin.route.POST(request(`/api/listing-freshness/${ID}`, "POST", actionBody, { Origin: "https://foreign.invalid", Referer: "https://cinegenius.co/dashboard" }), params());
  assert.equal(denied.status, 403); noStore(denied);
  assert.equal(origin.calls.some(call => call.kind === "write"), false);
  const invalid = [null, [], {}, ...[{ action: "pause" }, { version: -1 }, { version: 1.5 }, { version: "7" }, { cycle: -1 }, { cycle: "3" }, { requestId: null }, { locale: "xx" }].map(value => ({ ...actionBody, ...value }))];
  for (const body of invalid) {
    const f = providerFixture();
    const response = await f.route.POST(request(`/api/listing-freshness/${ID}`, "POST", body), params());
    assert.equal(response.status, 400, JSON.stringify(body)); noStore(response);
    assert.equal(f.calls.some(call => call.kind === "write"), false);
  }
  const malformed = providerFixture();
  const response = await malformed.route.POST(new NextRequest(`https://cinegenius.co/api/listing-freshness/${ID}`, { method: "POST", headers: { Origin: "https://cinegenius.co", "Content-Type": "application/json" }, body: "{" }), params());
  assert.equal(response.status, 400); noStore(response);
  assert.equal(malformed.calls.some(call => call.kind === "write"), false);
});

function mineFixture(options = {}) {
  const calls = [];
  const listings = [
    { id: ID, user_id: USER, company_id: null, title: "Own fixture listing", created_at: "2026-11-01", responsible_person: { firstName: "Own", lastName: "Fixture" } },
    { id: SECOND_ID, user_id: "technical-creator", company_id: COMPANY_ID, title: "Editable company fixture", created_at: "2026-11-02" },
    { id: FOREIGN_ID, user_id: USER, company_id: "foreign-company", title: "Must remain private", created_at: "2026-11-03" },
  ];
  const db = { from: table => query(table, calls, call => {
    let data;
    if (table === "listings") data = listings;
    else if (table === "listing_freshness_state") {
      if (options.freshnessError) return { data: null, error: { code: options.freshnessError }, count: null };
      data = listings.map(row => ({ listing_id: row.id, status: "active", due_at: "2027-01-01T12:00:00Z", response_deadline_at: null }));
    }
    else throw new Error(`Unexpected table: ${table}`);
    for (const [method, field, value] of call.operations) {
      if (method === "eq") data = data.filter(row => row[field] === value);
      if (method === "in") data = data.filter(row => value.includes(row[field]));
    }
    return { data, error: null, count: data.length };
  }) };
  const auth = async () => options.denied ? NextResponse.json({ code: "account" }, { status: 401 }) : { userId: USER };
  const route = load("../app/api/listings/route.ts", {
    "next/server": { NextRequest, NextResponse }, "@/lib/db": { db }, "@/lib/auth": { requireAuth: auth },
    "@/lib/listing-access": { editableCompanyIdsForUser: async user => { assert.equal(user, USER); return [COMPANY_ID]; } },
    "@/lib/places/catalog": { placeReadFields: () => ({}) },
    "@/lib/marketplaceCategories": { DEPARTMENTS: [] }, "@/lib/marketplace-offer": {},
    "@/lib/offer-moderation": { OFFER_MODERATION_COLUMNS: "moderation_status" },
    "next-intl/server": { getTranslations: async () => key => key, getLocale: async () => "de" },
    "@/lib/responsible-person": { bindResponsiblePerson: () => { throw new Error("No identity fallback is needed in this fixture"); } },
    "@/lib/responsible-person-server": { accountResponsiblePerson: () => { throw new Error("No private identity read is needed in this fixture"); } },
    "@/lib/listing-price": { listingPriceLabel: () => "Own price" }, "@/lib/rateLimit": {}, "next/cache": {}, "@/lib/listing-image-gallery": {},
  });
  return { route, calls };
}

const validSetting = { listing_type: "prop", enabled: true, initial_days: 90, followup_days: 7, response_days: 14 };
function adminFixture(options = {}) {
  const calls = [];
  const settings = [{ ...validSetting, updated_by: "PRIVATE_AUDIT_FIELD" }];
  const rows = [
    { id: "event-one", listing_id: ID, status: "active", confirmed_at: "2026-11-01", due_at: "2027-01-01", response_deadline_at: null,
      action: "renewed", actor_user_id: USER, created_at: "2026-11-01", updated_at: "2026-11-01", reason: "Own test reason", metadata: { email: "PRIVATE_EMAIL_FIELD" }, frozen_payload: "PRIVATE_PAYLOAD_FIELD" },
    { id: "event-settings", listing_id: null, action: "settings_updated", created_at: "2026-11-01", reason: { email: "PRIVATE_NESTED_REASON" } },
  ];
  const db = {
    from: table => query(table, calls, () => {
      if (options.failTable === table) return { data: null, error: { message: "PRIVATE_DATABASE_EXCEPTION" }, count: null };
      if (table === "listing_freshness_settings") return { data: settings, error: null };
      if (["listing_freshness_state", "listing_freshness_events"].includes(table)) return { data: rows, error: null, count: options.missingCount ? null : 76 };
      if (table === "listings") return { data: [{ id: ID, title: "Own admin listing", type: "prop", private_note: "PRIVATE_LISTING_FIELD" }], error: null };
      throw new Error(`Unexpected admin table: ${table}`);
    }),
    rpc: async (name, args) => {
      calls.push({ kind: "rpc", name, args });
      return options.rpcResult ?? { data: { status: "saved", settings: args.p_settings }, error: null };
    },
  };
  const route = load("../app/api/admin/listing-freshness/route.ts", {
    "next/server": { NextRequest, NextResponse }, "@/lib/db": { db },
    "@/lib/auth": { requireAdmin: async () => {
      calls.push({ kind: "auth" });
      return options.denied ? NextResponse.json({ code: "account" }, { status: options.denied }) : { userId: USER };
    } },
    "@/lib/request-origin": { trustedMutationOrigin },
    "@/lib/listing-freshness-cron-auth": { listingFreshnessSchedulerEnabled: () => false },
    "@/lib/rateLimit": { rateLimit: async (key, limit, window) => {
      calls.push({ kind: "rate", key, limit, window });
      return { allowed: !options.rateDenied };
    } },
    "@/lib/listing-freshness-diagnostics": {
      RESEND_MESSAGE_ID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      checkListingFreshnessReadAccess: async (userId, messageId) => {
        calls.push({ kind: "read-check", userId, messageId });
        if (options.readThrows) throw new Error("PRIVATE_PROVIDER_ERROR");
        return options.readStatus ?? "readable";
      },
    },
  });
  return { route, calls };
}

test("admin authentication rejects reads and writes before any database access", async () => {
  for (const denied of [401, 403]) for (const method of ["GET", "PUT", "POST"]) {
    const f = adminFixture({ denied });
    const response = await f.route[method](request("/api/admin/listing-freshness", method, method === "PUT" ? { settings: [validSetting], reason: "Own reason" } : undefined));
    assert.equal(response.status, denied); noStore(response);
    assert.deepEqual(f.calls, [{ kind: "auth" }]);
  }
});

test("admin status pagination and type filter constrain the counted parent query without exposing private columns", async () => {
  const f = adminFixture();
  const response = await f.route.GET(request("/api/admin/listing-freshness?view=status&type=prop&page=3"));
  assert.equal(response.status, 200); noStore(response);
  const body = await response.json();
  assert.equal(body.page, 3); assert.equal(body.pageSize, 25); assert.equal(body.total, 76); assert.equal(body.schedulerEnabled, false);
  assert.deepEqual(body.settings, [validSetting]);
  assert.deepEqual(body.items[0].listing, { title: "Own admin listing", type: "prop" });
  assert.doesNotMatch(JSON.stringify(body), /PRIVATE_/);
  const status = f.calls.find(call => call.table === "listing_freshness_state");
  assert.deepEqual(status.operations.find(operation => operation[0] === "range"), ["range", 50, 74]);
  assert.deepEqual(status.operations.find(operation => operation[0] === "select")[2], { count: "exact" });
  assert.ok(status.operations.some(operation => JSON.stringify(operation) === JSON.stringify(["eq", "type_match.type", "prop"])));
  assert.ok(status.operations.some(operation => JSON.stringify(operation) === JSON.stringify(["not", "type_match", "is", null])));
  assert.equal(f.calls.filter(call => call.table === "listings").length, 1);
  assert.equal(f.calls.some(call => call.kind === "rpc"), false);
});

test("admin event type filtering includes settings events and malformed reason objects never become private text", async () => {
  const f = adminFixture();
  const response = await f.route.GET(request("/api/admin/listing-freshness?view=events&type=prop"));
  assert.equal(response.status, 200); noStore(response);
  const body = await response.json();
  assert.deepEqual(body.items[0].metadata, { reason: "Own test reason" });
  assert.deepEqual(body.items[1].metadata, {});
  assert.equal(body.items[1].listing_id, null);
  assert.doesNotMatch(JSON.stringify(body), /PRIVATE_/);
  const eventQuery = f.calls.find(call => call.table === "listing_freshness_events");
  assert.match(eventQuery.operations.find(operation => operation[0] === "select")[1], /reason:metadata->reason/);
  assert.ok(eventQuery.operations.some(operation => JSON.stringify(operation) === JSON.stringify(["or", "type_match.not.is.null,metadata->>listing_type.eq.prop"])));
  assert.deepEqual(f.calls.find(call => call.table === "listings").operations.find(operation => operation[0] === "in"), ["in", "id", [ID]]);
});

test("admin invalid pages, views and types stop before database queries", async () => {
  for (const search of ["page=0", "page=1.5", "page=Infinity", "page=100001", "view=private", "type=prop,foreign"]) {
    const f = adminFixture();
    const response = await f.route.GET(request(`/api/admin/listing-freshness?${search}`));
    assert.equal(response.status, 400); noStore(response);
    assert.deepEqual(f.calls, [{ kind: "auth" }]);
  }
});

test("admin valid settings are normalized and passed once to the atomic batch writer with the authenticated actor", async () => {
  for (const length of [5, 500]) {
    const f = adminFixture();
    const response = await f.route.PUT(request("/api/admin/listing-freshness", "PUT", {
      settings: [{ ...validSetting, updated_by: "untrusted-actor" }], reason: `  ${"x".repeat(length)}  `, actor: "untrusted-actor",
    }));
    assert.equal(response.status, 200); noStore(response);
    assert.deepEqual(await response.json(), { settings: [validSetting] });
    assert.deepEqual(f.calls.filter(call => call.kind === "rpc"), [{ kind: "rpc", name: "configure_listing_freshness_batch", args: { p_settings: [validSetting], p_actor: USER, p_reason: "x".repeat(length) } }]);
  }
});

test("admin rejects all invalid settings and reason lengths before any partial batch can be written", async () => {
  const valid = { settings: [validSetting], reason: "Own reason" };
  const invalid = [null, {}, { ...valid, settings: [] }, { ...valid, settings: Array(6).fill(validSetting) },
    { ...valid, settings: [validSetting, validSetting] }, ...["", "    ", "four", "x".repeat(501)].map(reason => ({ ...valid, reason })),
    ...[{ listing_type: "creator" }, { enabled: "true" }, { initial_days: 0 }, { initial_days: 3651 }, { initial_days: 1.5 },
      { followup_days: 731 }, { response_days: 731 }, { response_days: "14" }].map(change => ({ ...valid, settings: [validSetting, { ...validSetting, listing_type: "job", ...change }] })),
  ];
  for (const body of invalid) {
    const f = adminFixture();
    const response = await f.route.PUT(request("/api/admin/listing-freshness", "PUT", body));
    assert.equal(response.status, 400, JSON.stringify(body)); noStore(response);
    assert.equal(f.calls.some(call => call.kind === "rpc" || call.table), false);
  }
});

test("admin mutations reject foreign origins even when a trusted referer is supplied", async () => {
  const f = adminFixture();
  const response = await f.route.PUT(request("/api/admin/listing-freshness", "PUT", { settings: [validSetting], reason: "Own reason" }, { Origin: "https://foreign.invalid", Referer: "https://cinegenius.co/admin" }));
  assert.equal(response.status, 403); noStore(response);
  assert.equal(f.calls.some(call => call.kind === "rpc" || call.table), false);
});

test("admin database failures, missing counts and writer conflicts fail privately without exposing service details", async () => {
  for (const options of [{ failTable: "listing_freshness_settings" }, { failTable: "listing_freshness_state" }, { failTable: "listings" }, { missingCount: true }]) {
    const f = adminFixture(options);
    const response = await f.route.GET(request("/api/admin/listing-freshness"));
    assert.equal(response.status, 503); noStore(response);
    assert.doesNotMatch(JSON.stringify(await response.json()), /PRIVATE_/);
  }
  for (const [rpcResult, status] of [[{ data: null, error: { code: "PT409", message: "PRIVATE_DATABASE_EXCEPTION" } }, 409], [{ data: null, error: { code: "XX000", message: "PRIVATE_DATABASE_EXCEPTION" } }, 503], [{ data: { status: "invalid" }, error: null }, 400]]) {
    const f = adminFixture({ rpcResult });
    const response = await f.route.PUT(request("/api/admin/listing-freshness", "PUT", { settings: [validSetting], reason: "Own reason" }));
    assert.equal(response.status, status); noStore(response);
    assert.doesNotMatch(JSON.stringify(await response.json()), /PRIVATE_/);
  }
});

test("mine freshness is queried only for owned or editable-company listings and foreign company data stays private", async () => {
  const f = mineFixture();
  const response = await f.route.GET(request("/api/listings?mine=true"));
  assert.equal(response.status, 200); noStore(response);
  const { data } = await response.json();
  assert.deepEqual(data.map(row => row.id).sort(), [ID, SECOND_ID]);
  assert.equal(JSON.stringify(data).includes("Must remain private"), false);
  assert.ok(data.every(row => row.freshness?.status === "active"));
  const freshnessReads = f.calls.filter(call => call.table === "listing_freshness_state");
  assert.equal(freshnessReads.length, 1);
  const selected = freshnessReads[0].operations.find(operation => operation[0] === "in");
  assert.equal(selected[1], "listing_id");
  assert.deepEqual([...selected[2]].sort(), [ID, SECOND_ID]);
  const columns = freshnessReads[0].operations.find(operation => operation[0] === "select")[1].split(",").map(value => value.trim());
  assert.ok(columns.every(value => ["listing_id", "status", "due_at", "response_deadline_at", "confirmed_at"].includes(value)));
  assert.equal(data.some(row => row.freshness?.provider_user_id || row.freshness?.frozen_payload), false);
});

test("mine keeps existing owned listings usable when the optional freshness table is not installed yet", async () => {
  for (const freshnessError of ["42P01", "PGRST205"]) {
    const f = mineFixture({ freshnessError });
    const response = await f.route.GET(request("/api/listings?mine=true"));
    assert.equal(response.status, 200); noStore(response);
    const { data } = await response.json();
    assert.deepEqual(data.map(row => row.id).sort(), [ID, SECOND_ID]);
    assert.ok(data.every(row => row.freshness === null));
  }
});

test("signed-out mine requests read no listing or freshness rows and are not cacheable", async () => {
  const f = mineFixture({ denied: true });
  const response = await f.route.GET(request("/api/listings?mine=true"));
  assert.equal(response.status, 401); noStore(response);
  assert.deepEqual(f.calls, []);
});

test("public listing requests never query private freshness rows", async () => {
  const f = mineFixture();
  const response = await f.route.GET(request("/api/listings"));
  assert.equal(response.status, 200);
  assert.equal(f.calls.some(call => call.table === "listing_freshness_state"), false);
  assert.equal(JSON.stringify(await response.json()).includes("freshness"), false);
});

const readCheckBody = { action: "check_delivery_access", ownTestEmail: true, messageId: ID };
test("admin delivery diagnostic rejects foreign origins and malformed requests before its bounded provider read", async () => {
  for (const body of [{ ...readCheckBody, messageId: "not-a-uuid" }, { ...readCheckBody, ownTestEmail: false }, { ...readCheckBody, action: "send" }]) {
    const f = adminFixture();
    const response = await f.route.POST(request("/api/admin/listing-freshness", "POST", body));
    assert.equal(response.status, 400); noStore(response);
    assert.deepEqual(f.calls, [{ kind: "auth" }]);
  }
  const f = adminFixture();
  const response = await f.route.POST(request("/api/admin/listing-freshness", "POST", readCheckBody, { origin: "https://foreign.invalid" }));
  assert.equal(response.status, 403); noStore(response);
  assert.deepEqual(f.calls, [{ kind: "auth" }]);
});
test("admin delivery diagnostic limits frequency and never writes settings or listings", async () => {
  const limited = adminFixture({ rateDenied: true });
  const denied = await limited.route.POST(request("/api/admin/listing-freshness", "POST", readCheckBody));
  assert.equal(denied.status, 429); noStore(denied);
  assert.equal(limited.calls.some(call => call.kind === "read-check"), false);
  const f = adminFixture();
  const response = await f.route.POST(request("/api/admin/listing-freshness", "POST", readCheckBody));
  assert.equal(response.status, 200); noStore(response);
  assert.deepEqual(await response.json(), { status: "readable" });
  assert.deepEqual(f.calls, [{ kind: "auth" }, { kind: "rate", key: `listing-freshness-read-check:${USER}`, limit: 1, window: 60 }, { kind: "read-check", userId: USER, messageId: ID }]);
});
test("admin delivery diagnostic returns only fixed error codes and ordinary GET never calls it", async () => {
  const failed = adminFixture({ readThrows: true });
  const response = await failed.route.POST(request("/api/admin/listing-freshness", "POST", readCheckBody));
  assert.equal(response.status, 503); noStore(response);
  assert.deepEqual(await response.json(), { code: "unavailable" });
  const f = adminFixture();
  await f.route.GET(request("/api/admin/listing-freshness"));
  assert.equal(f.calls.some(call => call.kind === "read-check" || call.kind === "rate"), false);
});
