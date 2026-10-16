import test from "node:test";
import assert from "node:assert/strict";
import { validateProfileSave } from "./profile-save-validation.ts";

test("profile save requires name, location and at least one activity", () => {
  assert.deepEqual(validateProfileSave({ name: "", city: "", positions: [], profileTypes: [] }), {
    name: "Bitte gib deinen Namen ein.",
    city: "Bitte gib deinen Standort ein.",
    activity: "Bitte wähle mindestens eine Tätigkeit aus.",
  });
});

test("profile save accepts one role, multiple types, or a crew position", () => {
  assert.deepEqual(validateProfileSave({ name: "Mara", city: "Berlin", positions: [], profileTypes: ["extra"] }), {});
  assert.deepEqual(validateProfileSave({ name: "Mara", city: "Berlin", positions: [], profileTypes: ["extra", "actor"] }), {});
  assert.deepEqual(validateProfileSave({ name: "Mara", city: "Berlin", positions: ["Editor/in"], profileTypes: [] }), {});
});
