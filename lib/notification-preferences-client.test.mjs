import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(new URL("../components/NotificationPreferences.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const response = (settings, ok = true) => ({ ok, json: async () => settings });

function fixture(accountId = "owner-a") {
  const slots = [], effects = [], layouts = [];
  let cursor = 0, tree;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, next => { slots[index].value = typeof next === "function" ? next(slots[index].value) : next; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
  };
  const effect = target => (run, deps) => {
    const index = cursor++, previous = slots[index];
    if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
      target.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: run() }; });
    }
  };
  hooks.useEffect = effect(effects); hooks.useLayoutEffect = effect(layouts);
  const mocks = {
    react: { ...React, ...hooks },
    "next-intl": { useTranslations: () => key => key },
    "lucide-react": { Loader2: () => React.createElement("svg") },
  };
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)(name => mocks[name] ?? require(name), loaded, loaded.exports);
  function render(next = accountId) {
    accountId = next; cursor = 0;
    tree = loaded.exports.default({ accountId });
    while (layouts.length) layouts.shift()();
    while (effects.length) effects.shift()();
    return tree;
  }
  render();
  return { render, get tree() { return tree; }, unmount() { slots.forEach(slot => slot?.cleanup?.()); } };
}

function nodes(value, predicate, result = []) {
  if (Array.isArray(value)) value.forEach(child => nodes(child, predicate, result));
  else if (value && typeof value === "object" && value.props) {
    if (predicate(value)) result.push(value);
    nodes(value.props.children, predicate, result);
  }
  return result;
}
const control = fixture => nodes(fixture.tree, node => node.props.role === "switch")[0];
const alerts = fixture => nodes(fixture.tree, node => node.props.role === "alert");
const saved = fixture => nodes(fixture.tree, node => node.props.children === "PrivacySettings.saved");

async function withFetch(fetcher, run) {
  const previous = globalThis.fetch;
  globalThis.fetch = fetcher;
  let f;
  try { f = fixture(); await run(f); } finally { f?.unmount(); globalThis.fetch = previous; }
}

test("notification preference waits for confirmed loading and sends only the intended own-account field", async () => {
  const calls = [];
  await withFetch(async (url, options) => {
    calls.push({ url, options });
    return response(options.method === "PATCH" ? { success: true, settings: { email_new_message: false } } : { settings: { email_new_message: true } });
  }, async f => {
    assert.equal(control(f), undefined, "no unchecked default while loading");
    await settle(); f.render();
    assert.equal(control(f).props["aria-checked"], true);
    control(f).props.onClick(); await settle(); f.render();
    assert.equal(control(f).props["aria-checked"], false);
    assert.equal(saved(f).length, 1);
    assert.equal(calls[0].options.cache, "no-store");
    assert.equal(calls[1].url, "/api/user-settings");
    assert.deepEqual(JSON.parse(calls[1].options.body), { accountId: "owner-a", email_new_message: false });
  });
});

test("HTTP failure, malformed capability and unconfirmed save never show a false saved state", async () => {
  for (const answer of [response({ error: "unavailable" }, false), response({ success: true, settings: {} }), response({ success: true, settings: { email_new_message: true } })]) {
    await withFetch(async (_url, options) => options.method === "PATCH" ? answer : response({ settings: { email_new_message: true } }), async f => {
      await settle(); f.render(); control(f).props.onClick(); await settle(); f.render();
      assert.equal(control(f).props["aria-checked"], true);
      assert.equal(alerts(f).length, 1);
      assert.equal(saved(f).length, 0);
    });
  }
});

test("failed initial loading exposes retry and never treats missing data as an enabled preference", async () => {
  let calls = 0;
  await withFetch(async () => ++calls === 1 ? response({ settings: {} }) : response({ settings: { email_new_message: false } }), async f => {
    await settle(); f.render();
    assert.equal(control(f), undefined); assert.equal(alerts(f).length, 1);
    nodes(f.tree, node => node.type === "button" && node.props.children === "PrivacySettings.retry")[0].props.onClick();
    f.render(); await settle(); f.render();
    assert.equal(control(f).props["aria-checked"], false); assert.equal(alerts(f).length, 0);
  });
});

test("switching account aborts and ignores a late read from the previous account", async () => {
  const first = deferred(), second = deferred(), calls = [];
  await withFetch((_url, options) => { calls.push(options); return calls.length === 1 ? first.promise : second.promise; }, async f => {
    await settle(); f.render("owner-b"); await settle();
    assert.equal(calls[0].signal.aborted, true);
    first.resolve(response({ settings: { email_new_message: true } })); await settle(); f.render();
    assert.equal(control(f), undefined);
    second.resolve(response({ settings: { email_new_message: false } })); await settle(); f.render();
    assert.equal(control(f).props["aria-checked"], false);
  });
});

test("switching account during save neither displays the previous identity nor applies its late acknowledgement", async () => {
  const pending = deferred(), calls = [];
  await withFetch((_url, options) => {
    calls.push(options);
    return options.method === "PATCH" ? pending.promise : Promise.resolve(response({ settings: { email_new_message: calls.length === 1 } }));
  }, async f => {
    await settle(); f.render(); control(f).props.onClick(); f.render();
    assert.equal(control(f).props.disabled, true);
    f.render("owner-b"); await settle(); f.render();
    assert.equal(calls[1].signal.aborted, true);
    assert.equal(control(f).props["aria-checked"], false);
    pending.resolve(response({ success: true, settings: { email_new_message: false } })); await settle(); f.render();
    assert.equal(control(f).props["aria-checked"], false);
    assert.equal(saved(f).length, 0);
  });
});
