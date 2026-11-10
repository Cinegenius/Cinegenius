import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createTranslator } from "use-intl/core";
import * as locales from "./i18n/locales.ts";
import { authorizedListingFreshnessCron, listingFreshnessSchedulerEnabled } from "./listing-freshness-cron-auth.ts";

function emailFixture(result = { data: { id: "fake-provider-email" }, error: null }) {
  const sent = [];
  const reads = [];
  class FakeResend {
    constructor(key) {
      assert.equal(key, "re_fake_listing_freshness_test");
      this.emails = { send: async (payload, options) => {
        sent.push(structuredClone({ payload, options }));
        if (result instanceof Error) throw result;
        return result;
      }, get: async (id, options) => {
        reads.push({ id, hasTimeout: options?.signal instanceof AbortSignal });
        if (result instanceof Error) throw result;
        return result;
      } };
    }
  }
  const dependencies = {
    "server-only": {},
    "resend": { Resend: FakeResend },
    "@/lib/i18n/locales": locales,
    "next-intl/server": { getTranslations: async ({ locale, namespace }) => {
      assert.equal(namespace, "ListingFreshness.email");
      const copy = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8")).ListingFreshness.email;
      return createTranslator({ locale, messages: copy, onError: error => { throw error; } });
    } },
  };
  const compiled = ts.transpileModule(readFileSync(new URL("./listing-freshness-email.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `unmocked email dependency ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return { ...module.exports, sent, reads };
}

async function withFakeKey(run, configured = true) {
  const previous = process.env.RESEND_API_KEY;
  if (configured) process.env.RESEND_API_KEY = "re_fake_listing_freshness_test";
  else delete process.env.RESEND_API_KEY;
  try { await run(); }
  finally {
    if (previous === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previous;
  }
}

const input = {
  to: "provider@example.invalid", firstName: null,
  listingId: "11111111-1111-4111-8111-111111111111",
  title: "Own studio <script>alert(1)</script> & workshop",
  stage: "initial", graceDays: 7, locale: "de",
};

test("listing reminder emails render both stages in all six languages without implying a one-click state change", async () => {
  const mail = emailFixture();
  for (const locale of locales.SUPPORTED_LOCALES) {
    const copy = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8")).ListingFreshness.email;
    for (const stage of ["initial", "followup"]) {
      const payload = await mail.buildListingReminderEmail({ ...input, locale, stage });
      assert.equal(payload.locale, locale);
      assert.equal(payload.to, input.to);
        assert.equal(payload.replyTo, "cinegenius.co@gmail.com");
      assert.match(payload.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; workshop/);
      assert.doesNotMatch(payload.html, /<script>/);
      assert.match(payload.html, new RegExp(`https://cinegenius.co/listing-status/${input.listingId}`));
      assert.ok(payload.text.includes(copy.greetingNeutral));
      assert.ok(payload.text.includes(copy.privateLinkNote));
      assert.ok(payload.text.includes(copy.signature));
      assert.equal(payload.text.includes(copy.followupConsequence), stage === "followup");
      assert.doesNotMatch(payload.text, /\{(?:title|name|days|date)[,}]/);
      assert.equal(mail.isFrozenListingReminderEmail(payload), true);
    }
  }
  assert.equal(mail.sent.length, 0);
});

test("frozen listing reminder retries retain the exact provider payload and idempotency key", async () => {
  await withFakeKey(async () => {
    const mail = emailFixture();
    const payload = await mail.buildListingReminderEmail({ ...input, firstName: 'A < B & "C"', stage: "followup" });
    const frozen = structuredClone(payload);
    const key = "listing-freshness:own-listing:cycle-2:followup";
    assert.deepEqual(await mail.sendListingReminderEmail(payload, key), { ok: true, id: "fake-provider-email" });
    assert.deepEqual(await mail.sendListingReminderEmail(payload, key), { ok: true, id: "fake-provider-email" });
    assert.deepEqual(mail.sent[0], mail.sent[1]);
    assert.deepEqual(payload, frozen);
    assert.equal(mail.sent[0].options.idempotencyKey, key);
    assert.equal(mail.sent[0].payload.replyTo, "cinegenius.co@gmail.com");
    assert.equal(Object.hasOwn(mail.sent[0].payload, "locale"), false);
    assert.match(mail.sent[0].payload.html, /A &lt; B &amp; &quot;C&quot;/);
  });
});

test("missing email configuration, rejected requests and ambiguous network failures never report success", async () => {
  const mail = emailFixture();
  const payload = await mail.buildListingReminderEmail(input);
  await withFakeKey(async () => {
    assert.deepEqual(await mail.sendListingReminderEmail(payload, "own-key"), { ok: false, reason: "not_configured" });
    assert.equal(mail.sent.length, 0);
  }, false);
  await withFakeKey(async () => {
    for (const failure of [
      { data: null, error: { name: "validation_error" } },
      { data: null, error: null },
      new Error("simulated connection failure after possible provider acceptance"),
    ]) {
      const failing = emailFixture(failure);
      const result = await failing.sendListingReminderEmail(payload, "stable-key");
      assert.equal(result.ok, false);
      assert.equal(failing.sent.length, 1);
    }
    assert.equal((await mail.sendListingReminderEmail({ ...payload, to: "recipient@example.invalid\nother@example.invalid" }, "own-key")).reason, "invalid_payload");
    assert.equal((await mail.sendListingReminderEmail(payload, "bad\r\nkey")).reason, "invalid_payload");
    assert.equal(mail.sent.length, 0);
  });
});

test("the scheduler requires an exact configured bearer secret and explicit production enablement", () => {
  assert.equal(authorizedListingFreshnessCron("Bearer undefined", undefined), false);
  assert.equal(authorizedListingFreshnessCron("Bearer ", ""), false);
  assert.equal(authorizedListingFreshnessCron(null, "own-secret"), false);
  assert.equal(authorizedListingFreshnessCron("Bearer wrong-secret", "own-secret"), false);
  assert.equal(authorizedListingFreshnessCron("Bearer own-secret", "own-secret"), true);
  for (const environment of [{}, { VERCEL_ENV: "production" }, { VERCEL_ENV: "preview", LISTING_FRESHNESS_ENABLED: "true" }, { NODE_ENV: "production", LISTING_FRESHNESS_ENABLED: "true" }, { VERCEL_ENV: "production", LISTING_FRESHNESS_ENABLED: "false" }]) {
    assert.equal(listingFreshnessSchedulerEnabled(environment), false);
  }
  assert.equal(listingFreshnessSchedulerEnabled({ VERCEL_ENV: "production", LISTING_FRESHNESS_ENABLED: "true" }), true);
});

test("delivery checks distinguish provider acceptance, confirmed receipt and terminal delivery failures", async () => {
  await withFakeKey(async () => {
    for (const event of ["sent", "queued", "scheduled", "delivery_delayed", "delivered", "opened", "clicked", "bounced", "failed", "suppressed", "complained", "canceled"]) {
      const mail = emailFixture({ data: { id: "own-message", to: [input.to], last_event: event }, error: null });
      const expected = ["sent", "queued", "scheduled", "delivery_delayed"].includes(event) ? "pending" : ["delivered", "opened", "clicked"].includes(event) ? "delivered" : event;
      assert.equal(await mail.getListingReminderDeliveryStatus("own-message", input.to), expected, event);
      assert.deepEqual(mail.reads, [{ id: "own-message", hasTimeout: true }]);
      assert.equal(mail.sent.length, 0);
    }
  });
});

test("delivery reads fail closed for missing configuration, errors, unknown events and recipient mismatches", async () => {
  await withFakeKey(async () => {
    for (const result of [new Error("simulated status read failure"), { data: null, error: { name: "restricted_api_key" } },
      { data: { id: "wrong-message", to: [input.to], last_event: "delivered" }, error: null },
      { data: { id: "own-message", to: ["other@example.invalid"], last_event: "delivered" }, error: null },
      { data: { id: "own-message", to: [input.to, "other@example.invalid"], last_event: "delivered" }, error: null },
      { data: { id: "own-message", to: [input.to], last_event: "unknown_event" }, error: null }]) {
      const mail = emailFixture(result);
      assert.equal(await mail.getListingReminderDeliveryStatus("own-message", input.to), "unavailable");
      assert.equal(mail.sent.length, 0);
    }
  });
  await withFakeKey(async () => {
    const mail = emailFixture();
    assert.equal(await mail.getListingReminderDeliveryStatus("own-message", input.to), "unavailable");
    assert.equal(mail.reads.length, 0);
  }, false);
});
