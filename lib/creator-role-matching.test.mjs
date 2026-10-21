import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { departments } from "./departments.ts";
import { findOccupiedCreatorRoles, matchesCreatorRole } from "./creator-role-matching.ts";

test("creator role filters honor German and English titles and keep grip specializations distinct", () => {
  const keyGrip = { role: "Key Grip", positions: ["Key Grip"] };
  const dollyGrip = { role: "Dolly Grip / Dollyfahrer*in", positions: ["Dolly Grip / Dollyfahrer*in"] };

  assert.equal(matchesCreatorRole(keyGrip, "1. Kamerabühne"), true);
  assert.equal(matchesCreatorRole(keyGrip, "Key Grip"), true);
  assert.equal(matchesCreatorRole(keyGrip, "Dolly Grip / Dollyfahrer*in"), false);
  assert.equal(matchesCreatorRole(dollyGrip, "Dolly Grip / Dollyfahrer*in"), true);
  assert.equal(matchesCreatorRole(dollyGrip, "Dollyfahrer*in"), true);
});

test("creator role matching includes legacy role aliases and the separate role field", () => {
  const profile = { role: "Beleuchter (Electrician)", positions: [] };
  assert.equal(matchesCreatorRole(profile, "Beleuchter (Electrician)"), true);
  assert.equal(matchesCreatorRole(profile, "Lighting Programmer (DMX)"), false);

  const legacyAlias = { role: "Camera Grip", positions: ["Camera Grip"] };
  assert.equal(matchesCreatorRole(legacyAlias, "Grip / Kamerabühne"), true);
});

test("occupied role discovery returns the same catalog labels represented by creator roles", () => {
  const profiles = [
    { role: "Key Grip", positions: ["Key Grip", "Dolly Grip / Dollyfahrer*in"] },
    { role: "Regisseur/in", positions: ["Regisseur/in"] },
  ];
  const occupied = findOccupiedCreatorRoles(profiles);

  assert.ok(occupied.has("Key Grip"));
  assert.ok(occupied.has("Dolly Grip / Dollyfahrer*in"));
  assert.ok(occupied.has("Regisseur/in"));
  assert.ok(!occupied.has("Foley Artist"));
  assert.ok(departments.some((department) => department.roles.some((role) => occupied.has(role))));
});

test("full occupied-role scan remains bounded for a directory-sized result set", () => {
  const sampleRoles = [
    "Beleuchter (Electrician)", "2nd AC (Clapper / Loader)", "Personal Driver",
    "Lichtassistent*in", "Schauspieler/in", "1. Regieassistenz", "Set Runner",
    "Video Assist Operator", "Costume Designer", "Best Boy Electric", "Key Grip",
    "Fotograf/in", "Director of Photography (DoP)", "Production Sound Mixer",
  ];
  const profiles = Array.from({ length: 24 }, (_, index) => {
    const role = sampleRoles[index % sampleRoles.length];
    return { role, positions: [role, sampleRoles[(index + 3) % sampleRoles.length]] };
  });

  const startedAt = performance.now();
  const occupied = findOccupiedCreatorRoles(profiles);
  const elapsedMs = performance.now() - startedAt;

  assert.ok(occupied.size > 0);
  assert.ok(elapsedMs < 2500, `expected the full role scan to finish under 2.5 seconds; took ${elapsedMs.toFixed(0)}ms`);
});
