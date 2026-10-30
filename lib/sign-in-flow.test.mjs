import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { finalizeThenNavigate, getMfaResendChannel, getPasswordSignInAction, resolveAuthNavigationUrl, selectSecondFactor, shouldRedirectForActiveSession } from "./sign-in-flow.ts";

function permutations(values) {
  if (values.length < 2) return [values];
  return values.flatMap((value, index) => permutations(values.filter((_, candidate) => candidate !== index))
    .map((tail) => [value, ...tail]));
}

const candidateFactors = ["email_code", "phone_code", "totp", "backup_code", "unsupported_factor"];
const factorCases = [];
for (let mask = 0; mask < 1 << candidateFactors.length; mask += 1) {
  const subset = candidateFactors.filter((_, index) => mask & (1 << index));
  factorCases.push(...permutations(subset));
}

const expectedPriority = ["email_code", "phone_code", "totp", "backup_code"];
for (const supported of factorCases) {
  const expected = expectedPriority.find((factor) => supported.includes(factor)) ?? null;
  test(`selects the preferred supported MFA factor from [${supported.join(", ")}]`, () => {
    assert.equal(selectSecondFactor(supported), expected);
  });
}

const passwordStatusCases = [
  ["complete", "complete"],
  ["needs_second_factor", "mfa"],
  ["needs_client_trust", "mfa"],
  ["needs_first_factor", "unsupported"],
  ["needs_identifier", "unsupported"],
  ["needs_new_password", "unsupported"],
  ["aborted", "unsupported"],
  [null, "unsupported"],
  [undefined, "unsupported"],
];
for (const [status, expected] of passwordStatusCases) {
  test(`maps password sign-in status ${String(status)} to the correct next step`, () => {
    assert.equal(getPasswordSignInAction(status), expected);
  });
}

const resendCases = [
  ["email_code", "email"],
  ["phone_code", "phone"],
  ["totp", null],
  ["backup_code", null],
  ["passkey", null],
  ["", null],
  [null, null],
  [undefined, null],
];
for (const [factor, expected] of resendCases) {
  test(`maps MFA resend factor ${String(factor)} to the correct channel`, () => {
    assert.equal(getMfaResendChannel(factor), expected);
  });
}

test("the MFA form exposes a resend action only for code-based factors", () => {
  const source = readFileSync(new URL("../components/AuthForm.tsx", import.meta.url), "utf8");
  assert.match(source, /step === "mfa" && getMfaResendChannel\(factor\)/);
  assert.match(source, /onClick=\{\(\) => void resendSecondFactorCode\(\)\}/);
  assert.match(source, /channel === "email" \? signIn\.mfa\.sendEmailCode\(\) : signIn\.mfa\.sendPhoneCode\(\)/);
});

test("password sign-in never silently switches to email-code sign-in", () => {
  const source = readFileSync(new URL("../components/AuthForm.tsx", import.meta.url), "utf8");
  const passwordHandler = source.slice(source.indexOf("const submitPassword ="), source.indexOf("const sendEmailCode ="));
  assert.doesNotMatch(passwordHandler, /signIn\.emailCode\.sendCode/);
  assert.match(source, /onClick=\{\(\) => void sendEmailCode\(\)\}/);
  assert.match(passwordHandler, /Die Passwortanmeldung wurde nicht abgeschlossen/);
});

test("a pre-existing session redirects, but a session transition during submitted sign-in does not start a competing redirect", () => {
  assert.equal(shouldRedirectForActiveSession(true, true, false), true);
  assert.equal(shouldRedirectForActiveSession(false, true, false), false);
  assert.equal(shouldRedirectForActiveSession(true, false, false), false);
  assert.equal(shouldRedirectForActiveSession(true, true, true), false);
  const attemptInFlight = true;
  const noError = "";
  const finalizeError = "Finalize failed";
  assert.equal(shouldRedirectForActiveSession(true, true, attemptInFlight && !noError), false);
  // Once a finalize error is surfaced, an already-activated session wins.
  assert.equal(shouldRedirectForActiveSession(true, true, attemptInFlight && !finalizeError), true);
});

test("navigation starts at Clerk's authorized callback before auth-state observers refresh the old route", async () => {
  const order = [];
  const paths = [];
  const result = await finalizeThenNavigate(async ({ navigate }) => {
    order.push("session-cookie-established");
    navigate({ decorateUrl: (url) => `https://clerk.cinegenius.co/v1/client/touch?redirect_url=${encodeURIComponent(url)}` });
    order.push("auth-observers-notified");
    return { error: null };
  }, "/dashboard", (url) => {
    order.push("navigate");
    paths.push(url);
  });
  assert.equal(result.error, null);
  assert.deepEqual(order, ["session-cookie-established", "navigate", "auth-observers-notified"]);
  assert.equal(paths.length, 1);
  assert.match(paths[0], /^https:\/\/clerk\.cinegenius\.co\/v1\/client\/touch\?/);
});

test("a failed activation does not request navigation and no fallback forces it", async () => {
  const paths = [];
  const result = await finalizeThenNavigate(async () => ({ error: new Error("session activation failed") }), "/dashboard", url => paths.push(url));
  assert.equal(result.error.message, "session activation failed");
  assert.deepEqual(paths, []);
});

test("duplicate Clerk callback invocations start only one navigation", async () => {
  const paths = [];
  await finalizeThenNavigate(async ({ navigate }) => {
    navigate({ decorateUrl: url => url });
    navigate({ decorateUrl: url => url });
    return { error: null };
  }, "/dashboard", url => paths.push(url));
  assert.deepEqual(paths, ["/dashboard"]);
});

test("navigation preserves same-origin targets and Clerk's external HTTPS ITP target", () => {
  assert.equal(resolveAuthNavigationUrl("/dashboard?tab=profile#top", "https://cinegenius.co", "/"), "/dashboard?tab=profile#top");
  assert.equal(resolveAuthNavigationUrl("https://clerk.cinegenius.co/v1/client/touch?x=1", "https://cinegenius.co", "/"), "https://clerk.cinegenius.co/v1/client/touch?x=1");
  assert.equal(resolveAuthNavigationUrl("javascript:alert(1)", "https://cinegenius.co", "/dashboard"), "/dashboard");
});

test("sign-in reports progress, locks duplicate submissions, and delegates navigation to Clerk finalization", () => {
  const source = readFileSync(new URL("../components/AuthForm.tsx", import.meta.url), "utf8");
  const signInForm = source.slice(source.indexOf("function SignInForm"), source.indexOf("function SignUpForm"));
  assert.match(signInForm, /submissionInFlight = useRef\(false\)/);
  assert.match(signInForm, /fetchStatus === "fetching" \|\| submitting/);
  assert.match(signInForm, /busy \? t\("signingIn"\) : t\("signIn"\)/);
  assert.match(signInForm, /finalizeThenNavigate\(/);
  assert.match(signInForm, /shouldRedirectForActiveSession\(isLoaded, !!isSignedIn, signInAttemptStarted\.current && !error\)/);
  assert.match(source, /window\.location\.replace\(/);
  assert.doesNotMatch(signInForm, /router\.replace\(destination\)/);
});

test("existing users go to their account area by default after sign-in", () => {
  const page = readFileSync(new URL("../app/sign-in/[[...sign-in]]/page.tsx", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(page, /safeAuthRedirect\(query\.redirect_url \?\? query\.redirect, "\/dashboard"/);
  assert.match(layout, /signInFallbackRedirectUrl="\/dashboard"/);
  assert.doesNotMatch(layout, /signInForceRedirectUrl=/);
  assert.match(page, /if \(userId\) redirect\(destination\)/);
});

test("signup uses the same Clerk-authorized navigation into setup", () => {
  const source = readFileSync(new URL("../components/AuthForm.tsx", import.meta.url), "utf8");
  const signUpForm = source.slice(source.indexOf("function SignUpForm"));
  assert.match(signUpForm, /finalizeThenNavigate\(/);
  assert.match(signUpForm, /!signUpAttemptStarted\.current/);
  assert.doesNotMatch(signUpForm, /finalize\(\{ navigate: \(\{ decorateUrl \}\) => finishNavigation/);
});
