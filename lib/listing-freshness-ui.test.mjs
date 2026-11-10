import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import ts from "typescript";

const require = createRequire(import.meta.url);
const locales = ["de", "en", "es", "it", "cs", "hu"];
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
