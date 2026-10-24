import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_LISTING_IMAGES,
  LISTING_GALLERY_PREVIEW_LIMIT,
  MAX_LOCATION_IMAGES,
  galleryUrlsFromEntries,
  getListingGalleryPreview,
  maxImagesForListingType,
  moveGalleryImage,
  normalizeListingImageGallery,
} from "./listing-image-gallery.ts";

test("legacy single-image articles normalize to a one-image gallery", () => {
  assert.deepEqual(normalizeListingImageGallery("https://img.test/cover.jpg", null), {
    ok: true,
    gallery: { imageUrl: "https://img.test/cover.jpg", extraImages: [] },
  });
});

test("gallery ordering keeps the selected main image first and caps articles at ten", () => {
  const urls = Array.from({ length: MAX_LISTING_IMAGES }, (_, index) => `https://img.test/${index}.jpg`);
  const result = normalizeListingImageGallery(urls[0], urls.slice(1));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.gallery.imageUrl, urls[0]);
    assert.deepEqual(result.gallery.extraImages, urls.slice(1));
  }
  const promoted = normalizeListingImageGallery(null, urls);
  assert.equal(promoted.ok, true);
  if (promoted.ok) assert.equal(promoted.gallery.imageUrl, urls[0]);
  assert.equal(normalizeListingImageGallery(urls[0], [...urls.slice(1), "https://img.test/extra.jpg"]).ok, false);
});

test("location galleries allow twenty images while marketplace articles remain capped at ten", () => {
  const images = Array.from({ length: MAX_LOCATION_IMAGES }, (_, index) => `https://img.test/location-${index}.jpg`);
  assert.equal(maxImagesForListingType("location"), 20);
  assert.equal(maxImagesForListingType("prop"), 10);
  assert.equal(normalizeListingImageGallery(images[0], images.slice(1), maxImagesForListingType("location")).ok, true);
  assert.equal(normalizeListingImageGallery(images[0], [...images.slice(1), "https://img.test/location-20.jpg"], maxImagesForListingType("location")).ok, false);
});

test("duplicate and blank image links are removed without changing the first-image choice", () => {
  assert.deepEqual(normalizeListingImageGallery(" https://img.test/a.jpg ", ["", "https://img.test/a.jpg", "https://img.test/b.jpg"]), {
    ok: true,
    gallery: { imageUrl: "https://img.test/a.jpg", extraImages: ["https://img.test/b.jpg"] },
  });
});

test("mobile-friendly reorder operations promote, demote, and remove images predictably", () => {
  const original = ["cover.jpg", "two.jpg", "three.jpg"];
  assert.deepEqual(moveGalleryImage(original, 2, 0), ["three.jpg", "cover.jpg", "two.jpg"]);
  assert.deepEqual(moveGalleryImage(original, 0, 1), ["two.jpg", "cover.jpg", "three.jpg"]);
  assert.deepEqual(moveGalleryImage(original, -1, 1), original);
});

test("only successfully uploaded images are included in persisted data", () => {
  assert.deepEqual(galleryUrlsFromEntries([
    { url: "first.jpg", status: "ready" },
    { url: "pending-preview.jpg", status: "uploading" },
    { url: "failed-preview.jpg", status: "failed" },
    { url: "last.jpg", status: "ready" },
  ]), ["first.jpg", "last.jpg"]);
});

test("gallery previews stay bounded and expose hidden-image counts for one through twenty location photos", () => {
  for (let count = 1; count <= MAX_LOCATION_IMAGES; count += 1) {
    const images = Array.from({ length: count }, (_, index) => `photo-${index + 1}.jpg`);
    const preview = getListingGalleryPreview(images);
    assert.equal(preview.activeImage, images[0]);
    assert.equal(preview.thumbnails.length, Math.min(count - 1, LISTING_GALLERY_PREVIEW_LIMIT));
    assert.equal(preview.additionalCount, Math.max(0, count - 1 - LISTING_GALLERY_PREVIEW_LIMIT));
    assert.deepEqual(preview.thumbnails.map(({ index }) => index), images.slice(1, LISTING_GALLERY_PREVIEW_LIMIT + 1).map((_, index) => index + 1));
  }
  const selected = getListingGalleryPreview(["one.jpg", "two.jpg", "three.jpg"], 2);
  assert.equal(selected.activeImage, "three.jpg");
  assert.deepEqual(selected.thumbnails.map(({ url }) => url), ["one.jpg", "two.jpg"]);
});
