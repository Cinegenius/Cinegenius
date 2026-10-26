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

test('empty and placeholder profiles enter welcome even with a stale personal completion flag', async () => {
  const { requiredSetupDestination, hasProfileBasics } = await import('./profile-setup-flow.ts');
  for (const profile of [null,{}, {display_name:''}, {display_name:'Alex',location:'',positions:['Kamera']}]) {
    assert.equal(hasProfileBasics(profile), false);
    assert.equal(requiredSetupDestination(profile,{setupComplete:true,intent:'crew'}),'/profile-setup?welcome=1');
  }
});

test('completed basic profiles, including private profiles without photos or bio, are not forced through setup', async () => {
  const { requiredSetupDestination, hasProfileBasics } = await import('./profile-setup-flow.ts');
  const profile={display_name:'Alex',location:'München',positions:['Kamera']};
  assert.equal(hasProfileBasics(profile),true);
  assert.equal(requiredSetupDestination(profile,null),null);
  assert.equal(requiredSetupDestination(profile,{setupComplete:true,intent:'crew'}),null);
  assert.equal(requiredSetupDestination({...profile,positions:[],profile_type:'actor'},null),null);
});

test('finished searchers and offer-only providers never require a personal Crew profile', async () => {
  const { requiredSetupDestination } = await import('./profile-setup-flow.ts');
  for (const intent of ['search','company','location','equipment']) assert.equal(requiredSetupDestination(null,{setupComplete:true,intent}),null);
});

test('unfinished multi-role setup resumes and old private provider drafts keep their editor', async () => {
  const { requiredSetupDestination } = await import('./profile-setup-flow.ts');
  assert.equal(requiredSetupDestination(null,{quickStart:{step:'details'},setupComplete:false}),'/profile-setup?resume=1');
  assert.equal(requiredSetupDestination({display_name:'Alex',location:'Wien',positions:['Ton']},{quickStart:{},setupComplete:false}),'/profile-setup?resume=1');
  assert.equal(requiredSetupDestination(null,{intent:'company',companyDraft:{name:'Firma'}}),'/company-setup?onboarding=1&resume=1');
});
