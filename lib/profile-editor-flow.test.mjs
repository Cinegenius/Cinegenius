import test from "node:test";
import assert from "node:assert/strict";
import {
  PROFILE_EDITOR_STEPS,
  profileEditorRequiredMissing,
  profileEditorStepForErrors,
  profileEditorStepForHint,
  shouldResumeProfileEditorDraft,
} from "./profile-editor-flow.ts";
import { compressProfileEditorDraft, expandProfileEditorDraft } from "./profile-editor-private-draft.ts";

test("profile editor keeps a six-step path with a separate overview state", () => {
  assert.deepEqual(PROFILE_EDITOR_STEPS.map(({ id }) => id), [1, 2, 3, 4, 5, 6]);
});

test("required fields are distinct from optional completeness suggestions", () => {
  assert.deepEqual(profileEditorRequiredMissing({ name: " ", city: "", positions: [], profileTypes: [] }), ["activity", "name", "city"]);
  assert.deepEqual(profileEditorRequiredMissing({ name: "Mara", city: "Berlin", positions: ["Komparse"], profileTypes: [] }), []);
});

test("validation returns the step containing the first missing required field", () => {
  assert.equal(profileEditorStepForErrors(["name", "city"]), 3);
  assert.equal(profileEditorStepForErrors(["activity", "name"]), 1);
});

test("completion suggestions point to an editable step", () => {
  assert.equal(profileEditorStepForHint("avatar"), 4);
  assert.equal(profileEditorStepForHint("role"), 2);
  assert.equal(profileEditorStepForHint("languages"), 5);
});

test("private editor drafts round-trip compressed profile data without changing their values", () => {
  const draft = { step: 4, positions: ["Key Grip", "Dolly Grip"], form: { name: "Mara", city: "Berlin" }, profileImages: [{ url: "https://images.example/a.png", featured: true }] };
  assert.deepEqual(expandProfileEditorDraft(compressProfileEditorDraft(draft)), draft);
});

test("an older or undated private draft never replaces an existing public profile", () => {
  assert.equal(shouldResumeProfileEditorDraft({ profileExists: true, draftUpdatedAt: "2026-10-21T10:00:00.000Z", profileUpdatedAt: "2026-10-21T11:00:00.000Z" }), false);
  assert.equal(shouldResumeProfileEditorDraft({ profileExists: true, draftUpdatedAt: "", profileUpdatedAt: "2026-10-21T11:00:00.000Z" }), false);
  assert.equal(shouldResumeProfileEditorDraft({ profileExists: true, draftUpdatedAt: "2026-10-21T12:00:00.000Z", profileUpdatedAt: "2026-10-21T11:00:00.000Z" }), true);
  assert.equal(shouldResumeProfileEditorDraft({ profileExists: false, draftUpdatedAt: "", profileUpdatedAt: "" }), true);
});
