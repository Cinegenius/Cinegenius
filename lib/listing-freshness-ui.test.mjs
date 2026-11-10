import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import ts from "typescript";
import { SUPPORTED_LOCALES } from "./i18n/locales.ts";

const require = createRequire(import.meta.url);
const locales = SUPPORTED_LOCALES;
const catalogs = Object.fromEntries(locales.map(locale => [locale, JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"))]));
const listingId = "20000000-0000-4000-8000-000000000001";
const translate = (locale, namespace) => createTranslator({ locale, namespace, messages: catalogs[locale], onError(error) { throw error; } });
function load(file, mocks, fetch, crypto = {}) {
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", "fetch", "crypto", code)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (["react/jsx-runtime", "lucide-react"].includes(name)) return require(name);
    throw new Error(`Unmocked dependency: ${name}`);
  }, loaded, loaded.exports, fetch, crypto);
  return loaded.exports;
}
function* nodes(node) {
  if (Array.isArray(node)) { for (const child of node) yield* nodes(child); return; }
  if (!node || typeof node !== "object") return;
  yield node;
  yield* nodes(node.props?.children);
}
const textOf = node => Array.isArray(node) ? node.map(textOf).join("") : node == null || typeof node === "boolean" ? "" : typeof node === "object" ? textOf(node.props?.children) : String(node);
const button = (tree, label) => [...nodes(tree)].find(node => node.type === "button" && textOf(node) === label);
function fixture(kind = "provider", options = {}) {
  let locale = options.locale ?? "de", cursor = 0, generatedIds = 0;
  const slots = [], effects = [], calls = [];
  const provider = {
    listing: { id: listingId, title: '<script>Own listing</script>', type: "prop", href: `/props/${listingId}`, published: true },
    state: { version: 7, cycle: 3, status: "active", confirmed_at: "2026-11-01T10:00:00Z", due_at: "2026-12-01T10:00:00Z", reminder_sent_at: null, followup_sent_at: null, response_deadline_at: null },
    canRenew: true, canEnd: true,
    ...options.provider,
  };
  const admin = {
    schedulerEnabled: false,
    settings: [
      { listing_type: "prop", enabled: true, initial_days: 90, followup_days: 7, response_days: 7, updated_at: "private-server-only-field" },
      { listing_type: "job", enabled: false, initial_days: 30, followup_days: 7, response_days: 7 },
    ],
    items: [{ listing_id: listingId, listing: provider.listing, status: "active", due_at: provider.state?.due_at }], total: 51, page: 1, pageSize: 50,
  };
  const react = { ...React,
    useState(initial) { const index = cursor++; slots[index] ??= { value: typeof initial === "function" ? initial() : initial }; return [slots[index].value, value => { slots[index].value = typeof value === "function" ? value(slots[index].value) : value; }]; },
    useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
    useEffect(run, deps) { const index = cursor++, previous = slots[index]; if (!previous || deps.some((value, item) => value !== previous.deps[item])) { slots[index] = { deps, cleanup: previous?.cleanup }; effects.push({ index, run }); } },
  };
  const fetch = async (url, init = {}) => {
    const call = { url: String(url), method: init.method ?? "GET", signal: init.signal, body: init.body ? JSON.parse(init.body) : null };
    calls.push(call);
    if (call.method === "GET") {
      if (options.get) return options.get(call, calls);
      if (kind === "provider") return Response.json(provider);
      const view = new URL(call.url, "https://fixture.invalid").searchParams.get("view");
      return Response.json({ ...admin, items: view === "events" ? [{ id: "event-own", listing_id: listingId, listing: provider.listing, action: "renewed", created_at: "2026-11-01T10:00:00Z", metadata: { reason: "Own reason" } }] : admin.items });
    }
    if (options.write) return options.write(call, calls);
    if (kind === "admin") { admin.settings = call.body.settings; return Response.json({ ok: true }); }
    provider.state = { ...provider.state, version: provider.state.version + 1, status: call.body.action === "end" ? "ended" : "active" };
    provider.canEnd = false; provider.canRenew = false;
    return Response.json({ ok: true, state: provider.state });
  };
  function Link({ children, prefetch, ...props }) { void prefetch; return React.createElement("a", props, children); }
  const component = load(kind === "admin" ? "../components/admin/AdminListingFreshness.tsx" : "../components/ListingFreshnessStatus.tsx", {
    react, "next/link": Link,
    "next-intl": {
      useTranslations: namespace => translate(locale, namespace), useLocale: () => locale,
      useFormatter: () => ({ dateTime: (date, options) => new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(date) }),
    },
  }, fetch, { randomUUID() { generatedIds++; return `30000000-0000-4000-8000-${String(generatedIds).padStart(12, "0")}`; } }).default;
  const app = {
    calls, provider, admin,
    locale(value) { locale = value; },
    t: (namespace, key) => translate(locale, namespace)(key),
    render() {
      cursor = 0;
      app.tree = component(kind === "provider" ? { listingId, initialAction: options.initialAction } : {});
      for (const node of nodes(app.tree)) {
        if (node.type === "dialog" && node.props.ref) node.props.ref.current ??= { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
        else if (node.props.ref && typeof node.props.ref === "object") node.props.ref.current ??= { focus() {} };
      }
      for (const { index, run } of effects.splice(0)) { slots[index].cleanup?.(); slots[index].cleanup = run(); }
      return app.tree;
    },
    async settle() { for (let index = 0; index < 3; index++) { await new Promise(resolve => setImmediate(resolve)); app.render(); } return app.tree; },
    dispose() { for (const slot of slots) slot?.cleanup?.(); },
  };
  app.render();
  return app;
}

test("opening an end link and cancelling its dialog never mutates a listing; ending requires a separate confirmation", async () => {
  const app = fixture("provider", { initialAction: "end" });
  try {
    await app.settle();
    assert.deepEqual(app.calls.map(call => call.method), ["GET"]);
    assert.equal([...nodes(app.tree)].some(node => node.type === "dialog"), false);
    button(app.tree, app.t("ListingFreshness", "end")).props.onClick();
    app.render();
    assert.equal([...nodes(app.tree)].find(node => node.type === "dialog").props.ref.current.open, true);
    assert.equal(app.calls.length, 1);
    button(app.tree, app.t("ListingFreshness", "cancel")).props.onClick();
    app.render();
    assert.equal([...nodes(app.tree)].some(node => node.type === "dialog"), false);
    button(app.tree, app.t("ListingFreshness", "end")).props.onClick(); app.render();
    button(app.tree, app.t("ListingFreshness", "confirmEnd")).props.onClick();
    await app.settle();
    const writes = app.calls.filter(call => call.method === "POST");
    assert.equal(writes.length, 1);
    assert.deepEqual({ ...writes[0].body, requestId: "stable" }, { action: "end", version: 7, cycle: 3, requestId: "stable", locale: "de" });
    assert.match(textOf(app.tree), /Dein Inserat wurde beendet/);
  } finally { app.dispose(); }
});

test("double clicks produce one request and a retry preserves the exact body even after a locale change", async () => {
  let attempts = 0;
  const app = fixture("provider", { write: async () => { attempts++; return Response.json({ error: "temporary" }, { status: 503 }); } });
  try {
    await app.settle();
    const click = button(app.tree, app.t("ListingFreshness", "renew")).props.onClick;
    click(); click();
    await app.settle();
    assert.equal(attempts, 1);
    app.locale("en"); app.render();
    button(app.tree, app.t("ListingFreshness", "renew")).props.onClick();
    await app.settle();
    const writes = app.calls.filter(call => call.method === "POST");
    assert.equal(writes.length, 2);
    assert.deepEqual(writes[0].body, writes[1].body);
  } finally { app.dispose(); }
});

test("a missing cycle or denied listing exposes no action, and a stale response blocks another write until reload", async () => {
  const missing = fixture("provider", { provider: { state: null, canRenew: false, canEnd: false } });
  const denied = fixture("provider", { get: async () => Response.json({ error: "missing" }, { status: 404 }) });
  const stale = fixture("provider", { write: async () => Response.json({ error: "stale" }, { status: 409 }) });
  try {
    await missing.settle(); await denied.settle(); await stale.settle();
    assert.match(textOf(missing.tree), /läuft noch keine Aktualitätsprüfung/);
    assert.equal(button(missing.tree, missing.t("ListingFreshness", "renew")), undefined);
    assert.doesNotMatch(renderToStaticMarkup(denied.tree), /Own listing/);
    button(stale.tree, stale.t("ListingFreshness", "renew")).props.onClick(); await stale.settle();
    const renew = button(stale.tree, stale.t("ListingFreshness", "renew"));
    assert.equal(renew.props.disabled, true);
    renew.props.onClick(); await stale.settle();
    assert.equal(stale.calls.filter(call => call.method === "POST").length, 1);
  } finally { missing.dispose(); denied.dispose(); stale.dispose(); }
});

test("admin view, filter and locale changes preserve edits; only explicit submit writes the allowed settings fields", async () => {
  const app = fixture("admin");
  try {
    await app.settle();
    [...nodes(app.tree)].find(node => node.type === "input" && node.props.type === "number").props.onChange({ target: { value: "45" } });
    [...nodes(app.tree)].find(node => node.type === "textarea").props.onChange({ target: { value: "Own reviewed change" } });
    app.render();
    button(app.tree, app.t("AdminListingFreshness", "views.events")).props.onClick(); app.render(); await app.settle();
    const beforeLocale = app.calls.length;
    app.locale("en"); app.render();
    assert.equal(app.calls.length, beforeLocale);
    assert.equal([...nodes(app.tree)].find(node => node.type === "input" && node.props.type === "number").props.value, "45");
    assert.equal(app.calls.some(call => call.method === "PUT"), false);
    [...nodes(app.tree)].find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
    await app.settle();
    const saved = app.calls.find(call => call.method === "PUT").body;
    assert.equal(saved.reason, "Own reviewed change");
    assert.equal(saved.settings[0].initial_days, 45);
    assert.equal(saved.settings.length, 2);
    assert.deepEqual(Object.keys(saved.settings[0]).sort(), ["enabled", "followup_days", "initial_days", "listing_type", "response_days"]);
    assert.ok(app.calls.some(call => call.url.includes("view=events")));
  } finally { app.dispose(); }
});

test("admin reasons reject invalid lengths before writing and accept the exact 5- and 500-character limits", async () => {
  const app = fixture("admin");
  try {
    await app.settle();
    [...nodes(app.tree)].find(node => node.type === "input" && node.props.type === "number").props.onChange({ target: { value: "45" } });
    for (const reason of ["", "   ", "abcd", "x".repeat(501)]) {
      const textarea = [...nodes(app.tree)].find(node => node.type === "textarea");
      assert.equal(textarea.props.maxLength, 500);
      assert.equal(textarea.props.minLength, 5);
      textarea.props.onChange({ target: { value: reason } });
      app.render();
      [...nodes(app.tree)].find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
      await app.settle();
      assert.equal(app.calls.some(call => call.method === "PUT"), false);
      assert.ok(textOf(app.tree).includes(app.t("AdminListingFreshness", "reasonRequired")));
    }
    for (const length of [5, 500]) {
      [...nodes(app.tree)].find(node => node.type === "input" && node.props.type === "number").props.onChange({ target: { value: String(45 + length) } });
      [...nodes(app.tree)].find(node => node.type === "textarea").props.onChange({ target: { value: "x".repeat(length) } });
      app.render();
      [...nodes(app.tree)].find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
      await app.settle();
      assert.equal(app.calls.filter(call => call.method === "PUT").at(-1).body.reason.length, length);
    }
  } finally { app.dispose(); }
});

test("the actual provider and admin views render every locale with escaped member titles and complete labels", async () => {
  for (const locale of locales) for (const kind of ["provider", "admin"]) {
    const app = fixture(kind, { locale });
    try {
      await app.settle();
      const html = renderToStaticMarkup(app.tree);
      assert.ok(html.includes("&lt;script&gt;Own listing&lt;/script&gt;"), `${kind}/${locale}`);
      assert.doesNotMatch(html, /<script>|MISSING_MESSAGE/);
      assert.ok(html.includes("min-h-11"));
      if (kind === "admin") assert.ok(textOf(app.tree).includes(app.t("AdminListingFreshness", "schedulerDisabled")));
    } finally { app.dispose(); }
  }
});

test("admin intervals match the database limits and invalid follow-up periods never reach the write endpoint", async () => {
  for (const fieldIndex of [1, 2]) {
    const app = fixture("admin");
    try {
      await app.settle();
      const inputs = [...nodes(app.tree)].filter(node => node.type === "input" && node.props.type === "number");
      assert.deepEqual(inputs.slice(0, 3).map(node => node.props.max), [3650, 730, 730]);
      inputs[0].props.onChange({ target: { value: "3650" } });
      inputs[fieldIndex].props.onChange({ target: { value: "731" } });
      [...nodes(app.tree)].find(node => node.type === "textarea").props.onChange({ target: { value: "Own reviewed interval change" } });
      app.render();
      [...nodes(app.tree)].find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
      await app.settle();
      assert.equal(app.calls.some(call => call.method === "PUT"), false);
      assert.ok(textOf(app.tree).includes(app.t("AdminListingFreshness", "invalidSettings")));
      [...nodes(app.tree)].filter(node => node.type === "input" && node.props.type === "number")[fieldIndex].props.onChange({ target: { value: "730" } });
      app.render();
      [...nodes(app.tree)].find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
      await app.settle();
      assert.equal(app.calls.filter(call => call.method === "PUT").length, 1);
    } finally { app.dispose(); }
  }
});

test("the provider page requires sign-in, preserves the chosen action and performs no write during GET", async () => {
  const source = "../app/listing-status/[id]/page.tsx";
  const mocks = {
    "@clerk/nextjs/server": { auth: async () => ({ userId: null }) },
    "next/navigation": { redirect: destination => { throw new Error(destination); } },
    "next-intl/server": { getTranslations: async namespace => translate("de", namespace) },
    "@/components/ListingFreshnessStatus": "provider-test-view",
  };
  const noFetch = () => { throw new Error("No API call is allowed in the page fixture"); };
  const signedOut = load(source, mocks, noFetch).default;
  await assert.rejects(signedOut({ params: Promise.resolve({ id: listingId }), searchParams: Promise.resolve({ action: "end" }) }), error => error.message === `/sign-in?redirect_url=${encodeURIComponent(`/listing-status/${listingId}?action=end`)}`);
  mocks["@clerk/nextjs/server"].auth = async () => ({ userId: "own-test" });
  const page = await load(source, mocks, noFetch).default({ params: Promise.resolve({ id: listingId }), searchParams: Promise.resolve({ action: "end" }) });
  assert.equal(page.props.initialAction, "end");
  assert.equal(page.props.listingId, listingId);
});

export { fixture as listingFreshnessUiFixture, button as fixtureButton };

for (const locale of locales) {
  test(`${locale}: status failures use native copy and never show raw API or transport errors`, async () => {
    for (const [status, key] of [[401, "signInRequired"], [403, "unavailable"], [404, "unavailable"], [503, "loadError"]]) {
      const app = fixture("provider", { locale, get: async () => Response.json({ error: "TypeError: vendor_private_error" }, { status }) });
      try {
        await app.settle();
        assert.ok(textOf(app.tree).includes(app.t("ListingFreshness", key)));
        assert.doesNotMatch(textOf(app.tree), /vendor_private_error|TypeError|loadError|signInRequired/);
        assert.equal(app.calls.some(call => call.method !== "GET"), false);
      } finally { app.dispose(); }
    }
    const failed = fixture("provider", { locale, get: async () => { throw new TypeError("Load failed: browser_vendor_error"); } });
    try {
      await failed.settle();
      assert.ok(textOf(failed.tree).includes(failed.t("ListingFreshness", "loadError")));
      assert.doesNotMatch(textOf(failed.tree), /browser_vendor_error|Load failed/);
    } finally { failed.dispose(); }
  });

  test(`${locale}: write failures stay native, keep stable listing IDs and require the existing explicit action`, async () => {
    for (const [status, key] of [[401, "signInRequired"], [403, "unavailable"], [409, "conflict"], [503, "saveError"]]) {
      const app = fixture("provider", { locale, write: async () => Response.json({ error: "SyntaxError: vendor_write_error" }, { status }) });
      try {
        await app.settle();
        assert.equal(app.calls.length, 1);
        button(app.tree, app.t("ListingFreshness", "renew")).props.onClick();
        await app.settle();
        assert.ok(textOf(app.tree).includes(app.t("ListingFreshness", key)));
        assert.doesNotMatch(textOf(app.tree), /vendor_write_error|SyntaxError/);
        const writes = app.calls.filter(call => call.method === "POST");
        assert.equal(writes.length, 1);
        assert.equal(writes[0].url, `/api/listing-freshness/${listingId}`);
        assert.deepEqual({ ...writes[0].body, requestId: "stable" }, { action: "renew", version: 7, cycle: 3, requestId: "stable", locale });
      } finally { app.dispose(); }
    }
  });

  test(`${locale}: listing summary and both private page metadata titles use native catalogs`, async () => {
    const date = new Date("2026-12-01T10:00:00Z");
    const mocks = {
      react: React, "next/link": ({ children, prefetch, ...props }) => { void prefetch; return React.createElement("a", props, children); },
      "next-intl": {
        useTranslations: namespace => translate(locale, namespace),
        useFormatter: () => ({ dateTime: (value, options) => new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(value) }),
      },
    };
    const Summary = load("../components/ListingFreshnessSummary.tsx", mocks, () => assert.fail("Summary must not fetch")).default;
    const tree = Summary({ listingId, state: { status: "paused", response_deadline_at: date.toISOString() } });
    const t = translate(locale, "ListingFreshness");
    assert.ok(textOf(tree).includes(t("statuses.paused")));
    assert.ok(textOf(tree).includes(t("deadlineShort", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(date) })));
    assert.equal([...nodes(tree)].find(node => typeof node.type === "function").props.href, `/listing-status/${listingId}`);
    assert.ok(renderToStaticMarkup(tree).includes(t("dashboardLink")));
    for (const [file, namespace, view] of [["../app/admin/listing-freshness/page.tsx", "AdminListingFreshness", "@/components/admin/AdminListingFreshness"], ["../app/listing-status/[id]/page.tsx", "ListingFreshness", "@/components/ListingFreshnessStatus"]]) {
      const page = load(file, { "next-intl/server": { getTranslations: async selected => { assert.equal(selected, namespace); return translate(locale, selected); } }, "@clerk/nextjs/server": { auth: async () => ({ userId: "opaque-member" }) }, "next/navigation": { redirect: () => assert.fail("No redirect expected") }, [view]: "test-view" }, () => assert.fail("Metadata must not fetch"));
      assert.deepEqual(await page.generateMetadata(), { title: translate(locale, namespace)("title"), robots: { index: false, follow: false } });
    }
  });
}

test("all nine language switches preserve admin draft fields, filters, reasons and listing confirmation state without writes", async () => {
  const admin = fixture("admin");
  const provider = fixture("provider", { initialAction: "end" });
  const memberReason = "Original reason: als <member> & Zoë 東京 {never_translate}";
  try {
    await admin.settle(); await provider.settle();
    [...nodes(admin.tree)].find(node => node.type === "input" && node.props.type === "number").props.onChange({ target: { value: "45" } });
    [...nodes(admin.tree)].find(node => node.type === "textarea").props.onChange({ target: { value: memberReason } });
    [...nodes(admin.tree)].find(node => node.type === "select").props.onChange({ target: { value: "job" } });
    admin.render(); await admin.settle();
    button(provider.tree, provider.t("ListingFreshness", "end")).props.onClick(); provider.render();
    const beforeAdmin = admin.calls.length, beforeProvider = provider.calls.length;
    for (const locale of [...locales, "de"]) {
      admin.locale(locale); admin.render(); provider.locale(locale); provider.render();
      assert.equal([...nodes(admin.tree)].find(node => node.type === "input" && node.props.type === "number").props.value, "45");
      assert.equal([...nodes(admin.tree)].find(node => node.type === "textarea").props.value, memberReason);
      assert.equal([...nodes(admin.tree)].find(node => node.type === "select").props.value, "job");
      assert.ok(textOf(admin.tree).includes(admin.t("AdminListingFreshness", "unsaved")));
      const dialog = [...nodes(provider.tree)].find(node => node.type === "dialog");
      assert.ok(dialog); assert.equal(dialog.props.ref.current.open, true);
      assert.ok(textOf(dialog).includes(provider.t("ListingFreshness", "confirmEnd")));
      assert.equal(provider.provider.listing.title, '<script>Own listing</script>');
      assert.equal(admin.calls.length, beforeAdmin); assert.equal(provider.calls.length, beforeProvider);
    }
    assert.ok([...admin.calls, ...provider.calls].every(call => call.method === "GET"));
  } finally { admin.dispose(); provider.dispose(); }
});

test("admin read-access check requires own-test confirmation and double click performs only one diagnostic POST", async () => {
  const app = fixture("admin", { write: async () => Response.json({ status: "readable" }) });
  try {
    await app.settle();
    const beforeSettings = [...nodes(app.tree)].filter(node => node.type === "input" && node.props.type === "number").map(node => node.props.value);
    assert.equal(button(app.tree, app.t("AdminListingFreshness", "readCheck.check")).props.disabled, true);
    const diagnosticForm = () => [...nodes(app.tree)].find(node => node.type === "form" && textOf(node).includes(app.t("AdminListingFreshness", "readCheck.confirmOwn")));
    diagnosticForm().props.onSubmit({ preventDefault() {} });
    assert.equal(app.calls.filter(call => call.method === "POST").length, 0);
    [...nodes(diagnosticForm())].find(node => node.type === "input" && node.props.type === "text").props.onChange({ target: { value: ` ${listingId} ` } });
    [...nodes(diagnosticForm())].find(node => node.type === "input" && node.props.type === "checkbox").props.onChange({ target: { checked: true } });
    app.render();
    const submit = diagnosticForm().props.onSubmit;
    submit({ preventDefault() {} }); submit({ preventDefault() {} });
    await app.settle();
    const writes = app.calls.filter(call => call.method !== "GET");
    assert.equal(writes.length, 1); assert.equal(writes[0].method, "POST");
    assert.deepEqual(writes[0].body, { action: "check_delivery_access", messageId: listingId, ownTestEmail: true });
    assert.ok(textOf(app.tree).includes(app.t("AdminListingFreshness", "readCheck.results.readable")));
    assert.deepEqual([...nodes(app.tree)].filter(node => node.type === "input" && node.props.type === "number").map(node => node.props.value), beforeSettings);
  } finally { app.dispose(); }
});
test("admin diagnostic failure preserves entered message ID and never presents a successful read", async () => {
  const app = fixture("admin", { write: async () => Response.json({ code: "rate_limited" }, { status: 429 }) });
  try {
    await app.settle();
    const form = () => [...nodes(app.tree)].find(node => node.type === "form" && textOf(node).includes(app.t("AdminListingFreshness", "readCheck.confirmOwn")));
    [...nodes(form())].find(node => node.type === "input" && node.props.type === "text").props.onChange({ target: { value: listingId } });
    [...nodes(form())].find(node => node.type === "input" && node.props.type === "checkbox").props.onChange({ target: { checked: true } });
    app.render(); form().props.onSubmit({ preventDefault() {} }); await app.settle();
    assert.ok(textOf(app.tree).includes(app.t("AdminListingFreshness", "readCheck.results.rate_limited")));
    assert.equal([...nodes(form())].find(node => node.type === "input" && node.props.type === "text").props.value, listingId);
    assert.equal(app.calls.some(call => call.method === "PUT"), false);
  } finally { app.dispose(); }
});

function readCheckForm(app) {
  return [...nodes(app.tree)].find(node => node.type === "form" && textOf(node).includes(app.t("AdminListingFreshness", "readCheck.confirmOwn")));
}
function fillReadCheck(app) {
  const form = readCheckForm(app);
  [...nodes(form)].find(node => node.type === "input" && node.props.type === "text").props.onChange({ target: { value: listingId } });
  [...nodes(form)].find(node => node.type === "input" && node.props.type === "checkbox").props.onChange({ target: { checked: true } });
  app.render();
}
const diagnosticStatuses = ["readable", "not_configured", "verified_email_required", "permission_denied", "not_found", "unavailable", "rate_limited", "invalid", "account"];

for (const locale of locales) {
  test(`${locale}: all diagnostic outcomes use native copy and unknown provider text stays hidden`, async () => {
    for (const status of [...diagnosticStatuses, "PRIVATE_VENDOR_TEXT <xml> 東京"]) {
      const app = fixture("admin", { locale, write: async () => Response.json({ status, error: "PRIVATE_VENDOR_ERROR", recipient: "private-recipient@example.invalid" }) });
      try {
        await app.settle(); fillReadCheck(app);
        readCheckForm(app).props.onSubmit({ preventDefault() {} }); await app.settle();
        const expected = diagnosticStatuses.includes(status) ? status : "unavailable";
        const message = app.t("AdminListingFreshness", `readCheck.results.${expected}`);
        const result = [...nodes(readCheckForm(app))].find(node => node.type === "p" && node.props.role);
        assert.equal(textOf(result), message);
        assert.equal(result.props.role, expected === "readable" ? "status" : "alert");
        assert.doesNotMatch(textOf(app.tree), /PRIVATE_VENDOR|private-recipient/);
        assert.equal(app.calls.filter(call => call.method === "POST").length, 1);
        assert.equal(app.calls.some(call => call.method === "PUT" || call.url.includes("/api/listing-freshness/")), false);
      } finally { app.dispose(); }
    }
  });

  test(`${locale}: HTTP and browser failures use native diagnostic errors while retaining the entered ID and confirmation`, async () => {
    for (const [status, expected] of [[400, "invalid"], [401, "account"], [403, "account"], [429, "rate_limited"], [503, "unavailable"], [0, "unavailable"], [-1, "unavailable"]]) {
      const app = fixture("admin", { locale, write: async () => {
        if (status === 0) throw new TypeError("PRIVATE_BROWSER_FAILURE");
        if (status === -1) return { ok: true, json: async () => { throw new SyntaxError("PRIVATE_JSON_FAILURE"); } };
        return Response.json({ status: "readable", error: "PRIVATE_API_FAILURE" }, { status });
      } });
      try {
        await app.settle(); fillReadCheck(app);
        readCheckForm(app).props.onSubmit({ preventDefault() {} }); await app.settle();
        assert.ok(textOf(readCheckForm(app)).includes(app.t("AdminListingFreshness", `readCheck.results.${expected}`)));
        assert.ok(!textOf(readCheckForm(app)).includes(app.t("AdminListingFreshness", "readCheck.results.readable")));
        assert.doesNotMatch(textOf(app.tree), /PRIVATE_(?:API|BROWSER|JSON)_FAILURE/);
        assert.equal([...nodes(readCheckForm(app))].find(node => node.type === "input" && node.props.type === "text").props.value, listingId);
        assert.equal([...nodes(readCheckForm(app))].find(node => node.type === "input" && node.props.type === "checkbox").props.checked, true);
        assert.equal(app.calls.filter(call => call.method !== "GET").length, 1);
      } finally { app.dispose(); }
    }
  });
}

test("nine-language switches retain diagnostic result, ID and confirmation plus unsaved rule fields without further requests", async () => {
  const app = fixture("admin", { write: async () => Response.json({ status: "permission_denied" }) });
  const reason = "Own reason als <xml> & Zoë 東京 {keep_original}";
  try {
    await app.settle();
    [...nodes(app.tree)].find(node => node.type === "input" && node.props.type === "number").props.onChange({ target: { value: "45" } });
    [...nodes(app.tree)].find(node => node.type === "textarea").props.onChange({ target: { value: reason } });
    app.render();
    const form = readCheckForm(app);
    [...nodes(form)].find(node => node.type === "input" && node.props.type === "text").props.onChange({ target: { value: listingId } }); app.render();
    readCheckForm(app).props.onSubmit({ preventDefault() {} });
    assert.equal(app.calls.filter(call => call.method === "POST").length, 0, "explicit own-mail confirmation is required");
    fillReadCheck(app);
    const submit = readCheckForm(app).props.onSubmit;
    submit({ preventDefault() {} }); submit({ preventDefault() {} }); await app.settle();
    const beforeSwitch = app.calls.length;
    for (const locale of [...locales, "de"]) {
      app.locale(locale); app.render();
      assert.equal([...nodes(readCheckForm(app))].find(node => node.type === "input" && node.props.type === "text").props.value, listingId);
      assert.equal([...nodes(readCheckForm(app))].find(node => node.type === "input" && node.props.type === "checkbox").props.checked, true);
      assert.equal([...nodes(app.tree)].find(node => node.type === "textarea").props.value, reason);
      assert.equal([...nodes(app.tree)].find(node => node.type === "input" && node.props.type === "number").props.value, "45");
      assert.ok(textOf(app.tree).includes(app.t("AdminListingFreshness", "unsaved")));
      assert.ok(textOf(readCheckForm(app)).includes(app.t("AdminListingFreshness", "readCheck.results.permission_denied")));
      assert.equal(app.calls.length, beforeSwitch);
    }
    const writes = app.calls.filter(call => call.method !== "GET");
    assert.equal(writes.length, 1); assert.equal(writes[0].method, "POST");
    assert.deepEqual(writes[0].body, { action: "check_delivery_access", messageId: listingId, ownTestEmail: true });
  } finally { app.dispose(); }
});

test("in-flight diagnostic status and busy labels follow all nine locales without duplicate POSTs or resetting input", async () => {
  for (const locale of locales) {
    let finish;
    const response = new Promise(resolve => { finish = resolve; });
    const app = fixture("admin", { write: () => response });
    try {
      await app.settle(); fillReadCheck(app);
      readCheckForm(app).props.onSubmit({ preventDefault() {} }); app.render();
      app.locale(locale); app.render();
      assert.ok(textOf(readCheckForm(app)).includes(app.t("AdminListingFreshness", "readCheck.checking")));
      assert.equal([...nodes(readCheckForm(app))].find(node => node.type === "input" && node.props.type === "text").props.disabled, true);
      readCheckForm(app).props.onSubmit({ preventDefault() {} });
      assert.equal(app.calls.filter(call => call.method === "POST").length, 1);
      finish(Response.json({ status: "readable" })); await app.settle();
      assert.ok(textOf(readCheckForm(app)).includes(app.t("AdminListingFreshness", "readCheck.results.readable")));
      assert.equal([...nodes(readCheckForm(app))].find(node => node.type === "input" && node.props.type === "text").props.value, listingId);
      assert.equal([...nodes(readCheckForm(app))].find(node => node.type === "input" && node.props.type === "text").props.disabled, false);
    } finally { app.dispose(); }
  }
});
