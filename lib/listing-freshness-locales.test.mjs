import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse, TYPE } from "@formatjs/icu-messageformat-parser";
import { createTranslator } from "next-intl";
import { SUPPORTED_LOCALES } from "./i18n/locales.ts";

const namespaces = ["ListingFreshness", "AdminListingFreshness"];
const catalogs = Object.fromEntries(SUPPORTED_LOCALES.map(locale => [locale, JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"))]));
function flatten(object, prefix = "", result = {}) {
  for (const [key, value] of Object.entries(object)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") flatten(value, name, result);
    else result[name] = value;
  }
  return result;
}
const copy = locale => flatten(Object.fromEntries(namespaces.map(namespace => [namespace, catalogs[locale][namespace]])));
const base = copy("de");
function variables(message) {
  const values = new Map();
  function visit(nodes) {
    for (const node of nodes) {
      // Hungarian uses the same day noun for every number; its native source
      // legitimately interpolates days directly instead of an ICU plural.
      if ([TYPE.argument, TYPE.number, TYPE.date, TYPE.time, TYPE.select, TYPE.plural, TYPE.tag].includes(node.type)) values.set(node.value, node.value === "days" && [TYPE.argument, TYPE.plural].includes(node.type) ? TYPE.plural : node.type);
      if (node.options) for (const option of Object.values(node.options)) visit(option.value);
      if (node.children) visit(node.children);
    }
  }
  visit(parse(message));
  return [...values.entries()].sort(([first], [second]) => first.localeCompare(second));
}
const opaqueTitle = "Member als ‘title’ <xml> & 東京 {own_title}";
const opaqueName = "Zoë als Ana & <member> 東京";
const values = { title: opaqueTitle, name: opaqueName, date: "01/12/2026", days: 2, page: 2, pages: 12, count: 1000 };

for (const locale of SUPPORTED_LOCALES) {
  test(`${locale}: both freshness namespaces have every native key and exact ICU variable contracts`, () => {
    const actual = copy(locale);
    assert.equal(Object.keys(actual).length, 134);
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(base).sort());
    const t = createTranslator({ locale, messages: catalogs[locale], onError: error => { throw error; } });
    for (const [key, message] of Object.entries(actual)) {
      assert.equal(typeof message, "string", key); assert.ok(message.trim(), key);
      assert.deepEqual(variables(message), variables(base[key]), key);
      const rendered = t(key, values);
      assert.ok(rendered.trim(), key);
      assert.doesNotMatch(rendered, /MISSING_MESSAGE|INVALID_MESSAGE/, key);
      const vars = variables(message).map(([name]) => name);
      if (vars.includes("title")) assert.ok(rendered.includes(opaqueTitle), `${key}: member title preserved`);
      if (vars.includes("name")) assert.ok(rendered.includes(opaqueName), `${key}: member name preserved`);
    }
    for (const days of [1, 2, 730]) {
      const result = t("ListingFreshness.email.deadline", { days });
      assert.doesNotMatch(result, /\{days|\bplural\b|#/, String(days));
      if (days !== 1) assert.ok(result.includes(new Intl.NumberFormat(locale).format(days)), String(days));
    }
  });
}

test("the three new locales contain native freshness copy rather than untranslated German or English fallback", () => {
  // These words/greetings are independently native in both languages.
  const allowed = new Set(["ListingFreshness.email.signature", "AdminListingFreshness.notAvailable", "AdminListingFreshness.systemActor", "AdminListingFreshness.enabled", "ListingFreshness.email.greeting", "ListingFreshness.email.greetingNeutral"]);
  for (const locale of ["nl", "nl-BE", "sv"]) for (const [key, message] of Object.entries(copy(locale))) {
    if (allowed.has(key)) continue;
    assert.notEqual(message, base[key], `${locale}/${key}: German fallback`);
    assert.notEqual(message, copy("en")[key], `${locale}/${key}: English fallback`);
  }
  for (const locale of ["nl", "nl-BE"]) {
    const t = createTranslator({ locale, messages: catalogs[locale] });
    assert.equal(t("ListingFreshness.email.deadline", { days: 1 }), "Laat het ons binnen één dag weten.");
    assert.equal(t("ListingFreshness.email.deadline", { days: 2 }), "Laat het ons binnen 2 dagen weten.");
  }
  const t = createTranslator({ locale: "sv", messages: catalogs.sv });
  assert.equal(t("ListingFreshness.email.deadline", { days: 1 }), "Svara inom en dag.");
  assert.equal(t("ListingFreshness.email.deadline", { days: 2 }), "Svara inom 2 dagar.");
});
