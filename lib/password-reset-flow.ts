export const PASSWORD_RESET_MIN_LENGTH = 8;
export const PASSWORD_RESET_RESEND_COOLDOWN_SECONDS = 30;

export const PASSWORD_RESET_NEUTRAL_MESSAGE =
  "Wenn diese Adresse zu einem CineGenius-Konto mit Passwort gehört, erhältst du einen Wiederherstellungscode. Falls kein Code eintrifft oder dein Konto kein Passwort nutzt, melde dich mit „Mit E-Mail-Code anmelden“ oder der ursprünglich verwendeten Anmeldemethode an.";

export type PasswordResetErrorKind = "account-unavailable" | "rate-limited" | "temporary";

function getErrorCodes(error: unknown): string[] {
  if (!error || typeof error !== "object") return [];

  const value = error as {
    code?: unknown;
    errors?: Array<{ code?: unknown }>;
  };

  return [value.code, ...(value.errors ?? []).map((entry) => entry.code)]
    .filter((code): code is string => typeof code === "string")
    .map((code) => code.toLowerCase());
}

export function classifyPasswordResetError(error: unknown): PasswordResetErrorKind {
  const codes = getErrorCodes(error);

  if (codes.some((code) => /too_many_requests|rate_limit|rate_limited|too_many_attempts/.test(code))) {
    return "rate-limited";
  }

  if (codes.some((code) => [
    "form_identifier_not_found",
    "form_password_not_set",
    "form_password_reset_not_available",
    "form_password_reset_disabled",
    "form_password_reset_not_supported",
    "form_missing_primary_email_address",
    "resource_not_found",
  ].includes(code))) {
    return "account-unavailable";
  }

  return "temporary";
}

export function getPasswordResetRequestErrorMessage(kind: PasswordResetErrorKind): string {
  if (kind === "rate-limited") {
    return "Es gab zu viele Wiederherstellungsversuche. Bitte warte kurz und versuche es danach erneut.";
  }

  return "Die Anfrage konnte gerade nicht abgeschlossen werden. Prüfe deine Verbindung und versuche es später erneut.";
}

export function validateNewPassword(password: string, confirmation: string): {
  passwordError: string;
  confirmationError: string;
} {
  if (password.length < PASSWORD_RESET_MIN_LENGTH) {
    return {
      passwordError: `Das Passwort muss mindestens ${PASSWORD_RESET_MIN_LENGTH} Zeichen enthalten.`,
      confirmationError: "",
    };
  }

  if (password !== confirmation) {
    return {
      passwordError: "",
      confirmationError: "Die Passwörter stimmen nicht überein.",
    };
  }

  return { passwordError: "", confirmationError: "" };
}
