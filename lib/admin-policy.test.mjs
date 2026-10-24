import test from "node:test";
import assert from "node:assert/strict";
import { isConfiguredAdmin, validateAdminReason } from "./admin-policy.ts";

test("admin policy allows only an exact configured Clerk ID", () => {
  assert.equal(isConfiguredAdmin("user_admin", "user_admin,user_other"), true);
  assert.equal(isConfiguredAdmin("user_regular", "user_admin,user_other"), false);
  assert.equal(isConfiguredAdmin("user_admin_extra", "user_admin"), false);
  assert.equal(isConfiguredAdmin("user_admin", undefined), false);
  assert.equal(isConfiguredAdmin(null, "user_admin"), false);
});

test("admin action reasons must be human-readable and bounded", () => {
  assert.equal(validateAdminReason("  Review confirmed  "), "Review confirmed");
  assert.equal(validateAdminReason("1234"), null);
  assert.equal(validateAdminReason("x".repeat(501)), null);
  assert.equal(validateAdminReason(undefined), null);
});
