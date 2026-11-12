import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../app/page.tsx");
const heroSearch = read("../components/HeroSearch.tsx");
const navbar = read("../components/Navbar.tsx");
const layout = read("../app/layout.tsx");
const appChrome = read("../components/AppChrome.tsx");
const profile = read("../app/profile/page.tsx");
const signIn = read("../app/sign-in/[[...sign-in]]/page.tsx");
const signUp = read("../app/sign-up/[[...sign-up]]/page.tsx");
const authForm = read("../components/AuthForm.tsx");
const assertDirectAuthLink = (path, key) => {
  const start = navbar.indexOf(`href="${path}"`);
  assert.ok(start >= 0, `direct ${path} entry`);
  const link = navbar.slice(start, navbar.indexOf('</Link>', start));
  assert.match(link, /\bprefetch\b/);
  assert.ok(link.includes(`{t("${key}")}`), `translated ${path} label`);
};

test("logged-out homepage keeps usable GET search and direct registration and sign-in entrypoints", () => {
  assert.match(home, /const isLoggedIn = !!userId;/);
  assert.match(home, /const ctaHref = isLoggedIn \? "\/dashboard" : "\/sign-up";/);
  assert.match(home, /<HeroSearch\s*\/>/);
  assert.match(heroSearch, /action=\{tab.href\}\s+method="get"/);
  assert.match(heroSearch, /name="q"/);
  assert.match(heroSearch, /const cityParam = "cityText";/);
  assert.match(heroSearch, /name=\{cityParam\}/);
  assert.doesNotMatch(heroSearch, /name="city"/);
  assert.match(home, /href=\{ctaHref\}\s+prefetch[\s\S]{0,300}\{isLoggedIn \? t\("heroManageAction"\) : t\("heroPresentAction"\)\}/);
  assertDirectAuthLink("/sign-in", "signIn");
  assertDirectAuthLink("/sign-up", "signUp");
});

test("desktop navigation sends visitors to same-host sign-in and registration pages", () => {
  assertDirectAuthLink("/sign-in", "signIn");
  assertDirectAuthLink("/sign-up", "signUp");
  assert.doesNotMatch(navbar, /openSignIn|openSignUp/);
});

test("mobile navigation exposes both authentication actions outside the menu", () => {
  assert.match(navbar, /initialIsSignedIn/);
  assert.match(navbar, /!hasSignedInSession\s*&&\s*\([\s\S]*?href="\/sign-in"\s+prefetch[\s\S]*?href="\/sign-up"\s+prefetch/);
  assert.match(layout, /<AppChrome initialIsSignedIn=\{!!userId\}/);
  assert.match(appChrome, /<Navbar initialIsSignedIn=\{initialIsSignedIn\}/);
});

test("profile photo updates reach content surfaces while header account controls keep a stable icon", () => {
  const dashboard = read("../app/dashboard/page.tsx");
  const creators = read("../app/creators/CreatorsContent.tsx");
  assert.match(profile, /isAvatarUploadAssociated\(savedUrl, uploadId\)/);
  assert.match(profile, /fetch\("\/api\/profile", \{ cache: "no-store" \}\)/);
  assert.match(profile, /publishProfileUpdated\(\{ userId: user\?\.id, displayName: form\.name, avatarUrl: url, focalPoint \}\)/);
  assert.match(navbar, /subscribeToProfileUpdated/);
  assert.doesNotMatch(navbar, /profileAvatarUrl|json\.profile\?\.avatar_url|<Image/);
  assert.doesNotMatch(navbar, /fetch\("\/api\/profile"/);
  assert.match(navbar, /<User size=\{18\}/);
  assert.match(dashboard, /subscribeToProfileUpdated/);
  assert.match(creators, /subscribeToProfileUpdated/);
  assert.match(read("../lib/profile-update-events.ts"), /cg-profile-updated-event/);
  assert.match(navbar, /detail\?\.userId !== activeUserId/);
  assert.match(navbar, /setProfileData\(\{userId:activeUserId,displayName:detail.displayName\}\)/);
});

test("Clerk account-switch links stay on the app host and show clear reciprocal prompts", () => {
  assert.match(authForm, /t\("noAccount"\)[\s\S]*t\("registerNow"\)/);
  assert.match(authForm, /t\("existingAccount"\)[\s\S]*t\("signIn"\)/);
  assert.match(signIn, /if \(userId\) redirect\(destination\)/);
  assert.match(signIn, /<AuthForm[\s\S]*mode="sign-in"[\s\S]*destination=\{destination\}[\s\S]*getAuthSwitchDestination\("sign-up", destination\)/);
  assert.match(signUp, /if \(userId\) redirect\(destination\)/);
  assert.match(signUp, /<AuthForm[\s\S]*mode="sign-up"[\s\S]*destination=\{afterSignUp\}[\s\S]*getAuthSwitchDestination\("sign-in", destination\)/);
});

test("auth routes render real fields in server HTML and preserve required-only registration", () => {
  assert.match(authForm, /<form onSubmit=\{submitPassword\}/);
  assert.match(authForm, /useSignIn\(\)/);
  assert.match(authForm, /useSignUp\(\)/);
  assert.match(authForm, /emailAddress: email\.trim\(\), password/);
  assert.match(authForm, /signUp\.verifications\.sendEmailCode\(\)/);
  assert.match(authForm, /signUp\.verifications\.verifyEmailCode/);
  assert.match(authForm, /id="clerk-captcha"/);
  assert.match(authForm, /t\("accountOnly"\)/);
  assert.match(authForm, /busy \? t\("creatingAccount"\) : t\("createAccount"\)/);
});
