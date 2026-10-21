import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  findQuickStartRoles,
  getQuickStartProfileTypes,
  normalizeQuickStartDraft,
  QUICK_START_CATEGORIES,
  START_QUICK_START_DRAFT,
  validateQuickStartDetails,
} from "./quick-start-flow.ts";

test("new quick-start drafts begin with no provider intent and three bounded steps", () => {
  assert.deepEqual(START_QUICK_START_DRAFT, {
    step: 1, intent: null, name: "", city: "", category: "", title: "", departmentId: "", role: "",
  });
  assert.equal(normalizeQuickStartDraft({ step: 99, intent: "location" }).step, 1);
});

test("all supported listing categories are available to the compact start flow", () => {
  assert.ok(QUICK_START_CATEGORIES.location.some((item) => item.value === "Wohnen"));
  assert.ok(QUICK_START_CATEGORIES.location.some((item) => item.value === "Gastronomie"));
  assert.ok(QUICK_START_CATEGORIES.equipment.some((item) => item.value === "Kameraequipment"));
  assert.ok(QUICK_START_CATEGORIES.equipment.some((item) => item.value === "Bild-Fahrzeug"));
});

test("talent occupations can be found by their names and supported synonyms", () => {
  assert.ok(findQuickStartRoles("Komparse").some((item) => item.role === "Komparse" && item.departmentId === "cast"));
  assert.ok(findQuickStartRoles("Key Grip").some((item) => item.departmentId === "grip"));
  assert.ok(findQuickStartRoles("Schauspiel").some((item) => item.departmentId === "cast"));
});

test("talent roles map to their existing profile types", () => {
  assert.ok(getQuickStartProfileTypes("cast", "Komparse").includes("extra"));
  assert.ok(getQuickStartProfileTypes("cast", "Model").includes("model"));
  assert.ok(getQuickStartProfileTypes("kamera", "1st AC (Focus Puller)").includes("camera"));
});

test("required fields are checked per chosen path, while search has no provider form", () => {
  assert.equal(validateQuickStartDetails({ ...START_QUICK_START_DRAFT, intent: "search" }), null);
  assert.equal(validateQuickStartDetails({ ...START_QUICK_START_DRAFT, intent: "location", step: 2 }).field, "category");
  assert.equal(validateQuickStartDetails({ ...START_QUICK_START_DRAFT, intent: "company", step: 2, city: "Berlin" }).field, "name");
  assert.equal(validateQuickStartDetails({ ...START_QUICK_START_DRAFT, intent: "talent", step: 2, name: "Ada", city: "Berlin" }).field, "role");
  assert.equal(validateQuickStartDetails({ ...START_QUICK_START_DRAFT, intent: "equipment", step: 2, category: "Kameraequipment", city: "Berlin", title: "Kamera" }), null);
});

test("new setup uses three shared steps and keeps provider listings private until a separate publish action", () => {
  const component = readFileSync(new URL("../components/ProfileSetupWizard.tsx", import.meta.url), "utf8");
  assert.match(component, /Schritt \$\{draft\.step\} von 3/);
  assert.match(component, /draft: true/);
  assert.match(component, /Privaten Angebotsentwurf speichern/);
  assert.match(component, /Profil öffentlich erstellen/);
  assert.match(component, /quick-start/);
});

test("an unfinished quick-start is resumed from the dashboard rather than a legacy wizard", () => {
  const dashboard = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /draft\.quickStart && typeof draft\.quickStart === "object"/);
  assert.match(dashboard, /window\.location\.replace\("\/profile-setup\?resume=1"\)/);
});
