import assert from "node:assert/strict";
import test from "node:test";

import { compareCreatorNames } from "./creator-directory-order.ts";

test("Crew-Einträge werden unabhängig von der Verifizierung alphabetisch sortiert", () => {
  const entries = [
    { id: "verified-z", name: "Zora", verified: true },
    { id: "unverified-a", name: "Anna", verified: false },
    { id: "verified-b", name: "Björn", verified: true },
    { id: "unverified-a-2", name: "Álvaro", verified: false },
  ];

  const sorted = [...entries].sort((left, right) => compareCreatorNames(left, right, "de"));

  assert.deepEqual(sorted.map((entry) => entry.name), ["Álvaro", "Anna", "Björn", "Zora"]);
});

test("gleichnamige Einträge behalten durch ihre ID eine stabile Reihenfolge", () => {
  const entries = [
    { id: "profile-20", name: "Alex" },
    { id: "profile-3", name: "Alex" },
  ];

  const sorted = [...entries].sort((left, right) => compareCreatorNames(left, right, "de"));

  assert.deepEqual(sorted.map((entry) => entry.id), ["profile-3", "profile-20"]);
});
