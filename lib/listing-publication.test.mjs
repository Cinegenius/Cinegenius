import test from "node:test";
import assert from "node:assert/strict";
import { validateListingPublication } from "./listing-publication.ts";

const validVehicle = {
  type: "vehicle",
  title: "Oldtimer Renault Caravelle Cabrio",
  city: "München",
  category: "Bild-Fahrzeug",
  imageUrl: "https://storage.example.supabase.co/storage/v1/object/public/listing-images/car.jpg",
  providerAssigned: true,
  providerContactable: true,
};

test("publication allows a fully linked visual listing", () => {
  assert.equal(validateListingPublication(validVehicle), null);
});

test("publication blocks missing provider, category, location, image, bad URL, and unsupported routes", () => {
  assert.match(validateListingPublication({ ...validVehicle, providerAssigned: false }) ?? "", /Anbieter/);
  assert.match(validateListingPublication({ ...validVehicle, providerContactable: false }) ?? "", /Kontaktprofil/);
  assert.match(validateListingPublication({ ...validVehicle, category: null }) ?? "", /Kategorie/);
  assert.match(validateListingPublication({ ...validVehicle, city: " " }) ?? "", /Ort/);
  assert.match(validateListingPublication({ ...validVehicle, imageUrl: null }) ?? "", /Hauptbild/);
  assert.equal(validateListingPublication({ ...validVehicle, imageUrl: null, imageWillBeUploaded: true }), null);
  assert.match(validateListingPublication({ ...validVehicle, imageUrl: "http://example.com/car.jpg" }) ?? "", /HTTPS/);
  assert.match(validateListingPublication({ ...validVehicle, type: "future-type" }) ?? "", /Detailseite/);
});

test("service listings need a company detail route but jobs do not need an image", () => {
  assert.match(validateListingPublication({ ...validVehicle, type: "service", category: null, companySlug: null }) ?? "", /Detailseite/);
  assert.equal(validateListingPublication({ ...validVehicle, type: "service", category: null, companySlug: "catering" }), null);
  assert.equal(validateListingPublication({ ...validVehicle, type: "job", category: null, imageUrl: null }), null);
});
