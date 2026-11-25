import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import ts from "typescript";
import * as categories from "./project-category-filter.ts";
import * as labels from "./project-type-labels.ts";
import * as browse from "./projects-browse.ts";
import * as places from "./places/core.ts";
import * as geography from "./browse-geography.ts";
import { intlClientFor, translatorFor } from "./i18n-test-fixture.mjs";

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(new URL("../app/projects/ProjectsContent.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const project = (id, values = {}) => ({
  id, title: id, year: 2020, type: "Kurzfilm", director: "Zoe", place_country_code: "DE",
  poster_url: null, crew_count: 0, updated_at: null, created_at: null, ...values,
});
const projects = [
  project("cafe-2", { title: "Café 2", crew_count: 2 }),
  project("cafe-10", { title: "Café 10", director: "Álvaro", crew_count: 10 }),
  project("france", { title: "Café France", director: "André", place_country_code: "FR" }),
  project("future", { title: "Future", year: 2021, director: "Berta" }),
  project("advert", { title: "Café advert", type: "Werbefilm", director: "Carla" }),
  project("no-director", { director: null }),
  project("no-year", { title: "Archive", year: null, director: "Undated" }),
  project("no-country", { director: "Nomad", place_country_code: null }),
  project("no-facts", { year: null, director: null, type: null, place_country_code: null }),
];
function nodes(value, type, found = []) {
  if (Array.isArray(value)) value.forEach(child => nodes(child, type, found));
  else if (value?.props) {
    if (value.type === type) found.push(value);
    nodes(value.props.children, type, found);
  }
  return found;
}
const same = (a, b) => a?.length === b?.length && a.every((value, index) => Object.is(value, b[index]));

/** Exercise the actual shared screen with local data; no Next server or database. */
function fixture({ native = false, selected = {}, rows = projects, category = null, locale = "en", preferred = null } = {}) {
  const state = Object.fromEntries(Object.entries(selected).map(([field, value]) => [`projects.${field}`, value]));
  const setters = new Map(), changes = [], slots = [], pending = [];
  let tree, dirty = true, cursor = 0;
  const mocks = {
    react: { ...React, useMemo: create => create(), useEffect(create, deps) {
      const index = cursor++;
      if (!same(slots[index], deps)) { slots[index] = deps; pending.push(create); }
    } },
    "next-intl": intlClientFor(locale),
    "next/navigation": { useRouter: () => ({ push() {} }) },
    "next/link": "fixture-link",
    "@/components/BrowseGeography": { default: "fixture-geography", CountrySelect: "fixture-country" },
    "@/components/MobileBrowseControls": { default: "fixture-controls", MobileFilterField: "fixture-field", MobileFilterSelect: "fixture-select" },
    "@/components/ProjectBrowseResults": "fixture-web-results", "./NativeProjectResults": "fixture-native-results",
    "@/components/DirectoryViewControls": "fixture-views",
    "@/components/app/NativeBrowseToolbar": { NativeBrowseQuickFilter: "fixture-quick-filter" },
    "@/lib/use-native-app-appearance": { useNativeAppAppearance: () => native },
    "@/lib/use-browse-geography": { useBrowseGeography: () => ({ preferred, setEnabled() {} }) },
    "@/lib/use-view-state": { useViewState(field, initial) {
      if (!Object.hasOwn(state, field)) state[field] = initial;
      if (!setters.has(field)) setters.set(field, action => {
        const next = typeof action === "function" ? action(state[field]) : action;
        changes.push([field, next]);
        if (!Object.is(next, state[field])) { state[field] = next; dirty = true; }
      });
      return [state[field], setters.get(field)];
    } },
    "@/lib/project-category-filter": categories, "@/lib/project-type-labels": labels,
    "@/lib/projects-browse": browse, "@/lib/places/core": places, "@/lib/browse-geography": geography,
  };
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)(id => {
    const value = Object.hasOwn(mocks, id) ? mocks[id] : require(id);
    return value && typeof value === "object" && "default" in value ? { __esModule: true, ...value } : value;
  }, loaded, loaded.exports);
  const api = {
    state, changes,
    render() { cursor = 0; dirty = false; tree = loaded.exports.default({ projects: rows, category }); return api; },
    settle() {
      for (let attempt = 0; attempt < 8 && (dirty || pending.length); attempt++) {
        if (dirty) api.render();
        pending.splice(0).forEach(run => run());
      }
      assert.equal(dirty || pending.length > 0, false, "Filter reconciliation must reach a stable state");
      return api;
    },
    controls() { return nodes(tree, "fixture-controls")[0].props; },
    field(key) { return nodes(tree, "fixture-select").find(node => node.props.label === translatorFor(locale, "projects")(key)).props; },
    country(surface = native ? "nativePlaceFilters" : "placeFilters") { return nodes(api.controls()[surface], "fixture-country")[0].props; },
    results() { return nodes(tree, native ? "fixture-native-results" : "fixture-web-results")[0]?.props.projects ?? []; },
  };
  return api.settle();
}

for (const native of [false, true]) test(`${native ? "native" : "website"}: year 2020 offers only directors with projects in 2020`, () => {
  const f = fixture({ native, selected: { yearFilter: "2020" } });
  assert.deepEqual(f.field("filterDirector").options.map(option => option.value), ["Álvaro", "André", "Carla", "Nomad", "Zoe"]);
  assert.equal(f.controls().resultCount, 6);
  assert.equal(f.results().length, 6);
  assert.ok(f.results().some(row => row.id === "no-director"), "Missing director does not remove an otherwise matching project");
});

for (const native of [false, true]) test(`${native ? "native" : "website"}: search, country, year and type constrain each other while each facet retains its own alternatives`, () => {
  const f = fixture({ native, selected: { query: " CAFE ", country: "DE", yearFilter: "2020", typeFilter: "Kurzfilm", sort: "title_asc" } });
  assert.deepEqual(f.field("filterDirector").options.map(option => option.value), ["Álvaro", "Zoe"]);
  assert.deepEqual(f.field("filterType").options.map(option => option.value), ["Werbefilm", "Kurzfilm"]);
  assert.deepEqual(f.country().codes, ["FR", "DE"]);
  assert.deepEqual(f.country("nativePlaceFilters").codes, f.country("placeFilters").codes);
  assert.equal(f.country("nativePlaceFilters").value, "DE");
  assert.deepEqual(f.controls().nativeCategory.options, f.field("filterType").options);
  assert.equal(f.controls().nativeCategory.value, "Kurzfilm");
  assert.deepEqual(f.results().map(row => row.id), ["cafe-2", "cafe-10"]);
  assert.equal(f.controls().resultCount, 2);
  const selected = fixture({ native, selected: { yearFilter: "2020", country: "DE", typeFilter: "Kurzfilm", directorFilter: "Zoe" } });
  assert.deepEqual(selected.field("filterDirector").options.map(option => option.value), ["Álvaro", "Zoe"]);
  assert.equal(selected.field("filterDirector").value, "Zoe");
  assert.deepEqual(selected.results().map(row => row.id), ["cafe-2"]);
});

for (const native of [false, true]) test(`${native ? "native" : "website"}: changing year clears an incompatible director once and cannot restore it silently`, () => {
  const f = fixture({ native, selected: { yearFilter: "2020", directorFilter: "Zoe" } });
  f.field("filterYear").onChange("2021");
  f.render();
  assert.equal(f.field("filterDirector").value, "", "The first render already agrees with its available options");
  assert.deepEqual(f.results().map(row => row.id), ["future"]);
  f.settle();
  assert.equal(f.state["projects.directorFilter"], "");
  assert.deepEqual(f.changes.filter(([field]) => field === "projects.directorFilter"), [["projects.directorFilter", ""]]);
  assert.equal(f.controls().chips.some(chip => chip.id === "director"), false);
  f.field("filterYear").onChange("2020"); f.settle();
  assert.equal(f.field("filterDirector").value, "");
  assert.equal(f.results().length, 6);
});

test("missing year, country, type and director facts stay in unfiltered results without fake year/director options", () => {
  const snapshot = JSON.stringify(projects);
  const f = fixture();
  assert.equal(f.results().length, projects.length);
  assert.deepEqual(f.field("filterYear").options.map(option => option.value), ["2021", "2020"]);
  assert.ok(f.field("filterDirector").options.some(option => option.value === "Undated"));
  assert.equal(f.country().codes.includes(places.UNASSIGNED_COUNTRY), true);
  assert.equal(f.results().at(-1).year, null);
  const unassigned = fixture({ selected: { country: places.UNASSIGNED_COUNTRY, yearFilter: "2020" } });
  assert.deepEqual(unassigned.field("filterDirector").options, [{ value: "Nomad", label: "Nomad" }]);
  assert.deepEqual(unassigned.results().map(row => row.id), ["no-country"]);
  assert.equal(JSON.stringify(projects), snapshot, "No project identities or stored facts change");
});

test("category boundaries and translated type search use the same projects as results and geographic ordering", () => {
  const category = fixture({ category: "film", selected: { query: "short film", yearFilter: "2020" }, preferred: { country: "FR", region: "", city: "" } });
  assert.deepEqual(category.field("filterType").options.map(option => option.value), ["Kurzfilm"]);
  assert.deepEqual(category.field("filterDirector").options.map(option => option.value), ["Álvaro", "André", "Nomad", "Zoe"]);
  assert.equal(category.results()[0].id, "france");
  assert.equal(category.results().length, 5);
  assert.equal(category.controls().resultCount, 5);
});
