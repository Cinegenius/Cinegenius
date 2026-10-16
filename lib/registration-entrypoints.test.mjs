import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../app/page.tsx");
const navbar = read("../components/Navbar.tsx");
const signIn = read("../app/sign-in/[[...sign-in]]/page.tsx");
const signUp = read("../app/sign-up/[[...sign-up]]/page.tsx");

test("logged-out homepage exposes registration and sign-in in the first-screen hero", () => {
  assert.match(home, /!isLoggedIn\s*&&\s*\(/);
  assert.match(home, /href="\/sign-up"[\s\S]{0,300}tn\("signUp"\)/);
  assert.match(home, /href="\/sign-in"[\s\S]{0,300}tn\("signIn"\)/);
});

test("desktop navigation sends visitors to same-host sign-in and registration pages", () => {
  assert.match(navbar, /href="\/sign-in"[\s\S]{0,250}\{t\("signIn"\)\}/);
  assert.match(navbar, /href="\/sign-up"[\s\S]{0,250}\{t\("signUp"\)\}/);
  assert.doesNotMatch(navbar, /openSignIn|openSignUp/);
});

test("Clerk account-switch links stay on the app host and show clear reciprocal prompts", () => {
  assert.match(signIn, /signUpUrl="\/sign-up"/);
  assert.match(signIn, /Noch kein Konto\?[\s\S]*Jetzt registrieren/);
  assert.match(signUp, /signInUrl="\/sign-in"/);
  assert.match(signUp, /Schon registriert\?[\s\S]*Anmelden/);
});
