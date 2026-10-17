import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getMfaResendChannel, getPasswordSignInAction, selectSecondFactor } from "./sign-in-flow.ts";

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
  ["needs_first_factor", "email-code"],
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
