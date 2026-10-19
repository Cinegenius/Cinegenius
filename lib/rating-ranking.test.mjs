import test from "node:test";
import assert from "node:assert/strict";
import { rankByRatingConfidence } from "./rating-ranking.ts";

test("confidence ranking does not let one five-star vote outrank many strong ratings", () => {
  const ranked = rankByRatingConfidence([
    { id: "solo", rating: 5, count: 1 },
    { id: "steady", rating: 4.7, count: 12 },
  ], (row) => row.rating, (row) => row.count, (row) => row.id);
  assert.deepEqual(ranked.map((row) => row.id), ["steady", "solo"]);
});

test("confidence ranking handles equal scores with stable count and key ordering", () => {
  const ranked = rankByRatingConfidence([
    { id: "z", rating: 4, count: 2 },
    { id: "b", rating: 4, count: 5 },
    { id: "a", rating: 4, count: 5 },
  ], (row) => row.rating, (row) => row.count, (row) => row.id);
  assert.deepEqual(ranked.map((row) => row.id), ["a", "b", "z"]);
});
