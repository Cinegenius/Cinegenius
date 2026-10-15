import test from "node:test";
import assert from "node:assert/strict";
import { calculateProfileCompletion } from "./profile-completion.ts";

test("crew profile completion counts the same normalized fields used by profile editing", () => {
  const input = {
    name: "Crew Member",
    avatarUrl: "/avatar.jpg",
    location: "Berlin",
    bio: "",
    profileType: "camera",
    images: ["/one.jpg", "/two.jpg"],
    videoLinks: [],
    languages: ["Deutsch"],
    positions: ["Kamera"],
    filmography: [],
  };
  const result = calculateProfileCompletion(input);
  assert.equal(result.score, 70);
  assert.deepEqual(result.missing, ["bio", "video", "credits"]);
  assert.equal(result.score, calculateProfileCompletion(input).score);
});

test("talent-only requirements depend on profile type and blank strings do not count", () => {
  const result = calculateProfileCompletion({
    name: "Talent", avatarUrl: " ", location: "Berlin", bio: "About", profileType: "model",
    images: [], videoLinks: [], languages: [], heightCm: "", hairColor: "", positions: [], filmography: [],
  });
  assert.equal(result.total, 10);
  assert.deepEqual(result.missing, ["avatar", "photos", "video", "languages", "height", "hair"]);
});

test("actor completion also includes playing age", () => {
  const result = calculateProfileCompletion({ profileType: "actor" });
  assert.equal(result.total, 11);
  assert.ok(result.missing.includes("age"));
});
