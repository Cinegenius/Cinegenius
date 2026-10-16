import test from "node:test";
import assert from "node:assert/strict";
import { validateUpload } from "./uploadGuard.ts";
import { PROFILE_MEDIA_MAX_BYTES, PROFILE_MEDIA_MIME_TYPES, PROFILE_MEDIA_SOURCE_MAX_BYTES, validateCompressedProfileMedia, validateProfileMediaSource } from "./profile-media.ts";

test("profile media source accepts JPG, PNG and WEBP only", () => {
  for (const type of PROFILE_MEDIA_MIME_TYPES) {
    assert.equal(validateProfileMediaSource(new File(["image"], "photo", { type })), null);
  }
  assert.equal(validateProfileMediaSource(new File(["image"], "photo.gif", { type: "image/gif" })), "unsupported");
});

test("profile media source enforces its 20 MB limit before compression", () => {
  assert.equal(validateProfileMediaSource(new File([new Uint8Array(PROFILE_MEDIA_SOURCE_MAX_BYTES)], "max.jpg", { type: "image/jpeg" })), null);
  assert.equal(validateProfileMediaSource(new File([new Uint8Array(PROFILE_MEDIA_SOURCE_MAX_BYTES + 1)], "large.jpg", { type: "image/jpeg" })), "too-large");
});

test("profile media rejects a compressed output above 4 MB", () => {
  assert.equal(validateCompressedProfileMedia(new File([new Uint8Array(PROFILE_MEDIA_MAX_BYTES)], "photo.webp", { type: "image/webp" })), null);
  assert.equal(validateCompressedProfileMedia(new File([new Uint8Array(PROFILE_MEDIA_MAX_BYTES + 1)], "photo.webp", { type: "image/webp" })), "compressed-too-large");
});

test("server upload validates profile-image size and magic bytes", async () => {
  const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], "renamed.txt", { type: "text/plain" });
  const accepted = await validateUpload(jpeg, { maxBytes: PROFILE_MEDIA_MAX_BYTES, allowedMimeTypes: PROFILE_MEDIA_MIME_TYPES });
  assert.equal("error" in accepted, false);
  if (!("error" in accepted)) assert.equal(accepted.mime, "image/jpeg");

  const svg = new File(["<svg xmlns='http://www.w3.org/2000/svg'></svg>"], "photo.svg", { type: "image/svg+xml" });
  const rejectedType = await validateUpload(svg, { maxBytes: PROFILE_MEDIA_MAX_BYTES, allowedMimeTypes: PROFILE_MEDIA_MIME_TYPES });
  assert.deepEqual(rejectedType, { error: "Ungültiges Dateiformat.", status: 415 });

  const oversized = new File([new Uint8Array(PROFILE_MEDIA_MAX_BYTES + 1)], "large.jpg", { type: "image/jpeg" });
  const rejectedSize = await validateUpload(oversized, { maxBytes: PROFILE_MEDIA_MAX_BYTES });
  assert.deepEqual(rejectedSize, { error: "Datei zu groß (max. 4 MB)", status: 413 });
});
