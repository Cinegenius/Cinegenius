import test from "node:test";
import assert from "node:assert/strict";
import { safeAuthRedirect } from "./auth-redirect.ts";

test("auth redirects preserve safe same-site destinations", () => {
  assert.equal(safeAuthRedirect("/jobs?role=Kamera#neu", "/dashboard"), "/jobs?role=Kamera#neu");
});

test("regular sign-in falls back to the homepage while preserving explicit safe returns", () => {
  assert.equal(safeAuthRedirect(undefined, "/", ["/sign-in", "/sign-up"]), "/");
  assert.equal(safeAuthRedirect("/dashboard?tab=messages", "/", ["/sign-in", "/sign-up"]), "/dashboard?tab=messages");
  assert.equal(safeAuthRedirect("https://example.com/", "/", ["/sign-in", "/sign-up"]), "/");
});

test("auth redirects reject external, protocol-relative, and backslash destinations", () => {
  assert.equal(safeAuthRedirect("https://example.com/", "/dashboard"), "/dashboard");
  assert.equal(safeAuthRedirect("//example.com/", "/dashboard"), "/dashboard");
  assert.equal(safeAuthRedirect("/\\example.com", "/dashboard"), "/dashboard");
});

test("auth entry points cannot redirect back into themselves", () => {
  assert.equal(safeAuthRedirect("/sign-in/verify", "/dashboard", ["/sign-in", "/sign-up"]), "/dashboard");
  assert.equal(safeAuthRedirect(["/profile", "/jobs"], "/dashboard"), "/profile");
});
