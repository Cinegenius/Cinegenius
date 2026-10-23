import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const profileView = readFileSync(new URL("../app/profile/[slug]/ProfileView.tsx", import.meta.url), "utf8");
const roleList = readFileSync(new URL("../app/profile/[slug]/ProfileRoles.tsx", import.meta.url), "utf8");
const companyDetail = readFileSync(new URL("../app/companies/[slug]/CompanyDetail.tsx", import.meta.url), "utf8");

test("all public profile variants use the shared wrapping, expandable occupation list", () => {
  assert.equal((profileView.match(/<ProfileRoles positions=\{roleLabels\}/g) ?? []).length, 3);
  assert.match(roleList, /flex[^\n]*flex-wrap/);
  assert.match(roleList, /max-w-full/);
  assert.match(roleList, /\[overflow-wrap:anywhere\]/);
  assert.match(roleList, /Weitere Tätigkeiten anzeigen/);
  assert.match(roleList, /aria-expanded=\{expanded\}/);
});

test("profile content grid allows its details column to shrink below long-role min-content width", () => {
  assert.match(profileView, /sm:grid-cols-\[220px_minmax\(0,1fr\)\]/);
  assert.match(profileView, /min-w-0 max-w-full space-y-5/);
  assert.match(profileView, /break-words font-display text-4xl sm:text-5xl/);
});

test("company profiles wrap long public details instead of clipping page overflow", () => {
  assert.doesNotMatch(companyDetail, /pt-16 min-h-screen[^\"]*overflow-x-hidden/);
  assert.match(companyDetail, /\[overflow-wrap:anywhere\]/);
  assert.match(companyDetail, /lg:grid-cols-\[minmax\(0,1fr\)_240px\]/);
});
