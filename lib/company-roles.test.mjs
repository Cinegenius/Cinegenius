import test from "node:test";
import assert from "node:assert/strict";
import { canCompanyRole, canCompanyRoleManageTarget, companyPermissionRoleForStorage, normalizeCompanyPermissionRole, normalizeCompanyPublicTitles, publicTitlesForMember } from "./company-roles.ts";

test("company public titles are distinct from permission roles", () => {
  assert.deepEqual(normalizeCompanyPublicTitles(["Geschäftsführer/in", "Catering-Leitung", "Catering-Leitung", "  Technische   Leitung "]), ["Geschäftsführer/in", "Catering-Leitung", "Technische Leitung"]);
  assert.deepEqual(publicTitlesForMember([], "Oberbeleuchter"), ["Oberbeleuchter"]);
  assert.equal(normalizeCompanyPermissionRole("Geschäftsführer/in"), null);
  assert.equal(companyPermissionRoleForStorage("editor"), "manager");
  assert.equal(normalizeCompanyPermissionRole(companyPermissionRoleForStorage("editor")), "editor");
});

test("least-privilege company capabilities keep owners separate from titles", () => {
  assert.equal(canCompanyRole("owner", "manage_permissions"), true);
  assert.equal(canCompanyRole("admin", "manage_team"), true);
  assert.equal(canCompanyRole("editor", "edit_company"), true);
  assert.equal(canCompanyRole("editor", "manage_team"), false);
  assert.equal(canCompanyRole("member", "edit_offers"), false);
  assert.equal(canCompanyRole("manager", "edit_company"), true);
  assert.equal(canCompanyRoleManageTarget("admin", "member", "editor"), true);
  assert.equal(canCompanyRoleManageTarget("admin", "member", "admin"), false);
  assert.equal(canCompanyRoleManageTarget("owner", "admin", "editor"), true);
  assert.equal(canCompanyRoleManageTarget("admin", "owner", "member"), false);
});
