import test from "node:test";
import assert from "node:assert/strict";
import { getPhotoBandFillerCount, orderPhotosByAuthor, repeatForSeamlessLoop, shouldAnimatePhotoBand } from "./home-discovery.ts";

test("home discovery avoids consecutive photos by the same author when another creator is available", () => {
  const photos = [
    { profileId: "a", imageUrl: "a1" },
    { profileId: "a", imageUrl: "a2" },
    { profileId: "b", imageUrl: "b1" },
    { profileId: "c", imageUrl: "c1" },
  ];
  const ordered = orderPhotosByAuthor(photos);
  assert.deepEqual(ordered.map((photo) => photo.imageUrl), ["a1", "b1", "a2", "c1"]);
});

test("home discovery keeps all photos and stays stable when consecutive authors cannot be avoided", () => {
  const photos = [
    { profileId: "a", imageUrl: "a1" },
    { profileId: "a", imageUrl: "a2" },
  ];
  assert.deepEqual(orderPhotosByAuthor(photos), photos);
});

test("seamless loop repeats the original photo sequence exactly once without changing order", () => {
  const photos = [
    { profileId: "a", imageUrl: "a1" },
    { profileId: "b", imageUrl: "b1" },
    { profileId: "c", imageUrl: "c1" },
  ];
  const loop = repeatForSeamlessLoop(photos);
  assert.deepEqual(loop, [...photos, ...photos]);
  assert.equal(loop.length, photos.length * 2);
  assert.equal(loop[0], loop[photos.length]);
});

test("a single available photo has a matching decorative copy for a seamless loop", () => {
  const onlyPhoto = [{ profileId: "a", imageUrl: "a1" }];
  assert.deepEqual(repeatForSeamlessLoop(onlyPhoto), [...onlyPhoto, ...onlyPhoto]);
});

test("photo band adds whole image passes to fill wide viewports without gaps", () => {
  assert.equal(getPhotoBandFillerCount(1194, 240, 3), 3);
  assert.equal(getPhotoBandFillerCount(390, 165, 2), 2);
  assert.equal(getPhotoBandFillerCount(320, 165, 3), 0);
});

test("photo band fills common phone, tablet and desktop widths while preserving loop order", () => {
  const viewports = [
    [320, 165], [375, 165], [390, 165], [430, 165],
    [768, 200], [820, 200], [1024, 240], [1194, 240], [1366, 250],
  ];
  for (const [viewportWidth, cardWidth] of viewports) {
    for (const photosPerPass of [2, 3]) {
      const fillerCount = getPhotoBandFillerCount(viewportWidth, cardWidth, photosPerPass);
      const totalCards = photosPerPass + fillerCount;
      assert.equal(totalCards % photosPerPass, 0, `whole photo sequence at ${viewportWidth}px`);
      assert.ok(totalCards * cardWidth >= viewportWidth, `filled row at ${viewportWidth}px`);
    }
  }
});

test("photo band filler calculation safely ignores missing or invalid measurements", () => {
  assert.equal(getPhotoBandFillerCount(0, 240, 3), 0);
  assert.equal(getPhotoBandFillerCount(1194, 0, 3), 0);
  assert.equal(getPhotoBandFillerCount(1194, 240, 0), 0);
});

test("photo band stays static with fewer than two photos or reduced-motion preference", () => {
  assert.equal(shouldAnimatePhotoBand(0, false), false);
  assert.equal(shouldAnimatePhotoBand(1, false), false);
  assert.equal(shouldAnimatePhotoBand(6, true), false);
  assert.equal(shouldAnimatePhotoBand(2, false), true);
});
