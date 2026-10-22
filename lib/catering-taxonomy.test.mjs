import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COMPANY_CATEGORIES } from "./companyCategories.ts";
import { departments, matchesDepartmentOccupation } from "./departments.ts";
import { FILM_DEPARTMENTS } from "./filmRoles.ts";
import {
  CATERING_COMPANY_CATEGORY,
  CATERING_COMPANY_SERVICES,
  CATERING_DEPARTMENT_ID,
  CATERING_OCCUPATIONS,
  getCateringProfileSearchValues,
  getCateringCompanySearchTerms,
  getMatchingCateringOccupations,
  isCateringSearchQuery,
  normalizeCateringCompanyDetails,
} from "./catering-taxonomy.ts";

test("Catering uses one shared company and crew category with no duplicate catalogue entries", () => {
  assert.equal(COMPANY_CATEGORIES.filter(({ id }) => id === CATERING_COMPANY_CATEGORY.id).length, 1);
  assert.equal(departments.filter(({ id }) => id === CATERING_DEPARTMENT_ID).length, 1);
  assert.equal(FILM_DEPARTMENTS.filter(({ id }) => id === CATERING_DEPARTMENT_ID).length, 1);
  assert.deepEqual(departments.find(({ id }) => id === CATERING_DEPARTMENT_ID)?.roles, CATERING_OCCUPATIONS.map(({ label }) => label));
  assert.equal(CATERING_OCCUPATIONS.length, 6);
  assert.equal(CATERING_COMPANY_SERVICES.length, 5);
});

test("German, English and legacy film-credit labels resolve to the same Catering roles", () => {
  assert.ok(getMatchingCateringOccupations("Setkoch").some(({ id }) => id === "setkoch"));
  assert.ok(getMatchingCateringOccupations("Catering Manager").some(({ id }) => id === "catering-leitung"));
  assert.ok(getMatchingCateringOccupations("Craft Services").some(({ id }) => id === "craft-service"));
  assert.ok(matchesDepartmentOccupation("Caterer (Setbetreuung)", "Setbetreuung / Essensausgabe"));
  assert.ok(getCateringProfileSearchValues("caterer").includes("Caterer (Setbetreuung)"));
  assert.ok(isCateringSearchQuery("Küchenmobil"));
  assert.ok(isCateringSearchQuery("food truck"));
  assert.deepEqual(getCateringCompanySearchTerms().includes("Küchenmobil / mobile Küche"), true);
});

test("company details are optional, normalized, bounded, and keep only supported choices", () => {
  assert.deepEqual(normalizeCateringCompanyDetails(null), {
    serviceTypes: [], serviceAreas: "", capacity: null, dietaryOptions: [], mobileEquipment: [],
  });
  assert.deepEqual(normalizeCateringCompanyDetails({
    serviceTypes: [CATERING_COMPANY_SERVICES[0].label, "Unknown service", CATERING_COMPANY_SERVICES[0].label],
    serviceAreas: " München und Umgebung ",
    capacity: 150_000,
    dietaryOptions: ["Vegan", "nicht unterstützt"],
    mobileEquipment: ["Foodtruck"],
  }), {
    serviceTypes: [CATERING_COMPANY_SERVICES[0].label], serviceAreas: "München und Umgebung", capacity: 100_000,
    dietaryOptions: ["Vegan"], mobileEquipment: ["Foodtruck"],
  });
});

test("Catering selections reach company storage, public detail, search and job catalogue", () => {
  const companyApi = readFileSync(new URL("../app/api/companies/route.ts", import.meta.url), "utf8");
  const companyDetail = readFileSync(new URL("../app/companies/[slug]/CompanyDetail.tsx", import.meta.url), "utf8");
  const companyEdit = readFileSync(new URL("../app/company-setup/page.tsx", import.meta.url), "utf8");
  const globalSearch = readFileSync(new URL("../app/api/search/route.ts", import.meta.url), "utf8");
  const jobs = readFileSync(new URL("../app/jobs/JobsContent.tsx", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../supabase/migrations/catering_company_details.sql", import.meta.url), "utf8");
  assert.match(companyApi, /catering_details: normalizeCateringCompanyDetails\(catering_details\)/);
  assert.match(companyDetail, /offersCatering/);
  assert.match(companyEdit, /catering_details: selectedCategories\.includes\(CATERING_COMPANY_CATEGORY\.id\) \? cateringDetails/);
  assert.match(companyEdit, /setCateringDetails\(EMPTY_CATERING_COMPANY_DETAILS\)/);
  assert.match(globalSearch, /getCateringProfileSearchValues/);
  assert.match(globalSearch, /contains\("categories", \[CATERING_COMPANY_CATEGORY\.id\]\)/);
  assert.match(jobs, /FILM_DEPARTMENTS\.map/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS catering_details jsonb/i);
});
