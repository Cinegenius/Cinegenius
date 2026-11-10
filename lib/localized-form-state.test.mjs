import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createTranslator } from "use-intl/core";
import { canonicalProjectCategoryId } from "./project-category-filter.ts";
import * as projectTypeLabels from "./project-type-labels.ts";

const require = createRequire(import.meta.url);
const jsxRuntime = require("react/jsx-runtime");
const locales = ["de", "en", "es", "it", "cs", "hu", "nl", "nl-BE", "sv"];
const messages = Object.fromEntries(locales.map(locale => [locale,
  JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"))]));

const inquiryTypes = [
  ["Spielfilm", "Ui.text_031b1c1fc4b241"],
  ["Kurzfilm", "Ui.text_75b346d26e4973"],
  ["Werbung", "home.showcaseAds"],
  ["Musikvideo", "projects.catMusikvideo"],
  ["Dokumentarfilm", "Ui.text_e2dec20c086399"],
  ["Corporate", "projects.catCorporate"],
  ["TV / Episodic", "Ui.text_13faef85f075ea"],
  ["Sonstiges", "profile.typeOther"],
];
const projectCategories = [
  ["film", "Film & Serie", "projects.catFilmSerie", "Serie"],
  ["werbung", "Werbung", "home.showcaseAds", "Werbung"],
  ["foto", "Foto & Shooting", "projects.catFoto", "Foto"],
  ["social-media", "Social Media", "home.showcaseSocial", "TikTok"],
  ["musikvideo", "Musikvideo", "projects.catMusikvideo", "Musikvideo"],
  ["dokumentation", "Dokumentation", "projects.catDokumentation", "Dokumentation"],
  ["corporate", "Corporate", "projects.catCorporate", "Corporate"],
  ["event", "Event & Live", "projects.catEvent", "Event"],
];
const projects = projectCategories.flatMap(([id, , , type]) => [1, 2].map(number => ({
  id: `${id}-${number}`, title: `${id} fixture ${number}`, year: 2026, type,
  director: "Member's own name", poster_url: null, crew_count: number,
})));

function translator(locale, namespace) {
  return createTranslator({ locale, messages: messages[locale], namespace, onError(error) { throw error; } });
}

const compiledComponents = new Map();
function componentCode(relative) {
  if (!compiledComponents.has(relative)) compiledComponents.set(relative, ts.transpileModule(
    readFileSync(new URL(`../${relative}`, import.meta.url), "utf8"),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
  ).outputText);
  return compiledComponents.get(relative);
}

function elements(tree, predicate, found = []) {
  if (Array.isArray(tree)) tree.forEach(child => elements(child, predicate, found));
  else if (tree && typeof tree === "object") {
    if (predicate(tree)) found.push(tree);
    elements(tree.props?.children, predicate, found);
  }
  return found;
}
function textContent(tree) {
  if (tree == null || typeof tree === "boolean") return "";
  if (Array.isArray(tree)) return Array.from(tree, textContent).join("");
  return typeof tree === "object" ? textContent(tree.props?.children) : String(tree);
}

/** Execute the actual client component with persistent hooks and real ICU formatting.
 * Nested components are represented by real React elements; no DOM or network is used. */
function fixture(relative, props, { locale = "de", view = {} } = {}) {
  let currentLocale = locale;
  let cursor = 0;
  let dirty = false;
  let effects = [];
  const hooks = [];
  const fields = new Map(Object.entries(view));
  const fieldSetters = new Map();
  const viewWrites = [];
  const requests = [];
  const sameDependencies = (before, after) => Array.isArray(before) && Array.isArray(after)
    && before.length === after.length && after.every((value, index) => Object.is(value, before[index]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!hooks[index]) {
        hooks[index] = { value: typeof initial === "function" ? initial() : initial };
        hooks[index].set = next => {
          const value = typeof next === "function" ? next(hooks[index].value) : next;
          if (!Object.is(value, hooks[index].value)) { hooks[index].value = value; dirty = true; }
        };
      }
      return [hooks[index].value, hooks[index].set];
    },
    useRef(initial) {
      const index = cursor++;
      hooks[index] ??= { current: initial };
      return hooks[index];
    },
    useMemo(callback, dependencies) {
      const index = cursor++;
      if (!sameDependencies(hooks[index]?.dependencies, dependencies)) hooks[index] = { dependencies: [...dependencies], value: callback() };
      return hooks[index].value;
    },
    useEffect(callback, dependencies) {
      const index = cursor++;
      if (!sameDependencies(hooks[index]?.dependencies, dependencies)) {
        hooks[index] = { dependencies: dependencies && [...dependencies] };
        effects.push(callback);
      }
    },
  };
  const viewState = (field, initial) => {
    if (!fields.has(field)) fields.set(field, typeof initial === "function" ? initial() : initial);
    if (!fieldSetters.has(field)) fieldSetters.set(field, next => {
      const value = typeof next === "function" ? next(fields.get(field)) : next;
      viewWrites.push({ field, value });
      if (!Object.is(value, fields.get(field))) { fields.set(field, value); dirty = true; }
    });
    return [fields.get(field), fieldSetters.get(field)];
  };
  const imports = {
    react,
    "react/jsx-runtime": jsxRuntime,
    "next-intl": { useTranslations: namespace => translator(currentLocale, namespace), useLocale: () => currentLocale },
    "next/navigation": { useRouter: () => ({ push() {} }) },
    "next/link": { default: "test-link" },
    "@clerk/nextjs": { useUser: () => ({ user: { id: "test-user" }, isLoaded: true }) },
    "lucide-react": new Proxy({}, { get: (_, name) => `test-icon-${String(name)}` }),
    "@/lib/use-view-state": { useViewState: viewState },
    "@/lib/project-category-filter": { canonicalProjectCategoryId },
    "@/lib/project-type-labels": projectTypeLabels,
    "@/lib/ui-error-message": { uiErrorMessage: (error, fallback) => error?.message ?? fallback },
    "@/components/MobileBrowseControls": {
      default: "test-browse-controls", MobileFilterField: "test-filter-field", MobileFilterSelect: "test-filter-select",
    },
  };
  const exports = {};
  runInNewContext(componentCode(relative), {
    exports,
    require(name) { assert.ok(Object.hasOwn(imports, name), `Unexpected component import ${name}`); return imports[name]; },
    fetch: async (url, request) => { requests.push({ url, request }); return { ok: true, json: async () => ({}) }; },
  });
  return {
    requests, viewWrites, fields,
    setLocale(next) { currentLocale = next; },
    render() {
      let tree;
      for (let pass = 0; pass < 20; pass++) {
        cursor = 0; dirty = false; effects = [];
        tree = exports.default(props);
        effects.forEach(effect => effect());
        if (!dirty) return tree;
      }
      assert.fail("Component effects did not settle after 20 renders");
    },
  };
}

const inquiryProps = { listingId: "listing-id", listingTitle: "Member-written listing", listingType: "location", ownerId: "owner-id", ownerName: "Member Name" };
const inquiryFixture = options => fixture("components/InquiryForm.tsx", inquiryProps, options);
const projectsFixture = options => fixture("app/projects/ProjectsContent.tsx", { projects }, options);
const inquirySelect = tree => elements(tree, element => element.type === "select")[0];
const optionsOf = select => elements(select, element => element.type === "option");
const browseControls = tree => elements(tree, element => element.type === "test-browse-controls")[0].props;
function projectIds(tree) {
  return [...new Set(elements(tree, element => element.type === "test-link" && /^\/projects\//.test(element.props.href))
    .map(element => element.props.href.slice("/projects/".length)))];
}
function assertCategory(tree, locale, id, expectedIds = [`${id}-1`, `${id}-2`]) {
  const controls = browseControls(tree);
  const [, , key] = projectCategories.find(category => category[0] === id);
  assert.equal(controls.categoryValue, id);
  assert.equal(controls.categories.find(option => option.value === id).label, translator(locale)(key));
  assert.equal(controls.chips.find(chip => chip.id === "category").label, translator(locale)(key));
  assert.deepEqual(projectIds(tree), expectedIds);
}

test("project category canonicalization accepts exact stable IDs and known German history labels only", () => {
  for (const [id, legacy] of projectCategories) {
    assert.equal(canonicalProjectCategoryId(id), id);
    assert.equal(canonicalProjectCategoryId(legacy), id);
  }
  for (const value of [null, undefined, 0, false, {}, [], "", "unknown", "Advertising", "Film and series", "Werbung ", " werbung", "WERBUNG", "film-series", "__proto__", "constructor", "toString"]) {
    assert.equal(canonicalProjectCategoryId(value), null, `must not guess ${String(value)}`);
  }
});

for (const locale of locales) {
  test(`inquiry keeps stable option values and native ${locale} labels`, () => {
    const form = inquiryFixture({ locale });
    let tree = form.render();
    const t = translator(locale);
    assert.deepEqual(Array.from(optionsOf(inquirySelect(tree)), option => option.props.value), inquiryTypes.map(([id]) => id));
    assert.deepEqual(Array.from(optionsOf(inquirySelect(tree)), textContent), inquiryTypes.map(([, key]) => t(key)));
    assert.equal(inquirySelect(tree).props.value, "Spielfilm");
    for (const [id, key] of inquiryTypes) {
      inquirySelect(tree).props.onChange({ target: { value: id } });
      tree = form.render();
      assert.equal(inquirySelect(tree).props.value, id);
      assert.equal(textContent(optionsOf(inquirySelect(tree)).find(option => option.props.value === id)), t(key));
    }
  });

  test(`inquiry localizes its automatic ${locale} message after switching while preserving member text`, async () => {
    const form = inquiryFixture({ locale: "de" });
    const title = "Member's Film & Serie {original title}";
    const freeText = "Keep my Werbung and Short film exactly.\nSecond line:  two spaces; Čeština, svenska, magyar.";
    let tree = form.render();
    inquirySelect(tree).props.onChange({ target: { value: "Kurzfilm" } });
    elements(tree, element => element.type === "input")[0].props.onChange({ target: { value: title } });
    elements(tree, element => element.type === "textarea")[0].props.onChange({ target: { value: freeText } });
    form.setLocale(locale);
    tree = form.render();
    assert.equal(inquirySelect(tree).props.value, "Kurzfilm");
    assert.equal(elements(tree, element => element.type === "input")[0].props.value, title);
    assert.equal(elements(tree, element => element.type === "textarea")[0].props.value, freeText);
    await elements(tree, element => element.type === "form")[0].props.onSubmit({ preventDefault() {} });
    assert.equal(form.requests.length, 1);
    assert.equal(form.requests[0].url, "/api/conversations");
    const payload = JSON.parse(form.requests[0].request.body);
    const t = translator(locale);
    assert.equal(payload.content, [
      t("Ui.text_8d608163879370", { value1: title }),
      t("Ui.text_a1d9fa86c76302", { value1: t("Ui.text_75b346d26e4973") }),
      "", freeText,
    ].join("\n"));
    assert.equal(payload.listing_title, inquiryProps.listingTitle);
    assert.equal(payload.listing_id, inquiryProps.listingId);
    assert.equal(payload.receiver_id, inquiryProps.ownerId);
  });

  test(`project category selection uses IDs and native ${locale} chips through query and sort changes`, () => {
    const browser = projectsFixture({ locale });
    let tree = browser.render();
    assert.deepEqual(Array.from(browseControls(tree).categories, option => option.value), projectCategories.map(([id]) => id));
    for (const [id] of projectCategories) {
      browseControls(tree).onCategoryChange(id);
      tree = browser.render();
      assert.equal(browser.fields.get("projects.categoryChip"), id);
      assertCategory(tree, locale, id);
      browseControls(tree).onSortChange("crew_desc");
      tree = browser.render();
      assertCategory(tree, locale, id, [`${id}-2`, `${id}-1`]);
      browseControls(tree).onQueryChange(`${id} fixture`);
      tree = browser.render();
      assertCategory(tree, locale, id, [`${id}-2`, `${id}-1`]);
      browseControls(tree).onQueryChange("");
      browseControls(tree).onSortChange("year_desc");
      tree = browser.render();
    }
  });

  test(`known German project history labels migrate to IDs and filter immediately in ${locale}`, () => {
    for (const [id, legacy] of projectCategories) {
      const browser = projectsFixture({ locale, view: { "projects.categoryChip": legacy } });
      let tree = browser.render();
      assertCategory(tree, locale, id);
      assert.equal(browser.fields.get("projects.categoryChip"), id);
      assert.deepEqual(browser.viewWrites, [{ field: "projects.categoryChip", value: id }]);
      browseControls(tree).onSortChange("crew_desc");
      browseControls(tree).onQueryChange(`${id} fixture`);
      tree = browser.render();
      assertCategory(tree, locale, id, [`${id}-2`, `${id}-1`]);
    }
  });
}

test("all nine locale switches retain inquiry selection and unsaved member fields", () => {
  const form = inquiryFixture({ locale: "de" });
  let tree = form.render();
  const title = "Original {title}: Werbung";
  const message = "Original member message:  Kurzfilm\nMusic Video, never replace this.";
  inquirySelect(tree).props.onChange({ target: { value: "Musikvideo" } });
  elements(tree, element => element.type === "input")[0].props.onChange({ target: { value: title } });
  elements(tree, element => element.type === "textarea")[0].props.onChange({ target: { value: message } });
  for (const locale of [...locales, "de"]) {
    form.setLocale(locale);
    tree = form.render();
    const select = inquirySelect(tree);
    assert.equal(select.props.value, "Musikvideo");
    assert.equal(textContent(optionsOf(select).find(option => option.props.value === select.props.value)), translator(locale)("projects.catMusikvideo"));
    assert.equal(elements(tree, element => element.type === "input")[0].props.value, title);
    assert.equal(elements(tree, element => element.type === "textarea")[0].props.value, message);
  }
  assert.equal(form.requests.length, 0);
});

test("all nine locale switches preserve project IDs, selected labels and category filtering after recomputation", () => {
  const browser = projectsFixture({ locale: "de" });
  let tree = browser.render();
  browseControls(tree).onCategoryChange("werbung");
  tree = browser.render();
  for (const locale of [...locales, "de"]) {
    browser.setLocale(locale);
    tree = browser.render();
    assertCategory(tree, locale, "werbung");
    browseControls(tree).onSortChange("crew_desc");
    tree = browser.render();
    assertCategory(tree, locale, "werbung", ["werbung-2", "werbung-1"]);
    browseControls(tree).onQueryChange("werbung fixture");
    tree = browser.render();
    assertCategory(tree, locale, "werbung", ["werbung-2", "werbung-1"]);
    browseControls(tree).onQueryChange("");
    browseControls(tree).onSortChange("year_desc");
    tree = browser.render();
    assert.equal(browser.fields.get("projects.categoryChip"), "werbung");
  }
});

test("unknown saved project categories are not inferred, migrated or displayed as an active filter", () => {
  for (const unknown of ["Advertising", "Werbung ", "__proto__", "custom member category"]) {
    const browser = projectsFixture({ locale: "en", view: { "projects.categoryChip": unknown } });
    const tree = browser.render();
    const controls = browseControls(tree);
    assert.equal(controls.categoryValue, "");
    assert.equal(controls.chips.some(chip => chip.id === "category"), false);
    assert.equal(browser.fields.get("projects.categoryChip"), unknown);
    assert.deepEqual(browser.viewWrites, []);
    assert.equal(projectIds(tree).length, projects.length);
    controls.onCategoryChange(unknown);
    assert.equal(browser.fields.get("projects.categoryChip"), null);
  }
});
