import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { departments } from "./departments.ts";
import { CATERING_COMPANY_CATEGORY } from "./catering-taxonomy.ts";
import {
  buildQuickStartScreens,
  createQuickStartIntentData,
  findQuickStartRoles,
  getQuickStartDepartments,
  getQuickStartIntroIntents,
  getQuickStartProfileTypes,
  getQuickStartProfileTypesForRoles,
  normalizeQuickStartDraft,
  QUICK_START_CATEGORIES,
  QUICK_START_INTENTS,
  QUICK_START_SCREENS,
  START_QUICK_START_DRAFT,
  validateQuickStartDraft,
  validateQuickStartScreen,
  validateQuickStartIntentDetails,
} from "./quick-start-flow.ts";

function withIntent(intent) {
  return { ...START_QUICK_START_DRAFT, name: "Mara Muster", intents: [intent], activeIntent: intent, sections: { [intent]: createQuickStartIntentData() } };
}

test("new users always get the same six named steps and drafts start at step one", () => {
  assert.equal(START_QUICK_START_DRAFT.version, 3);
  assert.equal(START_QUICK_START_DRAFT.step, "name");
  assert.deepEqual(QUICK_START_SCREENS, ["name", "location", "goals", "details", "intro", "review"]);
  for (const intents of [[], ["search"], ["crew"], ["talent", "search"], ["location", "equipment", "company"], [...QUICK_START_INTENTS]]) {
    assert.deepEqual(buildQuickStartScreens({ ...START_QUICK_START_DRAFT, intents }).map(({ id }) => id), [...QUICK_START_SCREENS]);
  }
});

test("normalization preserves in-progress values while migrating older drafts to six steps", () => {
  const old = normalizeQuickStartDraft({ version: 2, step: "location-details", intents: ["location", "crew"], name: "Mara", personCity: "Berlin", sections: { location: { ...createQuickStartIntentData(), category: "Wohnen", title: "Altbau" }, crew: { ...createQuickStartIntentData(), departmentIds: ["kamera"], roles: [{ departmentId: "kamera", role: "A-Kamera Operator" }] } } });
  assert.equal(old.version, 3);
  assert.equal(old.step, "details");
  assert.equal(old.activeIntent, "location");
  assert.equal(old.name, "Mara");
  assert.equal(old.personCity, "Berlin");
  assert.equal(old.sections.location?.title, "Altbau");
  assert.equal(old.sections.crew?.roles[0]?.role, "A-Kamera Operator");
  const legacy = normalizeQuickStartDraft({ step: 2, intent: "location", name: "Lena", city: "Köln", category: "Wohnen", title: "Loft" });
  assert.equal(legacy.name, "Lena");
  assert.equal(legacy.sections.location?.city, "Köln");
  assert.equal(legacy.sections.location?.title, "Loft");
});

test("all supported departments, activities, and company categories remain available", () => {
  assert.deepEqual(getQuickStartDepartments().map(({ id }) => id), departments.filter((item) => item.id !== "cast" && item.roles.length > 0).map(({ id }) => id));
  assert.ok(getQuickStartDepartments().some((item) => item.id === "grip"));
  assert.ok(QUICK_START_CATEGORIES.company.some((item) => item.value === CATERING_COMPANY_CATEGORY.id));
  assert.ok(QUICK_START_CATEGORIES.location.some((item) => item.value === "Wohnen"));
  assert.ok(QUICK_START_CATEGORIES.equipment.some((item) => item.value === "Kameraequipment"));
  assert.ok(QUICK_START_INTENTS.includes("talent"));
});

test("optional step five shows a single personal profile panel and then each selected offer", () => {
  assert.deepEqual(getQuickStartIntroIntents(["crew", "talent", "location", "company", "search"]), ["crew", "location", "company"]);
  assert.deepEqual(getQuickStartIntroIntents(["talent", "equipment"]), ["talent", "equipment"]);
  assert.deepEqual(getQuickStartIntroIntents(["search"]), []);
});

test("occupation search includes synonyms and selects the correct department", () => {
  assert.ok(findQuickStartRoles("Key Grip").some((item) => item.departmentId === "grip"));
  assert.ok(findQuickStartRoles("Dolly Grip", 10, ["grip"]).some((item) => item.departmentId === "grip"));
  assert.equal(findQuickStartRoles("Model", 10, ["grip"]).length, 0);
  assert.ok(findQuickStartRoles("Schauspiel", 10, ["cast"]).some((item) => item.departmentId === "cast"));
  assert.ok(findQuickStartRoles("Caterer (Setbetreuung)").some((item) => item.departmentId === "catering-setverpflegung"));
  assert.ok(findQuickStartRoles("Craft Service", 10, ["catering-setverpflegung"]).length > 0);
});

test("multiple profile roles map to their matching profile types", () => {
  assert.ok(getQuickStartProfileTypes("cast", "Komparse").includes("extra"));
  assert.ok(getQuickStartProfileTypes("cast", "Model").includes("model"));
  assert.ok(getQuickStartProfileTypesForRoles([
    { departmentId: "cast", role: "Model" },
    { departmentId: "cast", role: "Komparse" },
    { departmentId: "kamera", role: "1st AC (Focus Puller)" },
  ]).includes("camera"));
  assert.ok(getQuickStartProfileTypesForRoles([
    { departmentId: "catering-setverpflegung", role: "Setkoch / Setköchin" },
    { departmentId: "catering-setverpflegung", role: "Craft Service" },
  ]).includes("production"));
});

test("each intent validates only the fields needed for that chosen path", () => {
  assert.equal(validateQuickStartScreen(START_QUICK_START_DRAFT, "name")?.field, "name");
  assert.equal(validateQuickStartScreen(withIntent("search"), "goals"), null);
  assert.equal(validateQuickStartScreen(withIntent("crew"), "location")?.field, "personCity");
  assert.equal(validateQuickStartIntentDetails(withIntent("crew"), "crew")?.field, "crew-departments");
  const crew = withIntent("crew");
  crew.sections.crew = { ...createQuickStartIntentData(), departmentIds: ["kamera"], roles: [{ departmentId: "kamera", role: "Kameraoperator/in" }] };
  assert.equal(validateQuickStartIntentDetails(crew, "crew"), null);
  assert.equal(validateQuickStartIntentDetails(withIntent("talent"), "talent")?.field, "talent-roles");
  const location = withIntent("location");
  location.sections.location = { ...createQuickStartIntentData(), category: "Wohnen", title: "Loft" };
  assert.equal(validateQuickStartIntentDetails(location, "location")?.field, "location-city");
  const company = withIntent("company");
  company.sections.company = { ...createQuickStartIntentData(), title: "Studio", city: "Berlin" };
  assert.equal(validateQuickStartIntentDetails(company, "company")?.field, "company-categories");
  assert.equal(validateQuickStartDraft({ ...withIntent("search"), name: "Sven" }), null);
});

test("setup review keeps new company visibility explicit and listings private", () => {
  const component = readFileSync(new URL("../components/ProfileSetupWizard.tsx", import.meta.url), "utf8");
  const listingsApi = readFileSync(new URL("../app/api/listings/route.ts", import.meta.url), "utf8");
  const companiesApi = readFileSync(new URL("../app/api/companies/route.ts", import.meta.url), "utf8");
  assert.match(component, /t\("stepCounter", \{current:currentIndex\+1,total:6\}\)/);
  assert.match(component, /draft: true/);
  assert.match(component, /t\("copy91"\)/);
  assert.match(component, /t\("copy96"\)/);
  assert.match(component, /activeIntroIndex < introIntents\.length - 1/);
  assert.match(component, /requestKeys\[intent\]/);
  assert.match(listingsApi, /onboarding_request_key/);
  assert.match(companiesApi, /onboarding_request_key\.replaceAll/);
  assert.match(companiesApi, /\.eq\("owner_user_id", userId\)/);
  assert.match(component, /categories: section\.categoryIds/);
  assert.match(component, /catering_details: section\.cateringDetails/);
});

test("unfinished setup resumes privately and completed searchers go to search", () => {
  const component = readFileSync(new URL("../components/ProfileSetupWizard.tsx", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../components/AppChrome.tsx", import.meta.url), "utf8");
  assert.match(component, /saved\?\.quickStart && saved\.setupComplete !== true/);
  assert.match(component, /cache: "no-store"/);
  assert.match(component, /setupComplete/);
  assert.match(component, /redirectTo \|\| "\/search"/);
  assert.match(dashboard, /<SetupStatusNotice \/>/);
  assert.match(shell, /pathname\.startsWith\("\/profile-setup"\)/);
  assert.match(shell, /if \(guidedSetup\)/);
});
