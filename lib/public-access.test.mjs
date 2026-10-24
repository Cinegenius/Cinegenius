import test from "node:test";
import assert from "node:assert/strict";
import { isProtectedCreatePath, isPublicProfilePath } from "./public-access.ts";

test("only a single profile slug is public; editor routes are protected", () => {
  assert.equal(isPublicProfilePath("/profile/anne-klopp"), true);
  assert.equal(isPublicProfilePath("/profile"), false);
  assert.equal(isPublicProfilePath("/profile/settings/edit"), false);
  assert.equal(isProtectedCreatePath("/profile"), true);
});

test("project creation overrides the public projects directory", () => {
  assert.equal(isProtectedCreatePath("/projects/neu"), true);
  assert.equal(isProtectedCreatePath("/projects/film"), false);
});
