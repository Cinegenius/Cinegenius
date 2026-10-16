import test from "node:test";
import assert from "node:assert/strict";
import { cleanProfileBio, getProfileDisplayPositions, hasProfileType, normalizeProfileTypes } from "./profile-display.ts";

const labels = { actor: "Schauspieler/in", model: "Model", extra: "Komparse / Kleindarsteller", editor: "Editor/in / Cutter" };

test("profile display keeps the primary and every selected type, including legacy primary-only profiles", () => {
  assert.deepEqual(normalizeProfileTypes(["model", "extra", "model"], "actor"), ["actor", "model", "extra"]);
  assert.deepEqual(normalizeProfileTypes([], "extra"), ["extra"]);
});

test("profile cards show explicit roles and all category labels without duplicates", () => {
  assert.deepEqual(getProfileDisplayPositions({
    positions: ["Editor/in", "Kamera"],
    role: "Editor/in",
    profileTypes: ["actor", "model"],
    primaryType: "actor",
    labels,
  }), ["Editor/in", "Kamera", "Schauspieler/in", "Model"]);
  assert.deepEqual(getProfileDisplayPositions({ profileTypes: ["extra"], labels }), ["Komparse / Kleindarsteller"]);
});

test("creator categories include secondary selected types", () => {
  assert.equal(hasProfileType(["actor", "extra", "model"], "actor", "model"), true);
  assert.equal(hasProfileType([], "extra", "extra"), true);
  assert.equal(hasProfileType(["actor"], "actor", "camera"), false);
});

test("profile bio strips raw Markdown syntax while retaining readable heading text", () => {
  assert.equal(cleanProfileBio("## Schwerpunkte\n\n**Komparsin** und `Model`\n- Aufgeschlossen"), "Schwerpunkte\n\nKomparsin und Model\nAufgeschlossen");
});
