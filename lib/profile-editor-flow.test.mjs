import test from "node:test";
import assert from "node:assert/strict";
import {
  PROFILE_EDITOR_STEPS,
  profileEditorAvailabilityConfig,
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
  const draft = { step: 4, positions: ["Key Grip", "Dolly Grip"], form: { name: "Mara", city: "Berlin" }, availabilityData: { travel: "worldwide", custom_availability: "retained" }, profileImages: [{ url: "https://images.example/a.png", featured: true }] };
  assert.deepEqual(expandProfileEditorDraft(compressProfileEditorDraft(draft)), draft);
});

test("saving another profile detail preserves travel scope and existing availability extensions", () => {
  const previous = Object.freeze({ travel: "worldwide", custom_availability: "retained", weekends: false });
  const result = profileEditorAvailabilityConfig(previous, { originalTravelReady: true, travelReady: true, weekends: true, nightShoots: false, shortNotice: true, workRadius: "120" });
  assert.equal(result.travel, "worldwide");
  assert.equal(result.custom_availability, "retained");
  assert.equal(result.weekends, true);
  assert.equal(result.work_radius_km, 120);
  assert.equal(previous.weekends, false);
});

test("an explicit travel switch change agrees with the scope used by public filters", () => {
  const settings = { weekends: false, nightShoots: false, shortNotice: false, workRadius: "" };
  assert.equal(profileEditorAvailabilityConfig({ travel: "worldwide" }, { ...settings, originalTravelReady: true, travelReady: false }).travel, "none");
  assert.equal(profileEditorAvailabilityConfig({ travel: "none" }, { ...settings, originalTravelReady: false, travelReady: true }).travel, "national");
  assert.equal(profileEditorAvailabilityConfig({ travel: "regional" }, { ...settings, originalTravelReady: false, travelReady: false }).travel, "regional");
});

test("an older or undated private draft never replaces an existing public profile", () => {
  assert.equal(shouldResumeProfileEditorDraft({ profileExists: true, draftUpdatedAt: "2026-10-21T10:00:00.000Z", profileUpdatedAt: "2026-10-21T11:00:00.000Z" }), false);
  assert.equal(shouldResumeProfileEditorDraft({ profileExists: true, draftUpdatedAt: "", profileUpdatedAt: "2026-10-21T11:00:00.000Z" }), false);
  assert.equal(shouldResumeProfileEditorDraft({ profileExists: true, draftUpdatedAt: "2026-10-21T12:00:00.000Z", profileUpdatedAt: "2026-10-21T11:00:00.000Z" }), true);
  assert.equal(shouldResumeProfileEditorDraft({ profileExists: false, draftUpdatedAt: "", profileUpdatedAt: "" }), true);
});
