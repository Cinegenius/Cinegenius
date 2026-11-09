import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const profileView = readFileSync(new URL("../app/profile/[slug]/ProfileView.tsx", import.meta.url), "utf8");
const roleList = readFileSync(new URL("../app/profile/[slug]/ProfileRoles.tsx", import.meta.url), "utf8");
const companyDetail = readFileSync(new URL("../app/companies/[slug]/CompanyDetail.tsx", import.meta.url), "utf8");

test("all public profile variants use the shared wrapping, expandable occupation list", () => {
  assert.equal((profileView.match(/<ProfileRoles positions=\{roleLabels/g) ?? []).length, 3);
  assert.match(roleList, /flex[^\n]*flex-wrap/);
  assert.match(roleList, /max-w-full/);
  assert.match(roleList, /\[overflow-wrap:anywhere\]/);
  assert.match(roleList, /t\("showMore", \{ count: remaining \}\)/);
  assert.match(roleList, /aria-expanded=\{expanded\}/);
});

test("profile content grid allows its details column to shrink below long-role min-content width", () => {
  assert.match(profileView, /md:has-\[>aside:not\(:empty\)\]:grid-cols-\[200px_minmax\(0,1fr\)\]/);
  assert.match(profileView, /min-w-0 max-w-full space-y-6 sm:space-y-8/);
  assert.match(profileView, /break-words font-display text-xl sm:text-3xl/);
});

test("compact cover identity preserves the square crop and separates additional occupations", () => {
  assert.match(profileView, /<ProfileCardPhoto[^\n]+focalPoint=\{profile.focal_point\}[^\n]+rounded-xl/);
  assert.match(profileView, /imageStyle=\{profileCoverStyle\(profile.focal_point\)\}/);
  assert.match(profileView, /<ProfileRoles positions=\{roleLabels.slice\(1\)\} secondaryOnly/);
  assert.match(roleList, /index === 0 && !secondaryOnly/);
});

test("company profiles wrap long public details instead of clipping page overflow", () => {
  assert.doesNotMatch(companyDetail, /pt-16 min-h-screen[^\"]*overflow-x-hidden/);
  assert.match(companyDetail, /\[overflow-wrap:anywhere\]/);
  assert.match(companyDetail, /lg:grid-cols-\[minmax\(0,1fr\)_240px\]/);
});
