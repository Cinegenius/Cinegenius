import test from "node:test";
import assert from "node:assert/strict";
import { cleanProfileBio, getProfileDisplayPositions, getProfilePositionsPreview, hasProfileType, normalizeProfileTypes } from "./profile-display.ts";

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

test("profile occupation display deduplicates labels without changing the saved list", () => {
  const saved = ["Setkostüm Assistent*in", "Kostümfahrer", "Setkostüm Assistent*in"];
  const displayed = getProfileDisplayPositions({
    positions: saved,
    profileTypes: ["crew"],
    labels: { crew: "Crew" },
  });

  assert.deepEqual(displayed, ["Setkostüm Assistent*in", "Kostümfahrer", "Crew"]);
  assert.deepEqual(saved, ["Setkostüm Assistent*in", "Kostümfahrer", "Setkostüm Assistent*in"]);
});

test("long multi-department role lists stay compact until expanded, then expose every saved role", () => {
  const positions = [
    "Kostümbildassistent*in mit einer besonders langen Spezialisierungsbezeichnung",
    "Setkostüm Assistent*in",
    "Kostümfahrer*in",
    "Kostümpraktikant",
    "Kostümsticker",
    "Additional Set Costumer",
    "Embroiderer",
    "Kostümfahrer",
  ];

  const collapsed = getProfilePositionsPreview(positions, false);
  assert.deepEqual(collapsed.visible, positions.slice(0, 5));
  assert.equal(collapsed.remaining, 3);

  const expanded = getProfilePositionsPreview(positions, true);
  assert.deepEqual(expanded.visible, positions);
  assert.equal(expanded.remaining, 0);
});

test("preview limits are safe for narrow and invalid values", () => {
  const positions = ["A", "B", "C"];
  assert.deepEqual(getProfilePositionsPreview(positions, false, 2), { visible: ["A", "B"], remaining: 1 });
  assert.deepEqual(getProfilePositionsPreview(positions, false, 0), { visible: ["A"], remaining: 2 });
  assert.deepEqual(getProfilePositionsPreview(positions, false, Number.NaN), { visible: ["A", "B", "C"], remaining: 0 });
});
