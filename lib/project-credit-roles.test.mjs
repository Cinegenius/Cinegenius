import test from "node:test";
import assert from "node:assert/strict";
import { resolveProjectCreditRole, splitProjectCreditRole, groupProjectCredits } from "./project-credit-roles.ts";

for (const [role, department] of [
  ["Art Director", "art"], ["2nd AC", "kamera"], ["2nd AC (Clapper / Loader)", "kamera"],
  ["DIT", "kamera"], ["1st AD", "regie"], ["Script Supervisor (Continuity)", "regie"],
  ["Dolly Grip", "grip"], ["Kostümbildner/in", "kostuem"],
  ["Produktionspraktikantin", "produktion"], ["Set-AL-Assistenz", "produktion"],
  ["Standby Art Director / On-set Props", "art"], ["Set Dresser (Estonia)", "art"],
]) test(`${role} uses its central department ${department}`, () => {
  assert.equal(resolveProjectCreditRole(role)?.department.id, department);
});

test("legacy department matching preserves the actual job wording", () => {
  assert.equal(resolveProjectCreditRole("Set Dresser (Estonia)").role, "Set Dresser (Estonia)");
});

test("free notes and character names do not affect classification", () => {
  assert.equal(resolveProjectCreditRole("2nd AC || Regie: Beispiel")?.department.id, "kamera");
  assert.equal(resolveProjectCreditRole("Schauspieler — Art Director||2nd AC")?.department.id, "cast");
  assert.deepEqual(splitProjectCreditRole("Schauspieler — Dr. K.||Original note || unchanged"), {
    role: "Schauspieler", character: "Dr. K.", note: "Original note || unchanged",
  });
});

test("unknown and genuinely ambiguous jobs are not guessed", () => {
  for (const role of ["Unknown director camera assistant", "Playback Operator", "Creative Producer", ""]) {
    assert.equal(resolveProjectCreditRole(role), null);
  }
});

test("grouping preserves every credit and its original member text", () => {
  const credits = [{ role: "Art Director" }, { role: "2nd AC || Regie" }, { role: "Unknown" }];
  const original = JSON.stringify(credits);
  const groups = groupProjectCredits(credits);
  assert.equal(groups.flatMap(group => group.members).length, credits.length);
  assert.equal(groups.at(-1).department, null);
  assert.equal(JSON.stringify(credits), original);
});
