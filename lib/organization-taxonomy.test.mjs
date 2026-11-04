import test from "node:test";
import assert from "node:assert/strict";
import {
  ORGANIZATION_ENTRY_TYPES,
  ORGANIZATION_FORMATS,
  ORGANIZATION_TOPICS,
  isOrganizationEntryType,
  isOrganizationFormat,
  isOrganizationTopic,
  organizationSlug,
  safeExternalUrl,
} from "./organization-taxonomy.ts";

test("organization taxonomy keeps the phase-one content types stable", () => {
  assert.deepEqual(ORGANIZATION_ENTRY_TYPES, ["news", "workshop", "training", "event"]);
  assert.deepEqual(ORGANIZATION_FORMATS, ["onsite", "online", "hybrid"]);
  assert.equal(new Set(ORGANIZATION_TOPICS).size, ORGANIZATION_TOPICS.length);

  for (const value of ORGANIZATION_ENTRY_TYPES) assert.equal(isOrganizationEntryType(value), true);
  for (const value of ORGANIZATION_FORMATS) assert.equal(isOrganizationFormat(value), true);
  for (const value of ORGANIZATION_TOPICS) assert.equal(isOrganizationTopic(value), true);

  assert.equal(isOrganizationEntryType("company"), false);
  assert.equal(isOrganizationFormat("stream"), false);
  assert.equal(isOrganizationTopic("marketplace"), false);
});

test("organization slugs are stable, URL-safe and bounded", () => {
  assert.equal(organizationSlug("Münchner Film & Medien e. V."), "munchner-film-medien-e-v");
  assert.equal(organizationSlug("  Workshop: Licht / Kamera  "), "workshop-licht-kamera");
  assert.equal(organizationSlug("x".repeat(120)).length, 80);
});

test("external links accept only explicit web URLs", () => {
  assert.equal(safeExternalUrl("https://example.org/anmeldung"), "https://example.org/anmeldung");
  assert.equal(safeExternalUrl("http://example.org"), "http://example.org/");
  assert.equal(safeExternalUrl("javascript:alert(1)"), null);
  assert.equal(safeExternalUrl("mailto:test@example.org"), null);
  assert.equal(safeExternalUrl("example.org"), null);
  assert.equal(safeExternalUrl(""), null);
});
