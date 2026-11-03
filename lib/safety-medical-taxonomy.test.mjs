import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import { COMPANY_CATEGORIES } from "./companyCategories.ts";
import { departments } from "./departments.ts";
import {
  SAFETY_MEDICAL_COMPANY_CATEGORY_ID,
  SAFETY_MEDICAL_COMPANY_SERVICES,
  SAFETY_MEDICAL_DEPARTMENT_ID,
  SAFETY_MEDICAL_OCCUPATIONS,
} from "./safety-medical-taxonomy.ts";

const locales = ["de", "en", "es", "it", "cs", "hu"];

test("Sicherheit und Sanitätsdienst ist eine eindeutige zentrale Crew-Kategorie", () => {
  const department = departments.find((item) => item.id === SAFETY_MEDICAL_DEPARTMENT_ID);
  assert.ok(department);
  assert.equal(departments.filter((item) => item.id === SAFETY_MEDICAL_DEPARTMENT_ID).length, 1);
  assert.deepEqual(department.roles, SAFETY_MEDICAL_OCCUPATIONS.map((role) => role.label));
  assert.equal(new Set(SAFETY_MEDICAL_OCCUPATIONS.map((role) => role.id)).size, SAFETY_MEDICAL_OCCUPATIONS.length);
});

test("alte Sanitäts- und Brandwachenrollen bleiben nicht im Gewerk Set und Logistik", () => {
  const setLogistics = departments.find((item) => item.id === "set-logistik");
  assert.ok(setLogistics);
  assert.equal(setLogistics.roles.includes("Medic / Set-Arzt"), false);
  assert.equal(setLogistics.roles.includes("Fire Safety Officer"), false);
});

test("passende Firmenkategorie und Leistungen sind zentral definiert", () => {
  assert.equal(COMPANY_CATEGORIES.filter((item) => item.id === SAFETY_MEDICAL_COMPANY_CATEGORY_ID).length, 1);
  assert.equal(new Set(SAFETY_MEDICAL_COMPANY_SERVICES.map((service) => service.id)).size, SAFETY_MEDICAL_COMPANY_SERVICES.length);
});

test("alle unterstützten Sprachen enthalten Kategorie, Hinweise und Leistungen", () => {
  for (const locale of locales) {
    const messages = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", `${locale}.json`), "utf8"));
    assert.equal(typeof messages.SafetyMedical?.department, "string", locale);
    assert.equal(typeof messages.SafetyMedical?.companyCategory, "string", locale);
    assert.equal(typeof messages.SafetyMedical?.qualificationNotice, "string", locale);
    for (const service of SAFETY_MEDICAL_COMPANY_SERVICES) {
      assert.equal(typeof messages.SafetyMedical?.services?.[service.id], "string", `${locale}:${service.id}`);
    }
  }
});
