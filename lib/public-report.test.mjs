import test from "node:test";
import assert from "node:assert/strict";
import { validatePublicReport } from "./public-report.ts";

const base = {
  target: "https://www.cinegenius.co/profile/test",
  category: "rights",
  details: "This public profile uses an image without the required permission.",
  reporterName: "Test Reporter",
  reporterEmail: "reporter@example.invalid",
  goodFaith: true,
};

test("public reports accept CineGenius URLs and normalize optional contact fields", () => {
  const result = validatePublicReport({ ...base, target: "/props/test", reporterName: "  Test   Reporter  ", reporterEmail: "REPORTER@EXAMPLE.INVALID" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.ok && result.value, {
    target: "/props/test",
    category: "rights",
    details: base.details,
    reporterName: "Test Reporter",
    reporterEmail: "reporter@example.invalid",
  });
  assert.equal(validatePublicReport({ ...base, target: "https://www.cinegenius.de/profile/test" }).ok, true);
});

test("public reports reject foreign targets, invalid categories and weak descriptions", () => {
  assert.deepEqual(validatePublicReport({ ...base, target: "https://evil.example/test" }), { ok: false, error: "target" });
  assert.deepEqual(validatePublicReport({ ...base, category: "support" }), { ok: false, error: "category" });
  assert.deepEqual(validatePublicReport({ ...base, details: "too short" }), { ok: false, error: "details" });
});

test("public reports require good-faith confirmation and validate email only when supplied", () => {
  assert.deepEqual(validatePublicReport({ ...base, reporterEmail: "not-an-email" }), { ok: false, error: "email" });
  assert.deepEqual(validatePublicReport({ ...base, reporterEmail: "", reporterName: "" }).ok, true);
  assert.deepEqual(validatePublicReport({ ...base, goodFaith: false }), { ok: false, error: "goodFaith" });
});
