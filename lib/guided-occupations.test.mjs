import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const fs = require("node:fs");
const ts = require("typescript");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const originalResolve = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@/lib/")) request = join(root, "lib", request.slice("@/lib/".length));
  return originalResolve.call(this, request, parent, isMain, options);
};
require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const javascript = ts.transpile(source, {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  });
  module._compile(javascript, filename);
};

const { departments, getDepartmentRoleSearchTerms, getProfileTypesForDepartment, matchesDepartmentOccupation, getOccupationSearchTerms } = require("./departments.ts");
const { normalizeGuidedProfileDraft, removeGuidedDepartment, getGuidedProfileTypes } = require("./guided-profile-draft.ts");
const { FILM_DEPARTMENTS } = require("./filmRoles.ts");
const departmentIdsByFilmDepartment = {
  "vor-der-kamera": "cast", regie: "regie", kamera: "kamera", licht: "licht", grip: "grip",
  ton: "ton", maske: "maske", kostuem: "kostuem", szenenbild: "art", produktion: "produktion",
  post: "post", vfx: "post", "animation-3d": "post", besetzung: "cast", drehbuch: "drehbuch",
  filmgeschaeftsfuehrung: "produktion", musik: "musik", producer: "produktion",
  "sende-veranstaltung": "broadcast", spezialeffekte: "sfx", stunts: "cast", "ton-post": "ton",
  "tv-web-content": "redaktion", "virtual-production": "virtual", "public-relation": "public-relations",
  "weitere-crew": "set-logistik", "content-creation": "social", "social-video": "social",
  fotografie: "foto", "foto-post": "foto",
};

const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("de").replace(/[^a-z0-9]+/g, " ").trim();

test("guided catalogue includes every profile, crew-filter, job and project department", () => {
  assert.equal(Object.keys(departmentIdsByFilmDepartment).length, FILM_DEPARTMENTS.length);
  for (const filmDepartment of FILM_DEPARTMENTS) {
    const targetId = departmentIdsByFilmDepartment[filmDepartment.id];
    assert.ok(targetId, `missing crosswalk for ${filmDepartment.id}`);
    assert.ok(departments.some((department) => department.id === targetId), `missing guided department ${targetId}`);
  }
  assert.ok(departments.some(({ id }) => id === "drehbuch"));
  assert.ok(departments.some(({ id }) => id === "public-relations"));
});

test("job and project role titles are represented without duplicate choices in their mapped department", () => {
  for (const filmDepartment of FILM_DEPARTMENTS) {
    const target = departments.find(({ id }) => id === departmentIdsByFilmDepartment[filmDepartment.id]);
    const visibleLabels = new Set(target.roles.map(normalize));
    for (const role of filmDepartment.roles) {
      assert.ok(visibleLabels.has(normalize(role.label)) || target.roles.some((label) =>
        getDepartmentRoleSearchTerms(target, label).some((term) => normalize(term) === normalize(role.label))),
      `${filmDepartment.id}: ${role.label} is absent from guided ${target.id}`);
    }
    assert.equal(visibleLabels.size, target.roles.length, `duplicate canonical role in ${target.id}`);
  }
});

test("German and English aliases find one canonical Grip occupation", () => {
  const grip = departments.find(({ id }) => id === "grip");
  const keyGrip = grip.roles.find((role) => normalize(role) === normalize("Key Grip"));
  assert.ok(keyGrip);
  const searchTerms = getDepartmentRoleSearchTerms(grip, keyGrip).map(normalize);
  assert.ok(searchTerms.includes(normalize("1. Kamerabühne")));
  assert.ok(searchTerms.includes(normalize("1st Camera Grip")));
  assert.equal(grip.roles.filter((role) => normalize(role) === normalize("Key Grip")).length, 1);
});

test("aliases from the merged catalogue are searchable in Crew and role filters", () => {
  assert.ok(matchesDepartmentOccupation("Stunt Performer", "Stunt-Darsteller/in"));
  assert.ok(matchesDepartmentOccupation("Stunt-Darsteller/in", "Stunt Performer"));
  assert.ok(matchesDepartmentOccupation("Key Grip", "1. Kamerabühne"));
  assert.equal(matchesDepartmentOccupation("Model", "Dolly Grip"), false);
  assert.ok(getOccupationSearchTerms("Stunt-Darsteller/in").includes("Stunt Performer"));
});

test("every guided department resolves to an allowed profile type, including unselected casting roles", () => {
  for (const department of departments) {
    const profileTypes = getProfileTypesForDepartment(department.id, []);
    assert.ok(profileTypes.length > 0, `no profile type mapping for ${department.id}`);
    assert.ok(profileTypes.every((type) => ["actor", "model", "extra", "host", "dancer", "stunt", "voiceover", "creator", "camera", "lighting", "sound", "director_of_photography", "director", "production", "makeup", "costume", "postproduction", "vfx", "sfx", "art_department", "broadcast", "filmmaker", "writer", "photographer", "editor", "motion_designer", "art_director", "location", "equipment", "vehicle", "studio", "props"].includes(type)));
  }
  assert.deepEqual(getProfileTypesForDepartment("cast", ["Model", "Komparse"]), ["model", "extra"]);
});

test("existing onboarding drafts migrate their category and Grip selections without losing them", () => {
  const migrated = normalizeGuidedProfileDraft({
    step: 3,
    name: "Test",
    types: ["actor", "camera", "grip"],
    gripPositions: ["Key Grip", "Dolly Grip / Dollyfahrer*in"],
  });
  assert.equal(migrated.step, 3);
  assert.ok(migrated.departmentIds.includes("cast"));
  assert.ok(migrated.departmentIds.includes("kamera"));
  assert.ok(migrated.departmentIds.includes("grip"));
  assert.ok(migrated.positions.includes("Schauspieler"));
  assert.ok(migrated.positions.includes("Key Grip"));
  assert.ok(!("gripPositions" in migrated));
});

test("guided profile payload derives every selected department type and occupation", () => {
  const draft = normalizeGuidedProfileDraft({
    departmentIds: ["cast", "grip", "drehbuch"],
    positions: ["Model", "Key Grip", "Dolly Grip / Dollyfahrer*in", "Drehbuchautor/in"],
  });
  const profileTypes = getGuidedProfileTypes(draft);
  assert.deepEqual(profileTypes, ["model", "camera", "writer"]);
  assert.equal(draft.positions.length, 4);
});

test("removing a trade removes only its exclusive roles and keeps shared selected roles", () => {
  const draft = normalizeGuidedProfileDraft({
    departmentIds: ["produktion", "redaktion", "regie", "set-logistik"],
    positions: ["Creative Producer", "Dialog Coach", "Set Runner"],
  });
  const afterRemovingProduction = removeGuidedDepartment(draft, "produktion");
  assert.ok(!afterRemovingProduction.departmentIds.includes("produktion"));
  assert.ok(afterRemovingProduction.positions.includes("Creative Producer"));
  assert.ok(afterRemovingProduction.positions.includes("Dialog Coach"));
  assert.ok(!afterRemovingProduction.positions.includes("Set Runner"));
});
