import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getMfaResendChannel, getPasswordSignInAction, selectSecondFactor, shouldFallbackAfterFinalize, shouldRedirectForActiveSession } from "./sign-in-flow.ts";

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

test("successful Clerk finalization falls back to the destination only if its navigation callback did not run", () => {
  assert.equal(shouldFallbackAfterFinalize(false, false), true);
  assert.equal(shouldFallbackAfterFinalize(false, true), false);
  assert.equal(shouldFallbackAfterFinalize(true, false), false);
});

test("sign-in reports progress, locks duplicate submissions, and uses a single full-page navigation after finalization", () => {
  const source = readFileSync(new URL("../components/AuthForm.tsx", import.meta.url), "utf8");
  const signInForm = source.slice(source.indexOf("function SignInForm"), source.indexOf("function SignUpForm"));
  assert.match(signInForm, /submissionInFlight = useRef\(false\)/);
  assert.match(signInForm, /fetchStatus === "fetching" \|\| submitting/);
  assert.match(signInForm, /busy \? "Anmeldung läuft …" : "Anmelden"/);
  assert.match(signInForm, /signIn\.finalize\(\{ navigate:/);
  assert.match(signInForm, /shouldFallbackAfterFinalize\(false, navigationCallbackCalled\)/);
  assert.match(signInForm, /shouldRedirectForActiveSession\(isLoaded, !!isSignedIn, signInAttemptStarted\.current && !error\)/);
  assert.match(source, /window\.location\.replace\(/);
  assert.doesNotMatch(signInForm, /router\.replace\(destination\)/);
});

test("sign-in uses the homepage by default and does not force a dashboard redirect", () => {
  const page = readFileSync(new URL("../app/sign-in/[[...sign-in]]/page.tsx", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(page, /safeAuthRedirect\(query\.redirect_url \?\? query\.redirect, "\/"/);
  assert.match(layout, /signInFallbackRedirectUrl="\/"/);
  assert.doesNotMatch(layout, /signInForceRedirectUrl=/);
  assert.match(page, /if \(userId\) redirect\(destination\)/);
});
