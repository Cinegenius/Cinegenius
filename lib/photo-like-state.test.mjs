import test from "node:test";
import assert from "node:assert/strict";
import { optimisticPhotoLikeCount, photoLikeKey } from "./photo-like-state.ts";
import { photoHref } from "./photo-link.ts";

test("a desired like state is idempotent across retries", () => {
  assert.equal(optimisticPhotoLikeCount(4, false, true), 5);
  assert.equal(optimisticPhotoLikeCount(5, true, true), 5);
  assert.equal(optimisticPhotoLikeCount(5, true, false), 4);
  assert.equal(optimisticPhotoLikeCount(4, false, false), 4);
});

test("like state keys distinguish profile ownership as well as photo URL", () => {
  assert.notEqual(photoLikeKey("profile-a", "https://cdn.test/photo.jpg"), photoLikeKey("profile-b", "https://cdn.test/photo.jpg"));
});

test("photo links identify the exact image and can carry the intended post-login like", () => {
  const href = new URL(photoHref("profile-1", "https://images.example/photo.jpg?width=900", "like"), "https://cinegenius.test");
  assert.equal(href.pathname, "/photo");
  assert.equal(href.searchParams.get("profile_id"), "profile-1");
  assert.equal(href.searchParams.get("image_url"), "https://images.example/photo.jpg?width=900");
  assert.equal(href.searchParams.get("action"), "like");
});
