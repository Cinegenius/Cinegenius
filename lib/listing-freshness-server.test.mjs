import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
import * as locales from "./i18n/locales.ts";
import * as cronAuth from "./listing-freshness-cron-auth.ts";
import { listingDetailPath } from "./listing-routes.ts";

const ID = "11111111-1111-4111-8111-111111111111";
const SECOND_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";
function load(path, dependencies) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", source)(name => {
    assert.ok(Object.hasOwn(dependencies, name), `unmocked dependency ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}

function fixture(options = {}) {
  const events = [];
  const claim = {
    outbox_id: "own-outbox", listing_id: ID, title: "Own listing", type: "location", cycle: 1, stage: "initial",
    claim_token: "own-claim", lease_until: new Date(Date.now() + 300_000).toISOString(), provider_user_id: "own-provider",
    provider_company_id: "own-company", content_revision: 3, frozen_payload: null, idempotency_key: "own-stable-key",
    first_attempt_at: null, grace_days: 7, provider_locale: null, ...options.claim,
  };
  const listing = { id: ID, user_id: "technical-creator", company_id: "own-company", published: true, moderation_status: "approved", content_revision: 3, ...options.listing };
  const member = { firstName: null, primaryEmailAddressId: "verified-primary", privateMetadata: { cinegeniusLocale: "it" },
    emailAddresses: [{ id: "verified-primary", emailAddress: "provider@example.invalid", verification: { status: "verified" } }], ...options.member };
  const stored = new Map();
  const db = {
    from(table) {
      const query = { select: () => query, eq: () => query, maybeSingle: async () => {
        events.push({ kind: "read", table });
        if (table === "listings") return { data: listing, error: options.listingError ?? null };
        assert.equal(table, "companies");
        return { data: Object.hasOwn(options, "company") ? options.company : { owner_user_id: "own-provider" }, error: null };
      } };
      return query;
    },
    async rpc(name, args) {
      events.push({ kind: "rpc", name, args: structuredClone(args) });
      if (name === "claim_listing_freshness_reminders") return { data: options.claims ?? [claim], error: options.claimError ?? null };
      if (name === "bind_listing_freshness_delivery") {
        if (options.bind) return options.bind;
        const first = claim.first_attempt_at ?? new Date().toISOString();
        if (!stored.has(args.p_outbox_id)) stored.set(args.p_outbox_id, structuredClone(args.p_payload));
        const selected = (options.claims ?? [claim]).find(row => row.outbox_id === args.p_outbox_id);
        return { data: { status: "bound", frozen_payload: stored.get(args.p_outbox_id), idempotency_key: selected.idempotency_key, first_attempt_at: first }, error: null };
      }
      if (name === "finish_listing_freshness_delivery") return { data: { status: args.p_outcome }, error: options.finishError ?? null };
      if (name === "get_listing_freshness_delivery_checks") return { data: options.deliveryChecks ?? [], error: options.deliveryChecksError ?? null };
      if (name === "record_listing_freshness_delivery_check") return { data: { status: options.recordDeliveryStatus ?? args.p_delivery_status }, error: options.recordDeliveryError ?? null };
      if (name === "get_listing_freshness") return options.getResult ?? { data: { status: "ok", listing: { ...listing, type: "location", title: "Own listing" }, state: { version: 4, cycle: 2 }, canRenew: true, canEnd: true }, error: null };
      if (name === "listing_freshness_transition") return options.actionResult ?? { data: { status: "saved", state: { version: 5, cycle: 3 } }, error: null };
      throw new Error(`unexpected RPC ${name}`);
    },
  };
  const mail = load("./listing-freshness-email.ts", {
    "server-only": {}, "@/lib/i18n/locales": locales,
    "resend": { Resend: class { constructor() { throw new Error("A worker test must never create a real mail client"); } } },
    "next-intl/server": { getTranslations: async () => (key, values = {}) => `${key} ${Object.values(values).join(" ")}` },
  });
  const server = load("./listing-freshness-server.ts", {
    "server-only": {}, "node:crypto": { randomUUID: () => REQUEST_ID },
    "@clerk/nextjs/server": { clerkClient: async () => ({ users: { getUser: async id => {
      events.push({ kind: "clerk", id });
      if (options.clerkError) throw options.clerkError;
      return member;
    } } }) },
    "next/cache": { revalidateTag: (...args) => events.push({ kind: "tag", args }), revalidatePath: (...args) => events.push({ kind: "path", args }) },
    "@/lib/db": { db }, "@/lib/i18n/locales": locales, "@/lib/listing-routes": { listingDetailPath },
    "@/lib/listing-freshness-cron-auth": cronAuth,
    "@/lib/listing-freshness-email": { ...mail, sendListingReminderEmail: async (payload, key) => {
      events.push({ kind: "send", payload: structuredClone(payload), key });
      return options.sendResult ?? { ok: true, id: "fake-message-id" };
    }, getListingReminderDeliveryStatus: async (id, recipient) => {
      events.push({ kind: "delivery-read", id, recipient });
      return options.deliveryOutcome ?? "unavailable";
    } },
  });
  return { ...server, mail, claim, events, sends: () => events.filter(event => event.kind === "send"), finishes: () => events.filter(event => event.name === "finish_listing_freshness_delivery") };
}

async function environment(values, run) {
  const keys = ["VERCEL_ENV", "LISTING_FRESHNESS_ENABLED", "RESEND_API_KEY", "CRON_SECRET"];
  const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try { await run(); } finally {
    for (const key of keys) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  }
}
const enabled = { VERCEL_ENV: "production", LISTING_FRESHNESS_ENABLED: "true", RESEND_API_KEY: "fake-key-never-sent" };
const deliveryCheck = { outbox_id: "own-outbox", provider_message_id: "fake-delivery", provider_user_id: "own-provider", recipient: "provider@example.invalid", delivery_checked_at: null };

test("delivery confirmation rechecks the verified recipient and records the exact observation without sending", async () => {
  await environment(enabled, async () => {
    const f = fixture({ claims: [], deliveryChecks: [deliveryCheck], deliveryOutcome: "delivered" });
    await f.runListingFreshnessWorker();
    assert.equal(f.sends().length, 0);
    assert.deepEqual(f.events.filter(event => event.kind === "delivery-read"), [{ kind: "delivery-read", id: "fake-delivery", recipient: "provider@example.invalid" }]);
    const recorded = f.events.find(event => event.name === "record_listing_freshness_delivery_check");
    assert.deepEqual(recorded.args, { p_outbox_id: "own-outbox", p_provider_message_id: "fake-delivery", p_expected_checked_at: null, p_delivery_status: "delivered" });
    assert.ok(f.events.findIndex(event => event.kind === "clerk") < f.events.findIndex(event => event.kind === "delivery-read"));
  });
});

test("delivery checks fail closed for changed recipients, unverified accounts and identity errors", async () => {
  await environment(enabled, async () => {
    for (const [options, expected] of [
      [{ member: { primaryEmailAddressId: "missing" } }, "recipient_changed"],
      [{ member: { emailAddresses: [{ id: "verified-primary", emailAddress: "changed@example.invalid", verification: { status: "verified" } }] } }, "recipient_changed"],
      [{ member: { emailAddresses: [{ id: "verified-primary", emailAddress: "provider@example.invalid", verification: { status: "unverified" } }] } }, "recipient_changed"],
      [{ clerkError: new Error("fake lookup failure") }, "unavailable"],
    ]) {
      const f = fixture({ claims: [], deliveryChecks: [deliveryCheck], ...options });
      await f.runListingFreshnessWorker();
      assert.equal(f.sends().length, 0);
      assert.equal(f.events.some(event => event.kind === "delivery-read"), false);
      assert.equal(f.events.find(event => event.name === "record_listing_freshness_delivery_check").args.p_delivery_status, expected);
    }
  });
});

test("bounced or unavailable messages are recorded honestly; only an atomic paused result invalidates after recording", async () => {
  await environment(enabled, async () => {
    for (const outcome of ["bounced", "pending", "unavailable", "delivered"]) {
      const f = fixture({ claims: [], deliveryChecks: [deliveryCheck], deliveryOutcome: outcome, recordDeliveryStatus: outcome === "delivered" ? "paused" : "not_delivered" });
      await f.runListingFreshnessWorker();
      const index = f.events.findIndex(event => event.name === "record_listing_freshness_delivery_check");
      assert.equal(f.events[index].args.p_delivery_status, outcome);
      assert.equal(f.events.slice(index + 1).some(event => event.kind === "tag"), outcome === "delivered");
      assert.equal(f.sends().length, 0);
    }
  });
});

test("disabled and unconfigured workers perform no database or identity operations", async () => {
  for (const values of [{}, { ...enabled, VERCEL_ENV: "preview" }, { ...enabled, LISTING_FRESHNESS_ENABLED: "false" }, { ...enabled, RESEND_API_KEY: undefined }]) {
    await environment(values, async () => {
      const f = fixture(); const result = await f.runListingFreshnessWorker();
      assert.equal(result.status, values.RESEND_API_KEY === undefined && values.VERCEL_ENV === "production" ? "not_configured" : "disabled");
      assert.deepEqual(f.events, []);
    });
  }
});

test("the actual company owner receives a frozen message, bound before sending and recorded only after acceptance", async () => {
  await environment(enabled, async () => {
    const f = fixture(); const result = await f.runListingFreshnessWorker({ limit: 100 });
    assert.equal(result.sent, 1);
    assert.equal(f.events[0].args.p_limit, 10);
    assert.deepEqual(f.events.filter(event => event.kind === "clerk").map(event => event.id), ["own-provider"]);
    assert.equal(f.sends()[0].payload.to, "provider@example.invalid");
    assert.equal(f.sends()[0].payload.locale, "it");
    assert.match(f.sends()[0].payload.text, /greetingNeutral/);
    assert.ok(f.events.findIndex(event => event.name === "bind_listing_freshness_delivery") < f.events.findIndex(event => event.kind === "send"));
    assert.ok(f.events.findIndex(event => event.kind === "send") < f.events.findIndex(event => event.name === "finish_listing_freshness_delivery"));
    assert.equal(f.finishes()[0].args.p_provider_message_id, "fake-message-id");
    assert.equal(f.finishes()[0].args.p_outcome, "sent");
  });
});

test("personal listings stay separate even when the same account owns both", async () => {
  await environment(enabled, async () => {
    const base = fixture({ claim: { provider_company_id: null }, listing: { company_id: null, user_id: "own-provider" } });
    const f = fixture({ claims: [base.claim, { ...base.claim, outbox_id: "second-outbox", idempotency_key: "second-stable-key", listing_id: SECOND_ID, title: "Second listing" }], listing: { company_id: null, user_id: "own-provider" } });
    const result = await f.runListingFreshnessWorker();
    assert.equal(result.sent, 2);
    assert.notEqual(f.sends()[0].key, f.sends()[1].key);
    assert.ok(f.sends()[0].payload.html.includes(`/listing-status/${ID}`));
    assert.ok(f.sends()[1].payload.html.includes(`/listing-status/${SECOND_ID}`));
    assert.equal(f.events.some(event => event.table === "companies"), false);
  });
});

test("missing company owners, provider changes, hidden offers and revised content cannot send", async () => {
  await environment(enabled, async () => {
    for (const options of [{ company: null }, { company: { owner_user_id: "different-owner" } }, { listing: { content_revision: 4 } }, { listing: { published: false } }, { listing: { moderation_status: "hidden" } }]) {
      const f = fixture(options); await f.runListingFreshnessWorker();
      assert.equal(f.sends().length, 0);
      assert.equal(f.events.some(event => event.kind === "clerk"), false);
      assert.equal(f.finishes()[0].args.p_outcome, "skipped");
    }
  });
});

test("only a verified primary address is eligible; identity failures do not create a response deadline", async () => {
  await environment(enabled, async () => {
    const unverified = fixture({ member: { primaryEmailAddressId: "unverified", emailAddresses: [{ id: "unverified", emailAddress: "provider@example.invalid", verification: { status: "unverified" } }, { id: "secondary", emailAddress: "other@example.invalid", verification: { status: "verified" } }] } });
    await unverified.runListingFreshnessWorker();
    assert.equal(unverified.sends().length, 0);
    assert.equal(unverified.finishes()[0].args.p_outcome, "skipped");
    const unavailable = fixture({ clerkError: new Error("Simulated provider failure") });
    await unavailable.runListingFreshnessWorker();
    assert.equal(unavailable.sends().length, 0);
    assert.equal(unavailable.finishes()[0].args.p_outcome, "retry");
    const explicitLocale = fixture({ claim: { provider_locale: "hu" } });
    await explicitLocale.runListingFreshnessWorker(); assert.equal(explicitLocale.sends()[0].payload.locale, "hu");
    const defaultLocale = fixture({ member: { privateMetadata: { cinegeniusLocale: "unsupported" } } });
    await defaultLocale.runListingFreshnessWorker(); assert.equal(defaultLocale.sends()[0].payload.locale, "de");
  });
});

test("an ambiguous retry reuses the stored message; expired idempotency or a changed address stop sending", async () => {
  await environment(enabled, async () => {
    const original = fixture();
    const frozen = await original.mail.buildListingReminderEmail({ to: "provider@example.invalid", firstName: null, listingId: ID, title: "Frozen original title", stage: "initial", graceDays: 7, locale: "de" });
    const f = fixture({ claim: { frozen_payload: frozen, first_attempt_at: new Date(Date.now() - 60_000).toISOString() }, sendResult: { ok: false, reason: "provider_error" } });
    await f.runListingFreshnessWorker();
    assert.deepEqual(f.sends()[0].payload, frozen);
    assert.equal(f.sends()[0].key, f.claim.idempotency_key);
    assert.equal(f.finishes()[0].args.p_outcome, "retry");
    assert.equal(f.finishes()[0].args.p_provider_message_id, null);
    const expired = fixture({ claim: { frozen_payload: frozen, first_attempt_at: new Date(Date.now() - 23 * 60 * 60 * 1000 - 1).toISOString() } });
    await expired.runListingFreshnessWorker();
    assert.equal(expired.sends().length, 0); assert.equal(expired.finishes()[0].args.p_outcome, "unknown");
    const changed = fixture({ claim: { frozen_payload: { ...frozen, to: "previous@example.invalid" }, first_attempt_at: new Date().toISOString() } });
    await changed.runListingFreshnessWorker();
    assert.equal(changed.sends().length, 0); assert.equal(changed.finishes()[0].args.p_outcome, "unknown");
    const mismatchedKey = fixture({ bind: { data: { status: "existing", frozen_payload: frozen, idempotency_key: "unexpected-key", first_attempt_at: new Date().toISOString() }, error: null } });
    await mismatchedKey.runListingFreshnessWorker();
    assert.equal(mismatchedKey.sends().length, 0); assert.equal(mismatchedKey.finishes()[0].args.p_outcome, "unknown");
  });
});

test("stale binding and database failures cannot be counted as a successful reminder", async () => {
  await environment(enabled, async () => {
    const stale = fixture({ bind: { data: { status: "stale" }, error: null } });
    await stale.runListingFreshnessWorker(); assert.equal(stale.sends().length, 0);
    const failed = fixture({ finishError: { code: "XX000" } });
    const stats = await failed.runListingFreshnessWorker();
    assert.equal(failed.sends().length, 1); assert.equal(stats.sent, 0); assert.equal(stats.errors, 1);
    assert.equal(failed.finishes().length, 1);
    const claimFailed = fixture({ claimError: { code: "XX000" } });
    await assert.rejects(() => claimFailed.runListingFreshnessWorker(), error => error.status === 503);
    assert.equal(claimFailed.sends().length, 0);
    const onlyMaintenance = fixture({ claims: [] });
    await onlyMaintenance.runListingFreshnessWorker();
    assert.ok(onlyMaintenance.events.some(event => event.kind === "tag" && event.args[0] === "listings"));
  });
});

test("owner actions retain exact versions, cycle, actor, locale and request identity and do not bypass moderation", async () => {
  const f = fixture();
  const state = await f.getListingFreshness(ID, "own-provider");
  assert.equal(state.listing.href, `/locations/${ID}`); assert.equal(state.canRenew, true);
  assert.deepEqual(await f.actOnListingFreshness({ id: ID, userId: "own-provider", action: "renew", version: 4, cycle: 2, requestId: REQUEST_ID, locale: "es" }), { ok: true, state: { version: 5, cycle: 3 } });
  assert.deepEqual(f.events.find(event => event.name === "listing_freshness_transition").args, { p_listing_id: ID, p_actor: "own-provider", p_action: "renew", p_expected_version: 4, p_expected_cycle: 2, p_request_id: REQUEST_ID, p_locale: "es" });
  const held = fixture({ listing: { published: false, moderation_status: "hidden" } });
  assert.equal((await held.getListingFreshness(ID, "own-provider")).canRenew, false);
  const unenrolled = fixture({ getResult: { data: { status: "ok", listing: { id: ID, type: "location", title: "Own listing", published: true, moderation_status: "approved" }, state: null, canRenew: true, canEnd: true }, error: null } });
  const empty = await unenrolled.getListingFreshness(ID, "own-provider");
  assert.equal(empty.canRenew, false); assert.equal(empty.canEnd, false);
  for (const [status, http] of [["forbidden", 404], ["stale", 409], ["restricted", 409], ["invalid", 400]]) {
    const rejected = fixture({ actionResult: { data: { status }, error: null } });
    await assert.rejects(() => rejected.actOnListingFreshness({ id: ID, userId: "outsider", action: "renew", version: 4, cycle: 2, requestId: REQUEST_ID }), error => error.status === http);
    assert.equal(rejected.events.some(event => event.kind === "tag"), false);
  }
});

test("cron HTTP requests require the exact secret before calling the worker; HEAD cannot run it", async () => {
  let calls = 0;
  const route = load("../app/api/cron/listing-freshness/route.ts", {
    "next/server": { NextRequest, NextResponse }, "@/lib/listing-freshness-cron-auth": cronAuth,
    "@/lib/listing-freshness-server": { runListingFreshnessWorker: async () => { calls += 1; return { status: "disabled" }; } },
  });
  await environment({}, async () => {
    const response = await route.GET(new NextRequest("https://cinegenius.co/api/cron/listing-freshness", { headers: { authorization: "Bearer undefined" } }));
    assert.equal(response.status, 401); assert.equal(calls, 0);
  });
  await environment({ CRON_SECRET: "own-test-secret" }, async () => {
    for (const authorization of ["", "Bearer wrong", "bearer own-test-secret"]) {
      const response = await route.GET(new NextRequest("https://cinegenius.co/api/cron/listing-freshness", { headers: { authorization } }));
      assert.equal(response.status, 401); assert.match(response.headers.get("cache-control"), /no-store/);
    }
    assert.equal(calls, 0); assert.equal(route.HEAD().status, 405); assert.equal(calls, 0);
    const response = await route.GET(new NextRequest("https://cinegenius.co/api/cron/listing-freshness", { headers: { authorization: "Bearer own-test-secret" } }));
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { status: "disabled" }); assert.equal(calls, 1);
  });
});
