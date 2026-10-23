import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isAvatarUploadAssociated, persistAvatarAssociation } from "./profile-avatar-persistence.ts";

test("lost upload response is reconciled only against the exact stored upload id", () => {
  const id = "0123456789abcdef0123456789abcdef";
  assert.equal(isAvatarUploadAssociated(`https://storage.example/avatars/${id}.webp`, id), true);
  assert.equal(isAvatarUploadAssociated(`https://storage.example/avatars/other.webp`, id), false);
  assert.equal(isAvatarUploadAssociated(`https://storage.example/avatars/${id}.svg`, id), false);
});

test("avatar persistence reports success only after the profile row is associated", async () => {
  let releaseUpdate;
  let updateResolved = false;
  const pendingUpdate = new Promise((resolve) => { releaseUpdate = resolve; });
  const removed = [];
  const resultPromise = persistAvatarAssociation({
    url: "https://storage.example/new-avatar.webp",
    path: "profile-media/avatars/user/new.webp",
    update: async () => {
      await pendingUpdate;
      updateResolved = true;
      return { updated: true, error: null };
    },
    readCurrentUrl: async () => ({ ok: true, url: null }),
    removeUnusedAsset: async (path) => removed.push(path),
  });

  let settled = false;
  resultPromise.then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);
  releaseUpdate();
  assert.deepEqual(await resultPromise, { status: "saved" });
  assert.equal(updateResolved, true);
  assert.deepEqual(removed, []);
});

test("an ambiguous write is accepted only if a read confirms the exact new URL", async () => {
  const removed = [];
  const result = await persistAvatarAssociation({
    url: "https://storage.example/new-avatar.webp",
    path: "profile-media/avatars/user/new.webp",
    update: async () => ({ updated: false, error: new Error("response lost") }),
    readCurrentUrl: async () => ({ ok: true, url: "https://storage.example/new-avatar.webp" }),
    removeUnusedAsset: async (path) => removed.push(path),
  });
  assert.deepEqual(result, { status: "saved" });
  assert.deepEqual(removed, []);
});

test("failed association preserves an uncertain file and only removes confirmed unused uploads", async () => {
  const retained = await persistAvatarAssociation({
    url: "https://storage.example/new-avatar.webp",
    path: "profile-media/avatars/user/new.webp",
    update: async () => ({ updated: false, error: new Error("write failed") }),
    readCurrentUrl: async () => ({ ok: false, url: null }),
    removeUnusedAsset: async () => assert.fail("must not remove an uncertain object"),
  });
  assert.deepEqual(retained, { status: "failed" });

  const removed = [];
  const conflict = await persistAvatarAssociation({
    url: "https://storage.example/new-avatar.webp",
    path: "profile-media/avatars/user/new.webp",
    update: async () => ({ updated: false, error: null }),
    readCurrentUrl: async () => ({ ok: true, url: "https://storage.example/other-avatar.webp" }),
    removeUnusedAsset: async (path) => removed.push(path),
  });
  assert.deepEqual(conflict, { status: "conflict" });
  assert.deepEqual(removed, ["profile-media/avatars/user/new.webp"]);
});

test("avatar API requires the signed-in owner and associates only after storage upload", () => {
  const source = readFileSync(new URL("../app/api/profile/avatar/route.ts", import.meta.url), "utf8");
  assert.match(source, /requireAuth\(\)/);
  assert.match(source, /buildStoragePath\(userId, validation\.ext, "profile-media\/avatars", uploadId\)/);
  assert.match(source, /\.eq\("user_id", userId\)/);
  assert.match(source, /persistAvatarAssociation\(/);
  assert.match(source, /revalidateTag\("profiles", \{ expire: 0 \}\)/);
  assert.match(source, /revalidateTag\("creator-directory", \{ expire: 0 \}\)/);
});
