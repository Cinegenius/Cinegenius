import test from "node:test";
import assert from "node:assert/strict";
import { isListingDetailRouteSupported, listingDetailPath } from "./listing-routes.ts";

test("listing detail links use the route for their actual listing type", () => {
  assert.equal(listingDetailPath("vehicle", "car-1"), "/vehicles/car-1");
  assert.equal(listingDetailPath("prop", "prop-1"), "/props/prop-1");
  assert.equal(listingDetailPath("location", "house-1"), "/locations/house-1");
  assert.equal(listingDetailPath("job", "job-1"), "/jobs/job-1");
  assert.equal(listingDetailPath("creator", "creator-1"), "/creators/creator-1");
  assert.equal(listingDetailPath("animal", "animal-1"), "/tiere/animal-1");
});

test("service entries link to their public company; unknown routes stay unavailable", () => {
  assert.equal(listingDetailPath("service", "service-1", "crew-services"), "/companies/crew-services");
  assert.equal(listingDetailPath("service", "service-1"), null);
  assert.equal(listingDetailPath("future-type", "item-1"), null);
  assert.equal(isListingDetailRouteSupported("vehicle"), true);
  assert.equal(isListingDetailRouteSupported("future-type"), false);
});
