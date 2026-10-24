import test from "node:test";
import assert from "node:assert/strict";
import { fillSupportTemplate, validateSupportTemplateBody } from "./support-message-templates.ts";

const target = {
  editUrl: "/dashboard?tab=listings&editListing=listing-123",
  firstName: "Mara",
  missingFields: ["Titel", "Standort"],
  listingTitle: "Kamera Set",
  targetLabel: "Kamera Set · Marktplatz",
  companyName: null,
};

test("füllt die erlaubten Supportplatzhalter mit passenden Zieldaten", () => {
  const body = "Hallo {{Vorname}}, bei ‚{{Inserattitel}}‘ fehlen {{fehlendeAngaben}}. Bearbeiten: {{Bearbeitungslink}}";
  const filled = fillSupportTemplate(body, target, "https://www.cinegenius.co");
  assert.equal(filled, "Hallo Mara, bei ‚Kamera Set‘ fehlen Titel, Standort. Bearbeiten: https://www.cinegenius.co/dashboard?tab=listings&editListing=listing-123");
  assert.doesNotMatch(filled, /\{\{[^}]+\}\}/);
});

test("verwendet eine neutrale Anrede, wenn kein Vorname vorhanden ist", () => {
  const filled = fillSupportTemplate("Hallo {{Vorname}}, bei {{Firmenname}} gibt es Neuigkeiten.", {
    ...target, firstName: null, companyName: "Filmstudio Nord",
  }, "https://www.cinegenius.co");
  assert.equal(filled, "Hallo, bei Filmstudio Nord gibt es Neuigkeiten.");
});

test("weist unbekannte, leere und überlange Vorlagen zurück", () => {
  assert.match(validateSupportTemplateBody("Hallo {{Unbekannt}}"), /Unbekannter Platzhalter/);
  assert.match(validateSupportTemplateBody("   "), /1 bis 5.000/);
  assert.match(validateSupportTemplateBody("x".repeat(5001)), /1 bis 5.000/);
  assert.equal(validateSupportTemplateBody("Hallo {{Vorname}}"), null);
});
