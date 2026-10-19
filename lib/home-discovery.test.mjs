import test from "node:test";
import assert from "node:assert/strict";
import { extractPublicProfilePhotos } from "./home-discovery.ts";

test("home gallery includes uploaded portfolio and project-like photos but skips headshots and external URLs", () => {
  const photos = extractPublicProfilePhotos([{
    user_id: "u1",
    display_name: "Mara",
    profile_images: [
      { url: "https://example.supabase.co/storage/v1/object/public/portfolio/a.jpg", media_type: "portfolio", caption: "Set" },
      { url: "https://example.supabase.co/storage/v1/object/public/avatars/a.jpg", media_type: "headshot" },
      { url: "https://example.supabase.co/storage/v1/object/public/portfolio/b.jpg", media_type: "set_photo" },
      { url: "https://images.example.com/external.jpg", media_type: "portfolio" },
    ],
    portfolio_images: ["https://example.supabase.co/storage/v1/object/public/portfolio/a.jpg"],
  }]);
  assert.equal(photos.length, 2);
  assert.deepEqual(photos.map((photo) => photo.caption), ["Set", ""]);
});
