import test from "node:test";
import assert from "node:assert/strict";
import { summarizePhotoRatings } from "./photo-rating-summary.ts";

test("photo summary counts one active rating per reviewer", () => {
  assert.deepEqual(summarizePhotoRatings([
    { reviewer_id: "one", rating: 5 },
    { reviewer_id: "one", rating: 3 },
    { reviewer_id: "two", rating: 4 },
  ]), { avg: 3.5, count: 2 });
});

test("photo summary ignores invalid star values", () => {
  assert.deepEqual(summarizePhotoRatings([{ reviewer_id: "one", rating: 0 }, { reviewer_id: "two", rating: 6 }]), { avg: 0, count: 0 });
});
