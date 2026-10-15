import test from "node:test";
import assert from "node:assert/strict";
import { summarizeRatingRows } from "./rating-summary.ts";

test("rating summary includes quick stars when no written review exists", () => {
  assert.deepEqual(
    summarizeRatingRows([], [{ id: "r1", liker_id: "viewer-1", rating: 5 }]),
    { avg: 5, count: 1, reviewCount: 0, ratingOnlyCount: 1 },
  );
});

test("written review takes precedence over a second rating by the same reviewer", () => {
  assert.deepEqual(
    summarizeRatingRows(
      [{ id: "review-1", reviewer_id: "viewer-1", rating: 4 }],
      [{ id: "quick-1", liker_id: "viewer-1", rating: 2 }],
    ),
    { avg: 4, count: 1, reviewCount: 1, ratingOnlyCount: 0 },
  );
});

test("independent reviewers contribute once and averages round to one decimal", () => {
  assert.deepEqual(
    summarizeRatingRows(
      [{ id: "review-1", reviewer_id: "viewer-1", rating: 4 }],
      [
        { id: "quick-1", liker_id: "viewer-1", rating: 1 },
        { id: "quick-2", liker_id: "viewer-2", rating: 5 },
      ],
    ),
    { avg: 4.5, count: 2, reviewCount: 1, ratingOnlyCount: 1 },
  );
});
