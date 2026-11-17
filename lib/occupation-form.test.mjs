import test from "node:test";
import assert from "node:assert/strict";
import { OCCUPATION_FORMS, isOccupationForm, normalizeOccupationForm, occupationFormFromCrew, hasInvalidOccupationForm, preserveOccupationForm } from "./occupation-form.ts";

test("only the explicit four grammatical choices are valid, without inference", () => {
  assert.deepEqual(OCCUPATION_FORMS, ["standard", "masculine", "feminine", "neutral"]);
  for (const value of OCCUPATION_FORMS) assert.equal(isOccupationForm(value), true);
  for (const value of [undefined, null, "female", "male", "she/her", "sie/ihr", " feminine ", 1, {}, []]) {
    assert.equal(isOccupationForm(value), false);
    assert.equal(normalizeOccupationForm(value), "standard");
  }
  assert.equal(occupationFormFromCrew({ name: "Anna", gender: "female", pronouns: "she/her" }), "standard");
  assert.equal(occupationFormFromCrew(Object.create({ occupationForm: "feminine" })), "standard");
});

test("only an explicitly supplied invalid form is rejected; absent legacy metadata is allowed", () => {
  for (const crew of [undefined, null, {}, [], "legacy"]) assert.equal(hasInvalidOccupationForm(crew), false);
  for (const occupationForm of [null, false, [], {}, "female", ""]) assert.equal(hasInvalidOccupationForm({ occupationForm }), true);
  for (const occupationForm of OCCUPATION_FORMS) assert.equal(hasInvalidOccupationForm({ occupationForm }), false);
});

test("older crew replacement writers preserve only the confirmed occupation preference", () => {
  const previous = { occupationForm: "feminine", certificates: ["Old"], unknown: "Keep on partial writes" };
  const incoming = { certificates: ["New"] };
  assert.deepEqual(preserveOccupationForm(previous, incoming), { certificates: ["New"], occupationForm: "feminine" });
  assert.deepEqual(preserveOccupationForm(previous, null), { occupationForm: "feminine" });
  assert.deepEqual(preserveOccupationForm(previous, undefined), { occupationForm: "feminine" });
  assert.deepEqual(previous, { occupationForm: "feminine", certificates: ["Old"], unknown: "Keep on partial writes" });
  assert.deepEqual(incoming, { certificates: ["New"] });
  assert.equal(preserveOccupationForm({ occupationForm: "invalid" }, null), null);
  assert.equal(preserveOccupationForm(null, null), null);
});

test("standard explicitly removes only the override and explicit choices replace it", () => {
  for (const occupationForm of OCCUPATION_FORMS) {
    const crew = { occupationForm, certificates: ["Keep"], primaryOccupation: { roleId: "same", departmentId: "same" } };
    const expected = { ...crew };
    if (occupationForm === "standard") delete expected.occupationForm;
    assert.deepEqual(preserveOccupationForm({ occupationForm: "feminine" }, crew), expected);
  }
  assert.throws(() => preserveOccupationForm({ occupationForm: "feminine" }, { occupationForm: "female" }), /Invalid occupation form/);
});
