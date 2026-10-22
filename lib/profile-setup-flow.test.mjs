import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shouldSkipProfileSetup } from "./profile-setup-flow.ts";

test("new registrations enter guided setup even if a profile row already exists", () => {
  assert.equal(shouldSkipProfileSetup({ hasExistingProfile: true, hasInProgressDraft: false, isNewRegistration: true }), false);
});

test("existing profile setup is skipped unless there is resumable progress", () => {
  assert.equal(shouldSkipProfileSetup({ hasExistingProfile: true, hasInProgressDraft: false, isNewRegistration: false }), true);
  assert.equal(shouldSkipProfileSetup({ hasExistingProfile: true, hasInProgressDraft: true, isNewRegistration: false }), false);
  assert.equal(shouldSkipProfileSetup({ hasExistingProfile: false, hasInProgressDraft: false, isNewRegistration: false }), false);
});

test("signup redirects and provider fallback both enter the guided setup", () => {
  const signUpPage = readFileSync(new URL("../app/sign-up/[[...sign-up]]/page.tsx", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(signUpPage, /getSignUpSetupDestination\(destination\)/);
  assert.match(layout, /signUpForceRedirectUrl="\/profile-setup\?welcome=1"/);
});
