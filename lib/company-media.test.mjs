import test from "node:test";
import assert from "node:assert/strict";
import { MAX_COMPANY_GALLERY_IMAGES, canPersistCompanyImages, isCompanyImageUrlOwnedByUser, moveCompanyGalleryImage } from "./company-media.ts";

const storage = "https://project.supabase.co";
const image = (user, name) => `${storage}/storage/v1/object/public/listing-images/${user}/${name}.webp`;

test("company gallery can be reordered without losing images", () => {
  assert.deepEqual(moveCompanyGalleryImage(["logo", "team", "studio"], 2, 0), ["studio", "logo", "team"]);
  assert.deepEqual(moveCompanyGalleryImage(["logo", "team"], 0, 4), ["logo", "team"]);
});

test("company image references must be prior saved URLs or uploads owned by the editor", () => {
  assert.equal(isCompanyImageUrlOwnedByUser(image("user_123", "photo"), "user_123", storage), true);
  assert.equal(isCompanyImageUrlOwnedByUser(image("user_other", "photo"), "user_123", storage), false);
  assert.equal(canPersistCompanyImages([image("user_123", "new")], [], "user_123", storage), true);
  assert.equal(canPersistCompanyImages([image("user_other", "private")], [], "user_123", storage), false);
  assert.equal(canPersistCompanyImages(["https://legacy-cdn.test/old.jpg"], ["https://legacy-cdn.test/old.jpg"], "user_123", storage), true);
  assert.equal(canPersistCompanyImages(Array.from({ length: MAX_COMPANY_GALLERY_IMAGES + 1 }, () => image("user_123", "a")), [], "user_123", storage), false);
  const legacyGallery = Array.from({ length: MAX_COMPANY_GALLERY_IMAGES + 2 }, (_, index) => `https://legacy-cdn.test/${index}.jpg`);
  assert.equal(canPersistCompanyImages(legacyGallery, legacyGallery, "user_123", storage), true);
  assert.equal(canPersistCompanyImages([...legacyGallery, image("user_123", "new")], legacyGallery, "user_123", storage), false);
  assert.equal(canPersistCompanyImages([...legacyGallery.slice(0, MAX_COMPANY_GALLERY_IMAGES - 1), image("user_123", "new")], legacyGallery, "user_123", storage), true);
});
