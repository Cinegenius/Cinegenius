export type PasswordSignInAction = "complete" | "mfa" | "email-code" | "unsupported";

export function getPasswordSignInAction(status: string | null | undefined): PasswordSignInAction {
  if (status === "complete") return "complete";
  if (status === "needs_second_factor" || status === "needs_client_trust") return "mfa";
  if (status === "needs_first_factor") return "email-code";
  return "unsupported";
}

export type SecondFactorStrategy = "email_code" | "phone_code" | "totp" | "backup_code";
export type MfaResendChannel = "email" | "phone";

const SECOND_FACTOR_PREFERENCE: readonly SecondFactorStrategy[] = ["email_code", "phone_code", "totp", "backup_code"];

export function selectSecondFactor(supported: readonly string[]): SecondFactorStrategy | null {
  return SECOND_FACTOR_PREFERENCE.find((strategy) => supported.includes(strategy)) ?? null;
}

export function getMfaResendChannel(factor: string | null | undefined): MfaResendChannel | null {
  if (factor === "email_code") return "email";
  if (factor === "phone_code") return "phone";
  return null;
}
