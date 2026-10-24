import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../app/page.tsx");
const navbar = read("../components/Navbar.tsx");
const layout = read("../app/layout.tsx");
const appChrome = read("../components/AppChrome.tsx");
const profile = read("../app/profile/page.tsx");
const signIn = read("../app/sign-in/[[...sign-in]]/page.tsx");
const signUp = read("../app/sign-up/[[...sign-up]]/page.tsx");
const authForm = read("../components/AuthForm.tsx");

test("logged-out homepage exposes registration and sign-in in the first-screen hero", () => {
  assert.match(home, /const isLoggedIn = !!userId;/);
  assert.match(home, /const ctaHref = isLoggedIn \? "\/dashboard" : "\/sign-up";/);
  assert.match(home, /href="\/search"\s+prefetch[\s\S]{0,250}t\("heroSearchAction"\)/);
  assert.match(home, /href=\{ctaHref\}\s+prefetch[\s\S]{0,300}\{isLoggedIn \? t\("heroManageAction"\) : t\("heroPresentAction"\)\}/);
  assert.match(navbar, /href="\/sign-in"[\s\S]{0,250}\{t\("signIn"\)\}/);
  assert.match(navbar, /href="\/sign-up"[\s\S]{0,250}\{t\("signUp"\)\}/);
});

test("desktop navigation sends visitors to same-host sign-in and registration pages", () => {
  assert.match(navbar, /href="\/sign-in"[\s\S]{0,250}\{t\("signIn"\)\}/);
  assert.match(navbar, /href="\/sign-up"[\s\S]{0,250}\{t\("signUp"\)\}/);
  assert.doesNotMatch(navbar, /openSignIn|openSignUp/);
});

test("mobile navigation exposes both authentication actions outside the menu", () => {
  assert.match(navbar, /initialIsSignedIn/);
  assert.match(navbar, /!hasSignedInSession\s*&&\s*\([\s\S]*?href="\/sign-in"\s+prefetch[\s\S]*?href="\/sign-up"\s+prefetch/);
  assert.match(layout, /<AppChrome initialIsSignedIn=\{!!userId\}/);
  assert.match(appChrome, /<Navbar initialIsSignedIn=\{initialIsSignedIn\}/);
});

test("profile photo changes refresh navigation and account menu immediately", () => {
  const dashboard = read("../app/dashboard/page.tsx");
  const creators = read("../app/creators/CreatorsContent.tsx");
  assert.match(profile, /isAvatarUploadAssociated\(savedUrl, uploadId\)/);
  assert.match(profile, /fetch\("\/api\/profile", \{ cache: "no-store" \}\)/);
  assert.match(profile, /publishProfileUpdated\(\{ userId: user\?\.id, displayName: form\.name, avatarUrl: url \}\)/);
  assert.match(navbar, /subscribeToProfileUpdated/);
  assert.match(navbar, /profileAvatarUrl/);
  assert.match(navbar, /json\.profile\?\.avatar_url/);
  assert.match(dashboard, /subscribeToProfileUpdated/);
  assert.match(creators, /subscribeToProfileUpdated/);
  assert.match(read("../lib/profile-update-events.ts"), /cg-profile-updated-event/);
  assert.match(navbar, /cache: "no-store"/);
  assert.match(navbar, /initialProfileRevision !== profileUpdateRevision\.current/);
});

test("Clerk account-switch links stay on the app host and show clear reciprocal prompts", () => {
  assert.match(authForm, /Noch kein Konto\?[\s\S]*Jetzt registrieren/);
  assert.match(authForm, /Schon registriert\?[\s\S]*Anmelden/);
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
  assert.match(authForm, /Tätigkeiten und Profildetails ergänzt du anschließend/);
  assert.match(authForm, /busy \? "Konto wird erstellt …" : "Konto erstellen"/);
});
