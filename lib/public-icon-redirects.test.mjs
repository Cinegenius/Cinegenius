import test from "node:test";
import assert from "node:assert/strict";
import { getPublicIconRedirects } from "./public-icon-redirects.ts";

test("browser icon probes redirect to the existing CineGenius icon assets", () => {
  assert.deepEqual(getPublicIconRedirects(), [
    { source: "/favicon.ico", destination: "/icon.svg", permanent: false },
    { source: "/apple-touch-icon.png", destination: "/apple-icon.png", permanent: false },
  ]);
});
