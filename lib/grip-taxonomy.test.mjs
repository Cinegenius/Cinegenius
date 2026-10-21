import test from "node:test";
import assert from "node:assert/strict";
import {
  GRIP_DEPARTMENT_LABEL,
  GRIP_OCCUPATIONS,
  buildGuidedGripProfileOccupations,
  findGripOccupation,
  gripSearchTerms,
  isGripDepartmentSearch,
  matchesGripOccupation,
  normalizeGripDepartmentId,
  normalizeGripRoleId,
} from "./gripTaxonomy.ts";

test("grip taxonomy exposes distinct department leadership, assistant and specializations", () => {
  const ids = new Set(GRIP_OCCUPATIONS.map((occupation) => occupation.id));
  assert.equal(GRIP_DEPARTMENT_LABEL, "Kamerabühne / Grip");
  assert.ok(ids.has("key-grip"));
  assert.ok(ids.has("best-boy-grip"));
  assert.ok(ids.has("dolly-grip"));
  assert.ok(ids.has("kamerabuhnen-assistent"));
  assert.ok(ids.has("rigging-grip"));
  assert.ok(ids.has("kran-operator"));
  assert.ok(ids.has("remote-head-technician"));
  assert.equal(ids.size, GRIP_OCCUPATIONS.length, "occupation IDs must be unique");
  assert.equal(new Set(GRIP_OCCUPATIONS.map((occupation) => occupation.label)).size, GRIP_OCCUPATIONS.length, "display titles must not be duplicated");
});

test("German and international titles resolve to one canonical occupation for discovery", () => {
  assert.equal(findGripOccupation("1. Kamerabühne")?.id, "key-grip");
  assert.equal(findGripOccupation("Key Grip")?.id, "key-grip");
  assert.equal(findGripOccupation("Dollyfahrer*in")?.id, "dolly-grip");
  assert.equal(findGripOccupation("Dolly Grip")?.id, "dolly-grip");
  assert.ok(matchesGripOccupation("Dollyfahrer*in", "Dolly Grip"));
  assert.equal(matchesGripOccupation("Dolly Grip", "Key Grip"), false, "specific occupation filters stay distinct inside the shared department");
  assert.ok(gripSearchTerms("Key Grip").includes("1. Kamerabühne"));
  assert.ok(isGripDepartmentSearch("Kamerabühne / Grip"));
  assert.equal(normalizeGripDepartmentId("kamerabuhne"), "grip");
  assert.equal(normalizeGripRoleId("1-kamerabuhne"), "key-grip");
  assert.equal(normalizeGripRoleId("2-kamerabuhne"), "best-boy-grip");
});

test("guided profile setup saves grip as a camera crew profile without losing selected occupations", () => {
  const result = buildGuidedGripProfileOccupations(
    ["grip", "camera"],
    { camera: "Kamera" },
    ["Key Grip", "Dolly Grip / Dollyfahrer*in"],
  );
  assert.deepEqual(result.profileTypes, ["camera"]);
  assert.deepEqual(result.positions, ["Kamerabühne / Grip", "Kamera", "Key Grip", "Dolly Grip / Dollyfahrer*in"]);
});

