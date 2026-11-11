export type AuthErrorContext = "sign-in" | "sign-up" | "new-password";

type AuthError = {
  code?: unknown;
  errors?: Array<{ code?: unknown }>;
  name?: unknown;
  message?: unknown;
};

/** Match stable codes only. Provider messages may contain personal information. */
export function authErrorMessageKey(error: unknown, context: AuthErrorContext = "sign-in"): string | null {
  if (!error || typeof error !== "object") return null;
  let value: AuthError;
  let codes: string[];
  try {
    value = error as AuthError;
    codes = [value.code, ...(Array.isArray(value.errors) ? value.errors.map(entry => entry?.code) : [])]
      .filter((code): code is string => typeof code === "string");
  } catch {
    return null;
  }
  const has = (...expected: string[]) => codes.some(code => expected.includes(code));
  if (has("form_identifier_exists")) return "auth.accountExists";
  if (has("form_password_pwned")) return context === "sign-in" ? "auth.passwordPwnedSignIn" : "auth.passwordCompromisedSignup";
  if (has("form_password_compromised", "form_password_untrusted")) return context === "sign-in" ? "auth.passwordCompromisedSignIn" : "auth.passwordRequirements";
  if (has("password_reset_required", "password_too_long_needs_reset")) return "auth.passwordChangeRequired";
  if (has("form_password_not_set")) return "auth.passwordUnavailable";
  if (has("form_password_incorrect", "form_identifier_not_found", "form_password_or_identifier_incorrect")) return "auth.credentialsError";
  if (has("form_password_length_too_short")) return "auth.passwordLength";
  if (has("form_password_validation_failed")) return context === "sign-in" ? "auth.credentialsError" : "auth.passwordRequirements";
  if (has("form_password_not_strong_enough", "form_password_matches_identifier", "form_password_size_in_bytes_exceeded")) return "auth.passwordRequirements";
  if (has("verification_expired", "form_code_expired")) return "auth.codeExpired";
  if (has("form_code_incorrect", "form_code_invalid", "verification_failed", "verification_invalid")) return "auth.codeIncorrect";
  if (has("too_many_requests", "too_many_attempts", "too_many_verification_attempts", "too_many_sign_in_attempts", "rate_limit_exceeded", "rate_limited")) return "auth.tooManyAttempts";
  if (has("network_error", "network_timeout", "request_timeout", "connection_error")) return "auth.connectionError";
  try {
    if (value.name === "TypeError" && typeof value.message === "string" && /^(?:failed to fetch|fetch failed|load failed|network request failed)$/i.test(value.message)) return "auth.connectionError";
  } catch {
    return null;
  }
  return null;
}

export function readableAuthError(
  translate: (key: string) => string,
  error: unknown,
  fallback: string,
  context: AuthErrorContext = "sign-in",
): string {
  const key = authErrorMessageKey(error, context);
  return key ? translate(key) : fallback;
}
