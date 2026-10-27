import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classifyPasswordResetError,
  getPasswordResetRequestErrorMessage,
  PASSWORD_RESET_NEUTRAL_MESSAGE,
  PASSWORD_RESET_RESEND_COOLDOWN_SECONDS,
  validateNewPassword,
} from "./password-reset-flow.ts";

test("account-specific reset errors receive a non-enumerating response", () => {
  const errors = [
    { errors: [{ code: "form_identifier_not_found" }] },
    { errors: [{ code: "form_password_not_set" }] },
    { code: "form_password_reset_not_available" },
  ];

  for (const error of errors) {
    assert.equal(classifyPasswordResetError(error), "account-unavailable");
  }
  assert.match(PASSWORD_RESET_NEUTRAL_MESSAGE, /Wenn diese Adresse/);
  assert.doesNotMatch(PASSWORD_RESET_NEUTRAL_MESSAGE, /kein Konto gefunden|Adresse ist nicht registriert/i);
});

test("rate limits and temporary failures are explained without exposing account status", () => {
  assert.equal(classifyPasswordResetError({ errors: [{ code: "too_many_requests" }] }), "rate-limited");
  assert.equal(classifyPasswordResetError(new Error("network failure")), "temporary");
  assert.match(getPasswordResetRequestErrorMessage("rate-limited"), /warte kurz/i);
  assert.doesNotMatch(getPasswordResetRequestErrorMessage("temporary"), /konto|registriert/i);
  assert.equal(PASSWORD_RESET_RESEND_COOLDOWN_SECONDS, 30);
});

test("new password validation catches short passwords and mismatched confirmation", () => {
  assert.match(validateNewPassword("short", "short").passwordError, /mindestens 8 Zeichen/);
  assert.match(validateNewPassword("long-enough", "different").confirmationError, /stimmen nicht überein/);
  assert.deepEqual(validateNewPassword("long-enough", "long-enough"), {
    passwordError: "",
    confirmationError: "",
  });
});

test("reset UI guards duplicate actions and supports resend, password confirmation, and visibility toggles", () => {
  const source = readFileSync(new URL("../components/AuthForm.tsx", import.meta.url), "utf8");
  const signInForm = source.slice(source.indexOf("function SignInForm"), source.indexOf("function SignUpForm"));
  assert.match(signInForm, /const startPasswordReset = async[\s\S]*?beginSubmission\(\)/);
  assert.match(signInForm, /const submitResetCode = async[\s\S]*?beginSubmission\(\)/);
  assert.match(signInForm, /const submitNewPassword = async[\s\S]*?beginSubmission\(\)/);
  assert.match(signInForm, /const resendPasswordResetCode = async/);
  assert.match(signInForm, /const startEmailCodeSignIn = async/);
  assert.match(signInForm, /resetPasswordEmailCode\.verifyCode/);
  assert.match(signInForm, /resetPasswordEmailCode\.submitPassword/);
  assert.match(signInForm, /t\("confirmPassword"\)/);
  assert.match(signInForm, /getPasswordSignInAction\(signIn\.status\)[\s\S]*?nextAction === "mfa"/);
  assert.match(signInForm, /aria-label=\{showNewPassword \? t\("hidePassword"\) : t\("showPassword"\)\}/);
  assert.match(signInForm, /aria-label=\{showConfirmNewPassword \? t\("hidePassword"\) : t\("showPassword"\)\}/);
  assert.match(signInForm, /finally \{\s*finishSubmission\(\);\s*\}/);
  assert.match(signInForm, /PASSWORD_RESET_NEUTRAL_MESSAGE/);
  assert.match(signInForm, /t\("alternativeSignIn"\)/);
  assert.doesNotMatch(signInForm, /console\.(log|error)\([^)]*(password|code|token)/i);
});
