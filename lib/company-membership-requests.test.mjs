import test from "node:test";
import assert from "node:assert/strict";
import { companyDashboardRequestsUrl, companyPublicTitlesDiffer, isPublicCompanyMembership, normalizeCompanyRequestMessage } from "./company-membership-requests.ts";

test("only accepted company memberships are public", () => {
  assert.equal(isPublicCompanyMembership("accepted"), true);
  assert.equal(isPublicCompanyMembership("pending"), false);
  assert.equal(isPublicCompanyMembership("rejected"), false);
  assert.equal(isPublicCompanyMembership(null), false);
});

test("company request messages are plain, bounded text", () => {
  assert.equal(normalizeCompanyRequestMessage("  Ich  arbeite\n\t dort. \u0000 "), "Ich arbeite dort.");
  assert.equal(normalizeCompanyRequestMessage("x".repeat(600)).length, 500);
  assert.equal(normalizeCompanyRequestMessage(null), "");
});

test("approval notices detect changed functions and keep the saved order", () => {
  assert.equal(companyPublicTitlesDiffer(["Produktion", "Projektleitung"], ["Produktion", "Projektleitung"]), false);
  assert.equal(companyPublicTitlesDiffer(["Produktion"], ["Technische Leitung"]), true);
  assert.equal(companyPublicTitlesDiffer([], ["Catering-Leitung"]), true);
});

test("company request notifications open the requests section for the right company", () => {
  assert.equal(companyDashboardRequestsUrl("company/id"), "/company-dashboard?company_id=company%2Fid&tab=team&team_view=requests");
});
