import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { departments } from "./departments.ts";
import {
  buildQuickStartScreens,
  findQuickStartRoles,
  getQuickStartDepartments,
  getQuickStartProfileTypes,
  getQuickStartProfileTypesForRoles,
  normalizeQuickStartDraft,
  QUICK_START_CATEGORIES,
  QUICK_START_INTENTS,
  START_QUICK_START_DRAFT,
  validateQuickStartDraft,
  validateQuickStartScreen,
} from "./quick-start-flow.ts";

function withIntent(intent) {
  return { ...START_QUICK_START_DRAFT, intents: [intent] };
}

test("new drafts start at the named first step and retain durable request keys", () => {
  assert.equal(START_QUICK_START_DRAFT.version, 2);
  assert.equal(START_QUICK_START_DRAFT.step, "name");
  assert.deepEqual(START_QUICK_START_DRAFT.intents, []);
  assert.deepEqual(START_QUICK_START_DRAFT.requestKeys, {});
  const normalized = normalizeQuickStartDraft({ ...START_QUICK_START_DRAFT, step: "not-a-step", requestKeys: { location: "invalid", equipment: "0792e3bb-6075-4670-aa90-d7be48b6c4e3" } });
  assert.equal(normalized.step, "name");
  assert.deepEqual(normalized.requestKeys, { equipment: "0792e3bb-6075-4670-aa90-d7be48b6c4e3" });
  assert.equal(validateQuickStartDraft(withIntent("search"))?.field, "name");
});

test("existing location and equipment categories remain available in onboarding", () => {
  assert.ok(QUICK_START_CATEGORIES.location.some((item) => item.value === "Wohnen"));
  assert.ok(QUICK_START_CATEGORIES.location.some((item) => item.value === "Gastronomie"));
  assert.ok(QUICK_START_CATEGORIES.equipment.some((item) => item.value === "Kameraequipment"));
  assert.ok(QUICK_START_CATEGORIES.equipment.some((item) => item.value === "Bild-Fahrzeug"));
});

test("all supported non-cast departments are available and cast has its own path", () => {
  assert.deepEqual(getQuickStartDepartments().map(({ id }) => id), departments.filter((item) => item.id !== "cast" && item.roles.length > 0).map(({ id }) => id));
  assert.ok(getQuickStartDepartments().some((item) => item.id === "grip"));
  assert.ok(QUICK_START_INTENTS.includes("talent"));
});

test("multiple selected goals produce a sequential, relevant flow with shared person location", () => {
  const draft = { ...START_QUICK_START_DRAFT, intents: ["crew", "talent", "location", "equipment", "company", "search"] };
  assert.deepEqual(buildQuickStartScreens(draft).map(({ id }) => id), [
    "name", "goals", "crew-departments", "crew-roles", "person-city", "talent-roles", "talent-intro",
    "location-category", "location-details", "location-photo", "location-price",
    "equipment-category", "equipment-details", "equipment-photo", "equipment-price",
    "company-details", "company-photo", "review",
  ]);
  assert.equal(buildQuickStartScreens({ ...draft, intents: ["search"] }).length, 3);
});

test("department and role searches include complete catalogue synonyms and honor the selected group", () => {
  assert.ok(findQuickStartRoles("Key Grip").some((item) => item.departmentId === "grip"));
  assert.ok(findQuickStartRoles("Dolly Grip", 10, ["grip"]).some((item) => item.departmentId === "grip"));
  assert.equal(findQuickStartRoles("Model", 10, ["grip"]).length, 0);
  assert.ok(findQuickStartRoles("Schauspiel", 10, ["cast"]).some((item) => item.departmentId === "cast"));
});

test("multiple crew and talent occupations map to all matching existing profile types", () => {
  assert.ok(getQuickStartProfileTypes("cast", "Komparse").includes("extra"));
  assert.ok(getQuickStartProfileTypes("cast", "Model").includes("model"));
  assert.ok(getQuickStartProfileTypesForRoles([
    { departmentId: "cast", role: "Model" },
    { departmentId: "cast", role: "Komparse" },
    { departmentId: "kamera", role: "1st AC (Focus Puller)" },
  ]).includes("camera"));
});

test("old in-progress drafts migrate without losing entered values", () => {
  const draft = normalizeQuickStartDraft({ step: 2, intent: "location", name: "Mara", city: "Berlin", category: "Wohnen", title: "Altbauwohnung" });
  assert.equal(draft.name, "Mara");
  assert.deepEqual(draft.intents, ["location"]);
  assert.equal(draft.sections.location?.city, "Berlin");
  assert.equal(draft.sections.location?.title, "Altbauwohnung");
  assert.equal(draft.sections.location?.category, "Wohnen");
});

test("each provider path validates only its own required fields", () => {
  assert.equal(validateQuickStartScreen(START_QUICK_START_DRAFT, "name")?.field, "name");
  assert.equal(validateQuickStartScreen(withIntent("search"), "goals"), null);
  assert.equal(validateQuickStartScreen(withIntent("crew"), "crew-departments")?.field, "crew-departments");
  assert.equal(validateQuickStartScreen({ ...withIntent("crew"), sections: { crew: { departmentIds: ["kamera"], roles: [], title: "", city: "", category: "", description: "", imageUrl: "", price: "", priceOnRequest: true } } }, "crew-roles")?.field, "crew-roles");
  assert.equal(validateQuickStartScreen(withIntent("talent"), "talent-roles")?.field, "talent-roles");
  assert.equal(validateQuickStartScreen({ ...withIntent("location"), sections: { location: { category: "Wohnen", title: "Loft", city: "", description: "", imageUrl: "", price: "", priceOnRequest: true, departmentIds: [], roles: [] } } }, "location-details")?.field, "location-city");
  assert.equal(validateQuickStartScreen({ ...withIntent("equipment"), sections: { equipment: { category: "Kameraequipment", title: "Kamera", city: "Berlin", description: "", imageUrl: "", price: "", priceOnRequest: false, departmentIds: [], roles: [] } } }, "equipment-price")?.field, "equipment-price");
  assert.equal(validateQuickStartScreen({ ...withIntent("company"), sections: { company: { category: "", title: "Studio", city: "Berlin", description: "", imageUrl: "", price: "", priceOnRequest: true, departmentIds: [], roles: [] } } }, "company-details"), null);
});

test("private offer paths and a public profile are clearly separated in review and completion controls", () => {
  const component = readFileSync(new URL("../components/ProfileSetupWizard.tsx", import.meta.url), "utf8");
  const listingsApi = readFileSync(new URL("../app/api/listings/route.ts", import.meta.url), "utf8");
  const companiesApi = readFileSync(new URL("../app/api/companies/route.ts", import.meta.url), "utf8");
  assert.match(component, /buildQuickStartScreens\(draft\)/);
  assert.match(component, /api\/onboarding\?type=quick-start/);
  assert.match(component, /draft: true/);
  assert.match(component, /Angebot veröffentlichen/);
  assert.match(component, /Profil öffentlich erstellen/);
  assert.match(component, /Private Entwürfe speichern/);
  assert.match(component, /requestKeys\[intent\]/);
  assert.match(listingsApi, /\.contains\("metadata", \{ onboarding_request_key \}\)/);
  assert.match(companiesApi, /onboarding_request_key\.replaceAll/);
  assert.match(companiesApi, /\.eq\("owner_user_id", userId\)/);
});

test("unfinished onboarding is resumed from the dashboard and profile setup", () => {
  const component = readFileSync(new URL("../components/ProfileSetupWizard.tsx", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  assert.match(component, /saved\?\.quickStart && saved\.setupComplete !== true/);
  assert.match(component, /cache: "no-store"/);
  assert.match(dashboard, /window\.location\.replace\("\/profile-setup\?resume=1"\)/);
  assert.match(component, /ProfileSetupWizard/);
});
