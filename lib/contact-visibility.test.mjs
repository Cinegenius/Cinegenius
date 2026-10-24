import test from "node:test";
import assert from "node:assert/strict";
import { canViewContactValue, normalizeContactVisibility, projectProfileContacts, visibleProfileContactFields } from "./contact-visibility.ts";

test("contact visibility defaults to hidden and rejects unknown values", () => {
  assert.equal(normalizeContactVisibility(undefined), "hidden");
  assert.equal(normalizeContactVisibility("admin"), "hidden");
  assert.equal(normalizeContactVisibility("public"), "public");
});

test("only explicitly public or member-visible contacts leave the server", () => {
  assert.equal(canViewContactValue("hidden", null), false);
  assert.equal(canViewContactValue("members", null), false);
  assert.equal(canViewContactValue("members", "user_123"), true);
  assert.equal(canViewContactValue("public", null), true);
});

test("profile contacts are projected only for their selected audience", () => {
  const profile = { phone: "+49 30 123", contact_email: "private@example.com" };
  const hidden = { phone: "hidden", contact_email: "hidden" };
  assert.deepEqual(projectProfileContacts(profile, hidden, null), {
    phone: null, contact_email: null, contact_requires_sign_in: true,
  });
  assert.deepEqual(projectProfileContacts(profile, hidden, "member_1"), {
    phone: null, contact_email: null, contact_requires_sign_in: false,
  });
  assert.deepEqual(projectProfileContacts(profile, { phone: "members", contact_email: "public" }, "member_1"), {
    phone: "+49 30 123", contact_email: "private@example.com", contact_requires_sign_in: false,
  });
  assert.deepEqual(projectProfileContacts(profile, hidden, "owner_1", true), {
    phone: "+49 30 123", contact_email: "private@example.com", contact_requires_sign_in: false,
  });
});

test("hidden contact columns are not selected for unauthorized viewers", () => {
  assert.deepEqual(visibleProfileContactFields({ phone: "hidden", contact_email: "members" }, null), []);
  assert.deepEqual(visibleProfileContactFields({ phone: "members", contact_email: "public" }, null), ["contact_email"]);
  assert.deepEqual(visibleProfileContactFields({ phone: "members", contact_email: "hidden" }, "member_1"), ["phone"]);
  assert.deepEqual(visibleProfileContactFields({ phone: "hidden", contact_email: "members" }, null, true), ["phone", "contact_email"]);
});
