import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createTranslator } from "use-intl/core";
import { prepareProfileMediaFile, sendProfileMediaFile, PROFILE_MEDIA_MAX_BYTES, PROFILE_MEDIA_SOURCE_MAX_BYTES } from "./profile-media-client.ts";

const locales = ["de", "en", "es", "it", "cs", "hu", "nl", "nl-BE", "sv"];
const image = () => new File(["image"], "photo.jpg", { type: "image/jpeg" });

async function withFetch(fetchFixture, run) {
  const previous = globalThis.fetch;
  globalThis.fetch = fetchFixture;
  try { await run(); } finally { globalThis.fetch = previous; }
}

for (const locale of locales) {
  const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
  const translate = createTranslator({ locale, messages });

  test(`profile upload uses native ${locale} validation and transport fallbacks`, async () => {
    let requests = 0;
    await withFetch(async () => { requests++; throw new TypeError("Failed to fetch"); }, async () => {
      const oversized = new File([new Uint8Array(PROFILE_MEDIA_MAX_BYTES + 1)], "large.jpg", { type: "image/jpeg" });
      await assert.rejects(sendProfileMediaFile(oversized, translate), { message: translate("mediaSecurity.tooLarge") });
      await assert.rejects(sendProfileMediaFile(new File(["invalid"], "bad.svg", { type: "image/svg+xml" }), translate), { message: translate("mediaSecurity.invalid") });
      assert.equal(requests, 0, "invalid files must not leave the browser");
      await assert.rejects(sendProfileMediaFile(image(), translate), { message: translate("mediaSecurity.saveFailed") });
      assert.equal(requests, 1);
    });
  });
}

test("profile upload preserves localized API business text, unknown prose and stable upload reference", async () => {
  const translate = key => `localized:${key}`;
  for (const message of ["Ce profil ne peut plus être modifié.", "Vendor gateway requires a valid image.", "Die Firma „Film und Foto“ hat keine Bearbeitung freigegeben."]) {
    await withFetch(async () => ({ ok: false, status: 403, json: async () => ({ error: message }) }), async () => {
      await assert.rejects(sendProfileMediaFile(image(), translate), { message });
    });
  }
  await withFetch(async (url, options) => {
    assert.equal(url, "/api/upload/profile-media");
    assert.equal(options.method, "POST");
    assert.equal(options.body.get("file").name, "photo.jpg");
    return { ok: true, status: 200, json: async () => ({ url: "/api/media/asset-id" }) };
  }, async () => {
    assert.equal(await sendProfileMediaFile(image(), translate), "/api/media/asset-id");
  });
});

test("profile upload maps HTTP-only failure and malformed transport responses to existing fallback", async () => {
  const translate = key => `localized:${key}`;
  const fixtures = [
    { ok: false, status: 502, json: async () => ({}) },
    { ok: false, status: 413, json: async () => { throw new SyntaxError("Unexpected token '<', not valid JSON"); } },
    { ok: false, status: 500, json: async () => ({ error: "UPLOAD_FAILED" }) },
    { ok: true, status: 200, json: async () => ({}) },
  ];
  for (const fixture of fixtures) {
    await withFetch(async () => fixture, async () => {
      await assert.rejects(sendProfileMediaFile(image(), translate), { message: translate("mediaSecurity.saveFailed") });
    });
  }
});

test("profile source and compression validation retain their structured contracts", async () => {
  let calls = 0;
  const compress = async file => { calls++; return file; };
  const sourceTooLarge = new File([new Uint8Array(PROFILE_MEDIA_SOURCE_MAX_BYTES + 1)], "large.heic", { type: "image/heic" });
  assert.deepEqual(await prepareProfileMediaFile(sourceTooLarge, compress), { file: null, error: "source-too-large" });
  assert.deepEqual(await prepareProfileMediaFile(new File([], "empty.jpg", { type: "image/jpeg" }), compress), { file: null, error: "empty" });
  assert.deepEqual(await prepareProfileMediaFile(new File(["svg"], "bad.svg", { type: "image/svg+xml" }), compress), { file: null, error: "unsupported" });
  assert.equal(calls, 0);

  const source = image();
  assert.deepEqual(await prepareProfileMediaFile(source, compress), { file: source, error: null });
  assert.equal(calls, 1);
  const largeCompressed = new File([new Uint8Array(PROFILE_MEDIA_MAX_BYTES + 1)], "large.webp", { type: "image/webp" });
  assert.deepEqual(await prepareProfileMediaFile(source, async () => largeCompressed), { file: null, error: "compressed-too-large" });
});
