import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createTranslator } from "use-intl/core";
import * as projectLabels from "./project-type-labels.ts";
import * as jobMetadata from "./job-metadata.ts";
import * as projectCategories from "./project-category-filter.ts";
import * as projectBrowse from "./projects-browse.ts";
const { canonicalProjectCategoryId } = projectCategories;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const jsx = require("react/jsx-runtime");
const locales = ["de", "en", "es", "it", "cs", "hu", "nl", "nl-BE", "sv"];
const messages = Object.fromEntries(locales.map(locale => [locale, JSON.parse(readFileSync(`${root}/messages/${locale}.json`, "utf8"))]));
const translator = (locale, namespace) => createTranslator({ locale, messages: messages[locale], namespace, onError(error) { throw error; } });
const compiled = new Map();
function code(relative) {
  if (!compiled.has(relative)) compiled.set(relative, ts.transpileModule(readFileSync(`${root}/${relative}`, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText);
  return compiled.get(relative);
}
const pureModules = new Map();
function pure(relative) {
  if (relative.endsWith(".json")) return { default: JSON.parse(readFileSync(`${root}/${relative}`, "utf8")) };
  if (!relative.endsWith(".ts")) relative += ".ts";
  if (pureModules.has(relative)) return pureModules.get(relative);
  const exports = {};
  pureModules.set(relative, exports);
  runInNewContext(code(relative), { exports, require(name) {
    if (name.startsWith("@/")) return pure(name.slice(2));
    if (name.startsWith(".")) return pure(resolve(root, dirname(relative), name).slice(root.length + 1));
    return require(name);
  } });
  return exports;
}
const { FILM_DEPARTMENTS } = pure("lib/filmRoles.ts");
const { taxonomyLabel } = pure("lib/departments.ts");
const directorRole = FILM_DEPARTMENTS.find(department => department.id === "regie").roles.find(role => role.id === "regisseur");

function elements(tree, predicate, found = []) {
  if (Array.isArray(tree)) tree.forEach(child => elements(child, predicate, found));
  else if (tree && typeof tree === "object") {
    if (predicate(tree)) found.push(tree);
    elements(tree.props?.children, predicate, found);
  }
  return found;
}
function text(tree) {
  if (tree == null || typeof tree === "boolean") return "";
  if (Array.isArray(tree)) return Array.from(tree, text).join("");
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}
function links(tree, prefix) {
  return [...new Set(elements(tree, element => element.type === "test-link" && element.props.href.startsWith(prefix))
    .map(element => element.props.href.slice(prefix.length)))];
}
const controls = tree => elements(tree, element => element.type === "test-browse")[0].props;
const selects = tree => elements(tree, element => element.type === "test-select");

/** Real source components, persistent hook state and real ICU catalogs; every external I/O is mocked. */
function fixture(relative, initialProps, { locale = "de", view = {}, exportName = "default", extra = {} } = {}) {
  let activeLocale = locale, cursor = 0, dirty = false, effects = [], props = initialProps;
  const hooks = [], fields = new Map(Object.entries(view)), setters = new Map(), writes = [];
  const dependenciesEqual = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && b.every((value, index) => Object.is(value, a[index]));
  const react = {
    Suspense: "test-suspense",
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) {
        hooks[index] = { value: typeof initial === "function" ? initial() : initial };
        hooks[index].set = next => {
          const value = typeof next === "function" ? next(hooks[index].value) : next;
          if (!Object.is(value, hooks[index].value)) { hooks[index].value = value; dirty = true; }
        };
      }
      return [hooks[index].value, hooks[index].set];
    },
    useRef(initial) { const index = cursor++; return hooks[index] ??= { current: initial }; },
    useMemo(callback, dependencies) {
      const index = cursor++;
      if (!dependenciesEqual(hooks[index]?.dependencies, dependencies)) hooks[index] = { dependencies: [...dependencies], value: callback() };
      return hooks[index].value;
    },
    useLayoutEffect() {},
    useEffect(callback, dependencies) {
      const index = cursor++;
      if (!dependenciesEqual(hooks[index]?.dependencies, dependencies)) { hooks[index] = { dependencies: dependencies && [...dependencies] }; effects.push(callback); }
    },
  };
  react.default = react;
  const viewState = (field, initial) => {
    if (!fields.has(field)) fields.set(field, typeof initial === "function" ? initial() : initial);
    if (!setters.has(field)) setters.set(field, next => {
      const value = typeof next === "function" ? next(fields.get(field)) : next;
      writes.push({ field, value });
      if (!Object.is(fields.get(field), value)) { fields.set(field, value); dirty = true; }
    });
    return [fields.get(field), setters.get(field)];
  };
  const imports = {
    react, "react/jsx-runtime": Object.fromEntries(Object.entries(jsx).map(([key,value]) => [key, key === "jsx" || key === "jsxs" ? (type, props, ...rest) => type === "test-ProjectBrowseResults" ? fixture("components/ProjectBrowseResults.tsx", props, { locale: activeLocale }).render() : value(type, props, ...rest) : value])),
    "next-intl": { useLocale: () => activeLocale, useTranslations: namespace => translator(activeLocale, namespace) },
    "next/navigation": { useRouter: () => ({ refresh() {}, push() {}, replace() {} }), useSearchParams: () => new URLSearchParams() },
    "next/link": { default: "test-link" },
    "lucide-react": new Proxy({}, { get: (_, name) => `test-icon-${String(name)}` }),
    "@clerk/nextjs": { useAuth: () => ({ userId: null, isLoaded: true }), useUser: () => ({ user: null, isLoaded: true }) },
    "@/lib/use-view-state": { useViewState: viewState },
    "@/lib/use-view-url": { useViewUrl() {} },
    "@/lib/use-form-router": { useFormRouter: () => ({ push() {}, refresh() {} }) },
    "@/lib/use-form-draft": { useFormDraft: () => ({ loaded: true }), useUnsavedForm() {} },
    "@/contexts/FormDraftContext": { useFormNavigation: () => ({ leave() {} }) },
    "@/lib/project-category-filter": projectCategories,
    "@/lib/projects-browse": projectBrowse,
    "@/lib/project-type-labels": projectLabels,
    "@/lib/job-metadata": jobMetadata,
    "@/lib/job-occupation": pure("lib/job-occupation.ts"),
    "@/lib/browse-geography": pure("lib/browse-geography.ts"),
    "@/lib/use-browse-geography": { useBrowseGeography: () => ({ preferred: null, key: "guest", setEnabled() {} }) },
    "@/lib/departments": pure("lib/departments.ts"),
    "@/lib/filmRoles": pure("lib/filmRoles.ts"),
    "@/lib/animal-taxonomy": pure("lib/animal-taxonomy.ts"),
    "@/lib/gripTaxonomy": pure("lib/gripTaxonomy.ts"),
    "@/lib/places/core": { countryName: code => code, placeOptions: () => [], browsePlaceOptions: () => [], UNASSIGNED_COUNTRY: 'unassigned', canonicalFilterValue: value => value, placeSearchMatches: () => false, matchesPlace: () => true, placeDisplay: (_row, value) => value },
    "@/components/ProjectBrowseResults": { default: "test-ProjectBrowseResults" },
    "@/components/MobileBrowseControls": { default: "test-browse", MobileFilterField: "test-field", MobileFilterSelect: "test-select" },
    ...extra,
  };
  const exports = {};
  runInNewContext(code(relative) + (exportName === "default" ? "" : `\nexports.testComponent = ${exportName};`), {
    exports, URL, URLSearchParams, queueMicrotask: callback => callback(),
    document: { addEventListener() {}, removeEventListener() {} },
    fetch() { assert.fail("Rendering must not call a live endpoint"); },
    require(name) {
      if (Object.hasOwn(imports, name)) return imports[name];
      if (name.startsWith("@/components/")) return { default: `test-${name.slice(14)}` };
      if (name.startsWith("@/lib/")) return new Proxy({}, { get: (_, key) => () => assert.fail(`Unexpected library call ${name}.${String(key)}`) });
      assert.fail(`Unexpected dependency ${name}`);
    },
  });
  return {
    fields, writes, setLocale(next) { activeLocale = next; }, setProps(next) { props = next; },
    render() {
      for (let pass = 0; pass < 20; pass++) {
        cursor = 0; dirty = false; effects = [];
        const tree = exports[exportName === "default" ? "default" : "testComponent"](props);
        effects.forEach(effect => effect());
        if (!dirty) return tree;
      }
      assert.fail("Component state did not settle");
    },
  };
}

const job = (id, projectType, payType, extra = {}) => ({
  id, title: `Member title ${id}`, projectType: "Film", company: "Member company", location: "Member location",
  rate: "250 €", tags: [], urgent: false, isReal: true,
  description: `Rolle: Regisseur/in · Produktion: Member company · Typ: ${projectType} · Vergütung: ${payType}\n\nMember's original description / 42`,
  ...extra,
});
const jobs = [job("paid-short", "Kurzfilm", "Bezahlt"), job("paid-feature", "Spielfilm", "Paid"), job("deferred", "Kurzfilm", "Deferred Pay"), job("expenses", "Kurzfilm", "Spesen & Reise"), job("voluntary", "Kurzfilm", "Ehrenamtlich / Übung")];
const projects = [
  { id: "short", title: "Member title", year: 2026, type: "Kurzfilm", director: "Member director", poster_url: null, crew_count: 0 },
  { id: "feature", title: "Other member title", year: 2025, type: "Spielfilm", director: "Other director", poster_url: null, crew_count: 1 },
  { id: "custom", title: "Custom member title", year: 2024, type: "Member's own format / 42", director: "Member director", poster_url: null, crew_count: 0 },
];

for (const locale of locales) {
  test(`${locale}: real Jobs filters combine type and pay aliases, with native labels and unchanged IDs through a language switch`, () => {
    const before = JSON.stringify(jobs), browser = fixture("app/jobs/JobsContent.tsx", { serverJobs: jobs }, {
      locale, exportName: "JobsInner", view: { "jobs.activeType": "Kurzfilm", "jobs.payTypeFilter": "Paid" },
    });
    let tree = browser.render();
    assert.deepEqual(links(tree, "/jobs/"), ["paid-short"]);
    let mobile = selects(tree);
    assert.equal(mobile.find(select => select.props.value === "Kurzfilm").props.options.find(option => option.value === "Kurzfilm").label, translator(locale)("Ui.text_75b346d26e4973"));
    assert.equal(mobile.find(select => select.props.value === "Paid").props.options.find(option => option.value === "Paid").label, translator(locale)("Ui.text_057b27bdbc5519"));
    assert.equal(controls(tree).chips.find(chip => chip.id === "type").label, translator(locale)("Ui.text_75b346d26e4973"));
    assert.equal(controls(tree).chips.find(chip => chip.id === "pay").label, translator(locale)("Ui.text_057b27bdbc5519"));
    assert.ok(text(tree).includes(taxonomyLabel("Regisseur/in", translator(locale))));
    for (const [value, expected] of [["Kurzfilm", translator(locale)("Ui.text_75b346d26e4973")], ["Paid", translator(locale)("Ui.text_057b27bdbc5519")]]) {
      const sharedControls = selects(tree).filter(select => select.props.value === value);
      assert.equal(sharedControls.length, 1, "One filter panel serves desktop and mobile");
      for (const control of sharedControls) assert.equal(control.props.options.find(option => option.value === value).label, expected);
    }
    browser.setLocale(locale === "en" ? "hu" : "en");
    tree = browser.render();
    assert.deepEqual(links(tree, "/jobs/"), ["paid-short"]);
    assert.equal(browser.fields.get("jobs.activeType"), "Kurzfilm");
    assert.equal(browser.fields.get("jobs.payTypeFilter"), "Paid");
    controls(tree).onSortChange("rate-desc");
    tree = browser.render();
    assert.deepEqual(links(tree, "/jobs/"), ["paid-short"]);
    controls(tree).onReset();
    tree = browser.render();
    assert.deepEqual(links(tree, "/jobs/"), jobs.map(value => value.id));
    const nextLocale = locale === "en" ? "hu" : "en";
    controls(tree).onQueryChange(translator(nextLocale)("Ui.text_75b346d26e4973"));
    tree = browser.render();
    assert.deepEqual(links(tree, "/jobs/"), ["paid-short", "deferred", "expenses", "voluntary"]);
    controls(tree).onQueryChange(taxonomyLabel("Regisseur/in", translator(nextLocale)));
    assert.deepEqual(links(browser.render(), "/jobs/"), jobs.map(value => value.id));
    assert.equal(JSON.stringify(jobs), before);
  });

  test(`${locale}: Projects filter, all card views and chips localize known types while retaining custom member values`, () => {
    const before = JSON.stringify(projects), browser = fixture("app/projects/ProjectsContent.tsx", { projects }, { locale });
    let tree = browser.render();
    const typeSelect = selects(tree).find(select => select.props.options.some(option => option.value === "Kurzfilm"));
    assert.deepEqual(new Set(typeSelect.props.options.map(option => option.value)), new Set(projects.map(project => project.type)));
    const native = translator(locale)("Ui.text_75b346d26e4973");
    assert.equal(typeSelect.props.options.find(option => option.value === "Kurzfilm").label, native);
    assert.equal(typeSelect.props.options.find(option => option.value === projects[2].type).label, projects[2].type);
    typeSelect.props.onChange("Kurzfilm");
    tree = browser.render();
    assert.deepEqual(links(tree, "/projects/"), ["short"]);
    assert.equal(controls(tree).chips.find(chip => chip.id === "type").label, native);
    assert.ok(text(tree).includes(native));
    const sharedType = selects(tree).find(element => element.props.value === "Kurzfilm");
    assert.equal(sharedType.props.options.find(option => option.value === "Kurzfilm").label, native);
    elements(controls(tree).viewControls, element => element.type === "button" && element.props["aria-label"] === translator(locale)("Ui.text_2cc48b15f4ffeb"))[0].props.onClick();
    tree = browser.render();
    assert.equal(browser.fields.get("projects.view"), "grid");
    assert.ok(text(tree).includes(native));
    assert.deepEqual(links(tree, "/projects/"), ["short"]);
    browser.setLocale(locale === "en" ? "sv" : "en");
    tree = browser.render();
    assert.equal(browser.fields.get("projects.typeFilter"), "Kurzfilm");
    assert.deepEqual(links(tree, "/projects/"), ["short"]);
    controls(tree).onSortChange("title_asc");
    tree = browser.render();
    assert.deepEqual(links(tree, "/projects/"), ["short"]);
    controls(tree).onReset();
    tree = browser.render();
    assert.ok(text(tree).includes(projects[2].type));
    controls(tree).onQueryChange(projectLabels.projectTypeLabel("Kurzfilm", translator(locale === "en" ? "sv" : "en")));
    assert.deepEqual(links(browser.render(), "/projects/"), ["short"]);
    assert.equal(JSON.stringify(projects), before);
  });

  test(`${locale}: actual RoleDropdown searches native labels plus original aliases and emits the original stable role value`, () => {
    const selections = [], role = { ...directorRole, aliases: [...(directorRole.aliases ?? []), "Established role alias 42"] };
    const browser = fixture("app/inserat/page.tsx", { value: role.label, options: [role], onChange: value => selections.push(value) }, { locale, exportName: "RoleDropdown" });
    let tree = browser.render();
    const native = taxonomyLabel(role.label, translator(locale));
    assert.ok(text(tree).includes(native));
    elements(tree, element => element.type === "button" && element.props["aria-haspopup"] === "listbox")[0].props.onClick();
    for (const query of [native, role.label, role.labelEn, "Established role alias 42"]) {
      tree = browser.render();
      elements(tree, element => element.type === "input")[0].props.onChange({ target: { value: query } });
      tree = browser.render();
      const option = elements(tree, element => element.props?.role === "option")[0];
      assert.ok(option, `${locale}: query ${query}`);
      assert.equal(option.props["aria-selected"], true);
      assert.ok(text(option).includes(native));
    }
    browser.setLocale(locale === "en" ? "cs" : "en");
    tree = browser.render();
    elements(tree, element => element.type === "input")[0].props.onChange({ target: { value: "" } });
    tree = browser.render();
    elements(tree, element => element.props?.role === "option")[0].props.onClick();
    assert.deepEqual(selections, [role.label]);
    browser.setProps({ value: "Member's unlisted occupation", options: [role], onChange() {} });
    assert.ok(text(browser.render()).includes("Member's unlisted occupation"));
  });

  test(`${locale}: public JobDetail and ProjectDetail retain member copy and localize only curated format/pay facts`, () => {
    const detailJob = { ...jobs[0], company: "Untranslated member company", projectType: "Kurzfilm", payType: "Bezahlt", description: "Original member description / 42", union: "", shootDates: "", posted: "" };
    const jobBrowser = fixture("components/JobDetail.tsx", { job: detailJob }, { locale });
    const before = JSON.stringify(detailJob), tree = jobBrowser.render();
    assert.ok(text(tree).includes(translator(locale)("Ui.text_75b346d26e4973")));
    assert.ok(text(tree).includes(translator(locale)("Ui.text_057b27bdbc5519")));
    assert.ok(text(tree).includes(detailJob.company));
    assert.ok(text(tree).includes(detailJob.description));
    assert.equal(JSON.stringify(detailJob), before);
    const detailProject = { ...projects[0], description: "Original project description", created_by: "another-member", images: [], release_streaming: [], release_tv: [] };
    const projectBrowser = fixture("components/ProjectDetail.tsx", { project: detailProject, credits: [], festivals: [], currentUserId: null, myCredit: null }, { locale });
    let projectTree = projectBrowser.render();
    assert.ok(text(projectTree).includes(translator(locale)("Ui.text_75b346d26e4973")));
    elements(projectTree, element => element.type === "button" && text(element) === translator(locale)("nav.accountOverview"))[0].props.onClick();
    projectTree = projectBrowser.render();
    assert.ok(text(projectTree).includes(translator(locale)("Ui.text_75b346d26e4973")));
    assert.ok(text(projectTree).includes(detailProject.description));
    assert.equal(detailProject.type, "Kurzfilm");
  });

  test(`${locale}: unknown saved job formats and pay values remain visible, selectable and searchable verbatim`, () => {
    const custom = job("custom", "Member format / 42", "Member pay / 42");
    const before = JSON.stringify(custom);
    const browser = fixture("app/jobs/JobsContent.tsx", { serverJobs: [custom, ...jobs] }, {
      locale, exportName: "JobsInner", view: { "jobs.activeType": "Member format / 42", "jobs.payTypeFilter": "Member pay / 42" },
    });
    const tree = browser.render();
    assert.deepEqual(links(tree, "/jobs/"), ["custom"]);
    for (const value of ["Member format / 42", "Member pay / 42"]) {
      const select = selects(tree).find(select => select.props.value === value);
      assert.equal(select.props.options.find(option => option.value === value).label, value);
    }
    assert.ok(text(tree).includes("Member format / 42"));
    browser.setLocale(locale === "en" ? "hu" : "en");
    assert.deepEqual(links(browser.render(), "/jobs/"), ["custom"]);
    assert.equal(JSON.stringify(custom), before);
  });
}

for (const [filter, stored] of [["Paid", "Bezahlt"], ["Deferred", "Deferred Pay"], ["Expenses Only", "Spesen & Reise"], ["Ehrenamtlich", "Ehrenamtlich / Übung"]]) {
  test(`legacy pay filter ${filter} and stored writer value ${stored} select the same jobs`, () => {
    for (const locale of locales) for (const selection of [filter, stored]) {
      const browser = fixture("app/jobs/JobsContent.tsx", { serverJobs: jobs }, { locale, exportName: "JobsInner", view: { "jobs.activeType": "Kurzfilm", "jobs.payTypeFilter": selection } });
      const tree = browser.render();
      const expected = jobs.filter(job => jobMetadata.parseJobDescription(job.description).payType === stored).map(job => job.id);
      assert.deepEqual(links(tree, "/jobs/"), expected);
      assert.ok(selects(tree).some(select => select.props.value === filter));
      assert.equal(browser.fields.get("jobs.payTypeFilter"), selection, "Reading a legacy filter must not mutate saved state");
    }
  });
}

test("unknown formats, pay values and member prose are preserved exactly", () => {
  for (const locale of locales) for (const value of ["Member-defined format / 42", "constructor", "__proto__", "", "Kurzfilm by a member"]) {
    assert.equal(projectLabels.projectTypeLabel(value, translator(locale)), value);
    assert.equal(jobMetadata.jobPayLabel(value, translator(locale)), value);
    assert.equal(jobMetadata.canonicalJobPayType(value), value);
  }
  const prose = "Member's exact first paragraph\n\nSecond paragraph in another language\n\nFinal paragraph";
  const raw = `Rolle: Regisseur/in · Projekttyp: Kurzfilm · Vergütung: Bezahlt\n\n${prose}`;
  assert.equal(jobMetadata.parseJobDescription(raw).projectType, "Kurzfilm");
  assert.equal(jobMetadata.parseJobDescription(raw).description, prose);
  assert.equal(jobMetadata.parseJobDescription("One untouched paragraph").description, "One untouched paragraph");
});

test("all native project labels have stable values and locale-alphabetical filter ordering", () => {
  const values = ["Spielfilm", "Kurzfilm", "Serie", "Dokumentation", "Werbefilm", "Imagefilm", "Musikvideo", "Corporate", "Social Media", "Foto / Shooting", "Event", "Sonstiges", "TV / Serie", "Dokumentarfilm", "Instagram / Reels", "TikTok", "YouTube", "UGC Content", "Brand Content", "Fashion Shooting", "Produkt-Shooting", "Event-Fotografie", "Hochzeits-Fotografie", "Portrait-Shooting", "Werbe-Fotografie"];
  for (const locale of locales) {
    const options = projectLabels.projectTypeOptions(values, translator(locale), locale);
    assert.deepEqual(new Set(options.map(option => option.value)), new Set(values));
    assert.deepEqual(options.map(option => option.label), options.map(option => option.label).toSorted(new Intl.Collator(locale, { sensitivity: "base" }).compare));
    assert.equal(options.find(option => option.value === "Brand Content").label, messages[locale].ProjectTypeLabels.brandContent);
    assert.equal(options.find(option => option.value === "Hochzeits-Fotografie").label, messages[locale].ProjectTypeLabels.weddingPhotography);
  }
});

/** Server page adapters see synthetic rows only; a write or a real dependency fails immediately. */
function server(relative, locale, rows, extras = {}) {
  const reads = [];
  const db = { from(table) {
    reads.push(table);
    const response = { data: rows[table] ?? [], error: null };
    const query = { select() { return query; }, eq() { return query; }, order() { return query; }, limit() { return Promise.resolve(response); }, range(from,to) { return Promise.resolve({...response,data:response.data.slice(from,to+1)}); }, maybeSingle() { return Promise.resolve({ ...response, data: response.data[0] ?? null }); }, then(resolve) { return Promise.resolve(response).then(resolve); } };
    return query;
  } };
  const exports = {}, imports = {
    "react/jsx-runtime": jsx,
    "next-intl/server": { getTranslations: async namespace => translator(locale, namespace), getLocale: async () => locale },
    "next/navigation": { notFound() { assert.fail("Unexpected notFound"); } },
    "next/link": { default: "test-link" },
    "lucide-react": new Proxy({}, { get: (_, name) => `test-icon-${String(name)}` }),
    "@clerk/nextjs/server": { auth() { assert.fail("Public metadata must not authenticate a real session"); } },
    "@/lib/db": { db },
    "@/lib/projects-browse-server": { getBrowseProjects: async () => rows.projects ?? [] },
    "@/lib/project-category-filter": projectCategories,
    "@/app/projects/ProjectsContent": { default: "test-project-browser" },
    "@/lib/project-type-labels": projectLabels,
    "@/lib/job-metadata": jobMetadata,
    "@/lib/job-occupation": pure("lib/job-occupation.ts"),
    "@/lib/browse-geography": pure("lib/browse-geography.ts"),
    "@/lib/use-browse-geography": { useBrowseGeography: () => ({ preferred: null, key: "guest", setEnabled() {} }) },
    "@/lib/places/catalog": { placeReadFields: value => ({ city: value }) },
    "@/lib/project-media-rights": { publicProjectMedia: value => value },
    "@/lib/departments": { departments: [] },
    "@/lib/linked-profile-access": { visibleLinkedProfileIds: async () => new Set() },
    "@/lib/guards": { isAdminSession: async () => false },
    "@/lib/project-record": { toPublicProjectRecord: value => value },
    ...extras,
  };
  runInNewContext(code(relative), { exports, URL, Date, require(name) {
    if (Object.hasOwn(imports, name)) return imports[name];
    if (name.startsWith("@/components/") || name === "./JobsContent") return { default: "test-server-child" };
    assert.fail(`Unexpected server dependency ${name}`);
  } });
  return { ...exports, reads };
}

for (const locale of locales) test(`${locale}: server Jobs adapter and project/job public metadata use native display facts without changing canonical values`, async () => {
  const listing = { id: "synthetic-job", title: "Member's title", city: "Member city", description: jobs[0].description, price: 250, created_at: "2026-01-01T00:00:00Z" };
  const before = JSON.stringify(listing);
  const browse = server("app/jobs/page.tsx", locale, { listings: [listing] });
  const page = await browse.default();
  const browseJobs = elements(page, element => Array.isArray(element.props?.serverJobs))[0].props.serverJobs;
  assert.equal(jobMetadata.jobFacts(browseJobs[0]).projectType, "Kurzfilm");
  assert.equal(browseJobs[0].id, listing.id);
  const detail = server("app/jobs/[slug]/page.tsx", locale, { listings: [listing] });
  const metadata = await detail.generateMetadata({ params: Promise.resolve({ slug: listing.id }), searchParams: Promise.resolve({}) });
  assert.ok(metadata.description.includes(translator(locale)("Ui.text_75b346d26e4973")));
  const legacyDetail = server("app/jobs/[slug]/page.tsx", locale, { listings: [{ ...listing, description: "Untouched member prose without metadata" }] });
  const legacyTree = await legacyDetail.default({ params: Promise.resolve({ slug: listing.id }), searchParams: Promise.resolve({}) });
  const legacyJob = elements(legacyTree, element => element.props?.job)[0].props.job;
  assert.equal(jobMetadata.jobFacts(legacyJob).urgent, false);
  assert.equal(legacyJob.projectType, "");
  assert.equal(legacyJob.description, "Untouched member prose without metadata");
  const category = server("components/ProjectCategoryPage.tsx", locale, { projects });
  const categoryTree = await category.default({ config: { slug: "film", label: "Synthetic category", typeKeywords: ["Kurzfilm"], headline: "", highlight: "", description: "", badge: "", image: "/fixture.jpg" } });
  const categoryProps = elements(categoryTree, element => element.type === "test-project-browser")[0].props;
  assert.equal(categoryProps.category, "film");
  const categoryResults = fixture("app/projects/ProjectsContent.tsx", categoryProps, { locale }).render();
  assert.ok(text(categoryResults).includes(translator(locale)("Ui.text_75b346d26e4973")));
  assert.deepEqual(links(categoryResults, "/projects/").filter(id => projects.some(project => project.id === id)), ["short", "feature"]);
  const detailProject = { ...projects[0], description: null };
  const project = server("app/projects/[id]/page.tsx", locale, { project_credits: [], project_festivals: [] }, { "@/lib/project-records-server": { getProjectRecord: async () => ({ kind: "found", project: detailProject }) } });
  const projectMetadata = await project.generateMetadata({ params: Promise.resolve({ id: "short" }) });
  assert.ok(projectMetadata.description.includes(translator(locale)("Ui.text_75b346d26e4973")));
  detailProject.description = "Member's exact custom summary";
  assert.equal((await project.generateMetadata({ params: Promise.resolve({ id: "short" }) })).description, detailProject.description);
  assert.equal(JSON.stringify(listing), before);
});
