"use client";

import { useAuth, useSignIn, useSignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { localizeAuthMessage } from "@/lib/i18n/auth-messages";
import { Eye, EyeOff } from "lucide-react";
import { finalizeThenNavigate, getMfaResendChannel, getPasswordSignInAction, resolveAuthNavigationUrl, selectSecondFactor, shouldRedirectForActiveSession } from "@/lib/sign-in-flow";
import { classifyPasswordResetError, getPasswordResetRequestErrorMessage, PASSWORD_RESET_NEUTRAL_MESSAGE, PASSWORD_RESET_RESEND_COOLDOWN_SECONDS, validateNewPassword } from "@/lib/password-reset-flow";

type AuthMode = "sign-in" | "sign-up";
type SignInStep = "credentials" | "email-code" | "mfa" | "reset-code" | "new-password";

type AuthFormProps = {
  mode: AuthMode;
  destination: string;
  signUpDestination?: string;
  signInDestination?: string;
};

type ClerkErrorLike = {
  code?: string;
  message?: string;
  longMessage?: string;
  errors?: Array<{ code?: string; message?: string; longMessage?: string }>;
};

const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-border bg-bg-secondary px-4 text-base text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-gold/20";
const buttonClass = "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gold px-5 text-base font-bold text-bg-primary transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass = "inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-text-secondary transition-colors hover:border-gold hover:text-gold disabled:opacity-60";

function readableAuthError(error: unknown, fallback: string): string {
  const value = error as ClerkErrorLike | null;
  const details = value?.errors?.[0] ?? value;
  const code = details?.code ?? value?.code;
  if (code === "form_identifier_exists") return "Für diese E-Mail-Adresse besteht bereits ein Konto. Melde dich bitte an.";
  if (code === "form_password_incorrect" || code === "form_identifier_not_found") return "E-Mail-Adresse oder Passwort stimmt nicht.";
  return details?.longMessage ?? details?.message ?? fallback;
}

async function runAuthAction<T>(action: () => Promise<T>, setError: (message: string) => void, fallback: string): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    setError(readableAuthError(error, fallback));
    return undefined;
  }
}

function finishNavigation(url: string, fallback: string) {
  window.location.replace(resolveAuthNavigationUrl(url, window.location.origin, fallback));
}

export default function AuthForm({ mode, destination, signUpDestination, signInDestination }: AuthFormProps) {
  return mode === "sign-in"
    ? <SignInForm destination={destination} signUpDestination={signUpDestination ?? "/sign-up"} />
    : <SignUpForm destination={destination} signInDestination={signInDestination ?? "/sign-in"} />;
}

function SignInForm({ destination, signUpDestination }: { destination: string; signUpDestination: string }) {
  const t = useTranslations("auth");
  const { signIn, errors, fetchStatus } = useSignIn();
  const { isLoaded, isSignedIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [resetEmailError, setResetEmailError] = useState("");
  const [resetCodeError, setResetCodeError] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [resetCooldownSeconds, setResetCooldownSeconds] = useState(0);
  const [resetRequestInProgress, setResetRequestInProgress] = useState(false);
  const [step, setStep] = useState<SignInStep>("credentials");
  const [factor, setFactor] = useState<"email_code" | "phone_code" | "totp" | "backup_code" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const signInAttemptStarted = useRef(false);
  const navigationStarted = useRef(false);
  const busy = fetchStatus === "fetching" || submitting;

  useEffect(() => {
    if (resetCooldownSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setResetCooldownSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resetCooldownSeconds]);

  const navigateOnce = useCallback((url: string) => {
    if (navigationStarted.current) return;
    navigationStarted.current = true;
    finishNavigation(url, destination);
  }, [destination]);

  const beginSubmission = () => {
    if (!signIn || busy || submissionInFlight.current) return false;
    submissionInFlight.current = true;
    setSubmitting(true);
    return true;
  };

  const finishSubmission = () => {
    submissionInFlight.current = false;
    setSubmitting(false);
  };

  useEffect(() => {
    // If Clerk has activated a session but a later finalize step reports an
    // error, let the active session win and recover to the destination.
    if (shouldRedirectForActiveSession(isLoaded, !!isSignedIn, signInAttemptStarted.current && !error)) {
      navigateOnce(destination);
    }
  }, [destination, error, isLoaded, isSignedIn, navigateOnce]);

  const completeSignIn = async () => {
    const result = await runAuthAction(
      () => finalizeThenNavigate(
        (params) => signIn.finalize(params),
        destination,
        navigateOnce,
      ),
      setError,
      "Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
    );
    if (!result) {
      signInAttemptStarted.current = false;
      return;
    }
    if (result.error) {
      setError(readableAuthError(result.error, "Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut."));
      signInAttemptStarted.current = false;
      return;
    }
  };

  const prepareSecondFactor = async () => {
    const supported = signIn.supportedSecondFactors.map((entry) => entry.strategy);
    const selected = selectSecondFactor(supported);
    if (!selected) {
      setError("Für dieses Konto ist eine zusätzliche Bestätigung nötig, die hier nicht verfügbar ist. Bitte nutze die Kontowiederherstellung.");
      return;
    }
    setFactor(selected);
    setStep("mfa");
    setCode("");
    if (selected === "email_code") {
      const result = await runAuthAction(() => signIn.mfa.sendEmailCode(), setError, "Der Bestätigungscode konnte nicht gesendet werden.");
      if (!result) return;
      if (result.error) setError(readableAuthError(result.error, "Der Bestätigungscode konnte nicht gesendet werden."));
      else setMessage("Wir haben einen Bestätigungscode an deine E-Mail-Adresse gesendet.");
    } else if (selected === "phone_code") {
      const result = await runAuthAction(() => signIn.mfa.sendPhoneCode(), setError, "Der Bestätigungscode konnte nicht gesendet werden.");
      if (!result) return;
      if (result.error) setError(readableAuthError(result.error, "Der Bestätigungscode konnte nicht gesendet werden."));
      else setMessage("Wir haben einen Bestätigungscode an dein Telefon gesendet.");
    } else {
      setMessage(selected === "totp" ? "Gib den Code aus deiner Authenticator-App ein." : "Gib einen deiner Wiederherstellungscodes ein.");
    }
  };

  const resendSecondFactorCode = async () => {
    if (!signIn || busy) return;
    const channel = getMfaResendChannel(factor);
    if (!channel) return;
    setError("");
    setMessage("");
    const fallback = "Der Bestätigungscode konnte nicht erneut gesendet werden.";
    const result = await runAuthAction(
      () => channel === "email" ? signIn.mfa.sendEmailCode() : signIn.mfa.sendPhoneCode(),
      setError,
      fallback,
    );
    if (!result || result.error) {
      if (result?.error) setError(readableAuthError(result.error, fallback));
      return;
    }
    setMessage(channel === "email"
      ? "Wir haben einen neuen Bestätigungscode an deine E-Mail-Adresse gesendet."
      : "Wir haben einen neuen Bestätigungscode an dein Telefon gesendet.");
  };

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!beginSubmission()) return;
    signInAttemptStarted.current = true;
    setError("");
    setMessage("");
    try {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
        signInAttemptStarted.current = false;
        setError("Gib eine gültige E-Mail-Adresse ein.");
        return;
      }
      const result = await runAuthAction(() => signIn.password({ emailAddress: email.trim(), password }), setError, "Anmeldung fehlgeschlagen. Bitte prüfe deine Angaben.");
      if (!result || result.error) {
        signInAttemptStarted.current = false;
        if (result?.error) setError(readableAuthError(result.error, "Anmeldung fehlgeschlagen. Bitte prüfe deine Angaben."));
        return;
      }
      const nextAction = getPasswordSignInAction(signIn.status);
      if (nextAction === "complete") await completeSignIn();
      else if (nextAction === "mfa") await prepareSecondFactor();
      else {
        signInAttemptStarted.current = false;
        setError("Die Passwortanmeldung wurde nicht abgeschlossen. Prüfe deine Angaben oder wähle ausdrücklich „Mit E-Mail-Code anmelden“.");
      }
    } finally {
      finishSubmission();
    }
  };

  const sendEmailCode = async () => {
    if (!email.trim() || !beginSubmission()) return;
    signInAttemptStarted.current = true;
    setError("");
    setMessage("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      signInAttemptStarted.current = false;
      setError("Gib eine gültige E-Mail-Adresse ein.");
      finishSubmission();
      return;
    }
    try {
      const result = await runAuthAction(() => signIn.emailCode.sendCode({ emailAddress: email.trim() }), setError, "Der Anmeldecode konnte nicht gesendet werden.");
      if (!result || result.error) {
        signInAttemptStarted.current = false;
        if (result?.error) setError(readableAuthError(result.error, "Der Anmeldecode konnte nicht gesendet werden."));
      }
      else {
        setStep("email-code");
        setCode("");
        setMessage("Wir haben einen Anmeldecode an deine E-Mail-Adresse gesendet.");
      }
    } finally {
      finishSubmission();
    }
  };

  const submitCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!beginSubmission()) return;
    setError("");
    setMessage("");
    try {
      const result = await runAuthAction(async () => step === "mfa"
        ? factor === "email_code" ? await signIn.mfa.verifyEmailCode({ code: code.trim() })
          : factor === "phone_code" ? await signIn.mfa.verifyPhoneCode({ code: code.trim() })
            : factor === "totp" ? await signIn.mfa.verifyTOTP({ code: code.trim() })
              : await signIn.mfa.verifyBackupCode({ code: code.trim() })
        : await signIn.emailCode.verifyCode({ code: code.trim() }), setError, "Der Code konnte nicht geprüft werden. Bitte versuche es erneut.");
      if (!result || result.error) {
        if (result?.error) setError(readableAuthError(result.error, "Der Code stimmt nicht oder ist abgelaufen. Bitte prüfe ihn und versuche es erneut."));
        return;
      }
      if (signIn.status === "complete") await completeSignIn();
      else if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") await prepareSecondFactor();
      else setError("Die Bestätigung ist noch nicht abgeschlossen. Bitte fordere einen neuen Code an oder starte erneut.");
    } finally {
      finishSubmission();
    }
  };

  const startPasswordReset = async () => {
    if (!signIn || busy) return;
    if (resetCooldownSeconds > 0) {
      setResetEmailError(`Bitte warte noch ${resetCooldownSeconds} Sekunden, bevor du es erneut versuchst.`);
      return;
    }
    if (!email.trim()) {
      setResetEmailError("Gib zuerst deine E-Mail-Adresse ein.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setResetEmailError("Gib eine gültige E-Mail-Adresse ein.");
      return;
    }
    if (!beginSubmission()) return;
    setResetRequestInProgress(true);
    signInAttemptStarted.current = false;
    setError("");
    setMessage("");
    setResetEmailError("");
    setResetCodeError("");
    try {
      const resetResult = await signIn.reset();
      if (resetResult.error) {
        setError("Die Wiederherstellung konnte nicht vorbereitet werden. Bitte versuche es erneut.");
        return;
      }

      const startResult = await signIn.create({ identifier: email.trim() });
      if (startResult.error) {
        const kind = classifyPasswordResetError(startResult.error);
        if (kind === "account-unavailable") {
          setStep("reset-code");
          setCode("");
          setResetCooldownSeconds(PASSWORD_RESET_RESEND_COOLDOWN_SECONDS);
          setMessage(PASSWORD_RESET_NEUTRAL_MESSAGE);
        } else {
          setError(getPasswordResetRequestErrorMessage(kind));
          if (kind === "rate-limited") setResetCooldownSeconds(PASSWORD_RESET_RESEND_COOLDOWN_SECONDS);
        }
        return;
      }

      const codeResult = await signIn.resetPasswordEmailCode.sendCode();
      if (codeResult.error) {
        const kind = classifyPasswordResetError(codeResult.error);
        if (kind === "account-unavailable") {
          setStep("reset-code");
          setCode("");
          setResetCooldownSeconds(PASSWORD_RESET_RESEND_COOLDOWN_SECONDS);
          setMessage(PASSWORD_RESET_NEUTRAL_MESSAGE);
        } else {
          setError(getPasswordResetRequestErrorMessage(kind));
          if (kind === "rate-limited") setResetCooldownSeconds(PASSWORD_RESET_RESEND_COOLDOWN_SECONDS);
        }
        return;
      }

      setStep("reset-code");
      setCode("");
      setResetCooldownSeconds(PASSWORD_RESET_RESEND_COOLDOWN_SECONDS);
      setMessage(PASSWORD_RESET_NEUTRAL_MESSAGE);
    } catch {
      setError(getPasswordResetRequestErrorMessage("temporary"));
    } finally {
      setResetRequestInProgress(false);
      finishSubmission();
    }
  };

  const submitResetCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signIn || !beginSubmission()) return;
    setError("");
    setMessage("");
    setResetCodeError("");
    if (!code.trim()) {
      setResetCodeError("Gib den Code aus der E-Mail ein.");
      finishSubmission();
      return;
    }
    try {
      const result = await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() });
      if (result.error) setResetCodeError("Der Code ist ungültig oder abgelaufen. Prüfe ihn oder fordere einen neuen an.");
      else if (signIn.status === "needs_new_password") setStep("new-password");
      else setResetCodeError("Der Code konnte nicht bestätigt werden. Fordere einen neuen Code an und versuche es erneut.");
    } catch {
      setResetCodeError("Der Code konnte gerade nicht geprüft werden. Bitte versuche es erneut.");
    } finally {
      finishSubmission();
    }
  };

  const resendPasswordResetCode = async () => {
    if (!signIn || busy) return;
    if (resetCooldownSeconds > 0) {
      setError(`Bitte warte noch ${resetCooldownSeconds} Sekunden, bevor du einen neuen Code anforderst.`);
      return;
    }
    if (!beginSubmission()) return;
    setError("");
    setMessage("");
    setResetCodeError("");
    try {
      const resetResult = await signIn.reset();
      if (resetResult.error) {
        setError("Die Wiederherstellung konnte nicht vorbereitet werden. Bitte versuche es erneut.");
        return;
      }
      const startResult = await signIn.create({ identifier: email.trim() });
      if (startResult.error) {
        const kind = classifyPasswordResetError(startResult.error);
        if (kind === "account-unavailable") setMessage(PASSWORD_RESET_NEUTRAL_MESSAGE);
        else setError(getPasswordResetRequestErrorMessage(kind));
        if (kind === "rate-limited") setResetCooldownSeconds(PASSWORD_RESET_RESEND_COOLDOWN_SECONDS);
        return;
      }
      const result = await signIn.resetPasswordEmailCode.sendCode();
      if (result.error) {
        const kind = classifyPasswordResetError(result.error);
        if (kind === "account-unavailable") setMessage(PASSWORD_RESET_NEUTRAL_MESSAGE);
        else setError(getPasswordResetRequestErrorMessage(kind));
        if (kind === "rate-limited") setResetCooldownSeconds(PASSWORD_RESET_RESEND_COOLDOWN_SECONDS);
        return;
      }
      setCode("");
      setResetCooldownSeconds(PASSWORD_RESET_RESEND_COOLDOWN_SECONDS);
      setMessage(PASSWORD_RESET_NEUTRAL_MESSAGE);
    } catch {
      setError(getPasswordResetRequestErrorMessage("temporary"));
    } finally {
      finishSubmission();
    }
  };

  const startEmailCodeSignIn = async () => {
    if (!signIn || !beginSubmission()) return;
    setError("");
    setMessage("");
    try {
      const resetResult = await signIn.reset();
      if (resetResult.error) {
        setError("Der alternative Anmeldeweg konnte nicht vorbereitet werden. Bitte versuche es erneut.");
        return;
      }
      const result = await signIn.emailCode.sendCode({ emailAddress: email.trim() });
      if (result.error) {
        setError(readableAuthError(result.error, "Der Anmeldecode konnte nicht gesendet werden."));
        return;
      }
      setStep("email-code");
      setCode("");
      setMessage("Wir haben einen Anmeldecode angefordert. Prüfe dein Postfach und den Spam-Ordner.");
    } catch {
      setError("Der alternative Anmeldecode konnte gerade nicht angefordert werden. Bitte versuche es erneut.");
    } finally {
      finishSubmission();
    }
  };

  const submitNewPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signIn || !beginSubmission()) return;
    setError("");
    setMessage("");
    setNewPasswordError("");
    setConfirmPasswordError("");
    const validation = validateNewPassword(newPassword, confirmNewPassword);
    if (validation.passwordError || validation.confirmationError) {
      setNewPasswordError(validation.passwordError);
      setConfirmPasswordError(validation.confirmationError);
      finishSubmission();
      return;
    }
    signInAttemptStarted.current = true;
    try {
      const result = await signIn.resetPasswordEmailCode.submitPassword({ password: newPassword });
      if (result.error) {
        signInAttemptStarted.current = false;
        setNewPasswordError(readableAuthError(result.error, "Das neue Passwort konnte nicht gespeichert werden."));
        return;
      }
      const nextAction = getPasswordSignInAction(signIn.status);
      if (nextAction === "complete") {
        setMessage("Das Passwort wurde geändert. Du wirst jetzt angemeldet …");
        await completeSignIn();
      } else if (nextAction === "mfa") {
        setMessage("Das Passwort wurde aktualisiert. Schließe noch die Sicherheitsprüfung ab.");
        await prepareSecondFactor();
      } else {
        signInAttemptStarted.current = false;
        setError("Die Passwortänderung wurde vom Anmeldedienst noch nicht bestätigt. Bitte versuche es erneut.");
      }
    } catch {
      signInAttemptStarted.current = false;
      setError("Das neue Passwort konnte gerade nicht gespeichert werden. Bitte versuche es erneut.");
    } finally {
      finishSubmission();
    }
  };

  const resetFlow = async () => {
    if (!signIn || !beginSubmission()) return;
    try {
      const result = await signIn.reset();
      if (result.error) {
        setError("Der Anmeldevorgang konnte nicht zurückgesetzt werden. Bitte versuche es erneut.");
        return;
      }
      setStep("credentials");
      setCode("");
      setNewPassword("");
      setConfirmNewPassword("");
      setResetCodeError("");
      setNewPasswordError("");
      setConfirmPasswordError("");
      setResetCooldownSeconds(0);
      setMessage("");
      setError("");
    } finally {
      finishSubmission();
    }
  };

  return (
    <div className="w-full">
      {step === "credentials" && (
        <form onSubmit={submitPassword} className="space-y-5" noValidate>
          <label className="block text-sm font-medium text-text-primary">
            {t("email")}<input id="sign-in-email" autoComplete="email" autoCapitalize="none" autoCorrect="off" type="email" inputMode="email" required value={email} onChange={(event) => { setEmail(event.target.value); setResetEmailError(""); }} className={inputClass} placeholder="name@beispiel.de" aria-invalid={!!resetEmailError} aria-describedby={resetEmailError ? "reset-email-error" : undefined} />
            {errors.fields.identifier && <span className="mt-1 block text-sm text-red-400">{errors.fields.identifier.message}</span>}
            {resetEmailError && <span id="reset-email-error" className="mt-1 block text-sm text-red-400">{localizeAuthMessage(resetEmailError, t)}</span>}
          </label>
          <label className="block text-sm font-medium text-text-primary">
            {t("password")}<input autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} placeholder={t("yourPassword")} />
            {errors.fields.password && <span className="mt-1 block text-sm text-red-400">{errors.fields.password.message}</span>}
          </label>
          <button type="submit" disabled={!signIn || busy} className={buttonClass}>
            {busy ? t("signingIn") : t("signIn")}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <button type="button" disabled={!signIn || busy || !email.trim() || resetCooldownSeconds > 0} onClick={() => void startPasswordReset()} className="min-h-11 text-text-muted underline-offset-4 hover:text-gold hover:underline disabled:opacity-50">
              {resetRequestInProgress ? t("recovering") : resetCooldownSeconds > 0 ? t("retrySeconds", {seconds: resetCooldownSeconds}) : t("forgotPassword")}
            </button>
            <button type="button" disabled={!signIn || busy || !email.trim()} onClick={() => void sendEmailCode()} className="min-h-11 text-gold underline-offset-4 hover:underline disabled:opacity-50">
              {t("emailSignIn")}</button>
          </div>
        </form>
      )}

      {(step === "email-code" || step === "mfa") && (
        <form onSubmit={submitCode} className="space-y-5">
          <label className="block text-sm font-medium text-text-primary">
            {step === "mfa" && factor === "totp" ? t("authenticatorCode") : step === "mfa" && factor === "backup_code" ? t("recoveryCode") : t("emailCode")}
            <input autoComplete="one-time-code" inputMode="numeric" required value={code} onChange={(event) => setCode(event.target.value)} className={inputClass} placeholder={t("verificationCode")} />
            {errors.fields.code && <span className="mt-1 block text-sm text-red-400">{errors.fields.code.message}</span>}
          </label>
          <button type="submit" disabled={!signIn || busy} className={buttonClass}>{busy ? t("checkingCode") : t("verifyCode")}</button>
          {step === "email-code" && <button type="button" disabled={!signIn || busy} onClick={() => void sendEmailCode()} className={`${secondaryButtonClass} w-full`}>{t("sendNewCode")}</button>}
          {step === "mfa" && getMfaResendChannel(factor) && <button type="button" disabled={!signIn || busy} onClick={() => void resendSecondFactorCode()} className={`${secondaryButtonClass} w-full`}>{t("sendNewCode")}</button>}
          <button type="button" disabled={busy} onClick={() => void resetFlow()} className="min-h-11 w-full text-sm text-text-muted hover:text-text-primary">{t("backSignIn")}</button>
        </form>
      )}

      {step === "reset-code" && (
        <form onSubmit={submitResetCode} className="space-y-5" noValidate>
          <p className="text-sm leading-relaxed text-text-muted">{t("recoveryInstructions")}</p>
          <label className="block text-sm font-medium text-text-primary">{t("recoveryCode")}<input autoComplete="one-time-code" inputMode="numeric" required value={code} onChange={(event) => { setCode(event.target.value); setResetCodeError(""); }} className={inputClass} placeholder={t("codeFromEmail")} aria-invalid={!!resetCodeError} />
            {errors.fields.code && <span className="mt-1 block text-sm text-red-400">{errors.fields.code.message}</span>}
            {resetCodeError && <span className="mt-1 block text-sm text-red-400">{localizeAuthMessage(resetCodeError, t)}</span>}
          </label>
          <button type="submit" disabled={!signIn || busy} className={buttonClass}>{busy ? t("checkingCode") : t("verifyCode")}</button>
          <button type="button" disabled={!signIn || busy || resetCooldownSeconds > 0} onClick={() => void resendPasswordResetCode()} className={`${secondaryButtonClass} w-full`}>
            {busy ? t("sendingCode") : resetCooldownSeconds > 0 ? t("requestSeconds", {seconds: resetCooldownSeconds}) : t("requestCode")}
          </button>
          <button type="button" disabled={!signIn || busy} onClick={() => void startEmailCodeSignIn()} className="min-h-11 w-full text-sm font-semibold text-gold hover:underline">
            {t("alternativeSignIn")}</button>
          <button type="button" disabled={busy} onClick={() => void resetFlow()} className="min-h-11 w-full text-sm text-text-muted hover:text-text-primary">{t("backSignIn")}</button>
        </form>
      )}

      {step === "new-password" && (
        <form onSubmit={submitNewPassword} className="space-y-5" noValidate>
          <div>
            <label htmlFor="reset-new-password" className="block text-sm font-medium text-text-primary">{t("newPassword")}</label>
            <div className="relative">
              <input id="reset-new-password" autoComplete="new-password" type={showNewPassword ? "text" : "password"} minLength={8} required value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setNewPasswordError(""); setError(""); }} className={`${inputClass} pr-12`} placeholder={t("minimumPassword")} aria-invalid={!!newPasswordError} aria-describedby="reset-password-requirement reset-password-error" />
              <button type="button" onClick={() => setShowNewPassword((visible) => !visible)} aria-label={showNewPassword ? t("hidePassword") : t("showPassword")} aria-pressed={showNewPassword} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                {showNewPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
              </button>
            </div>
            <span id="reset-password-requirement" className="mt-1 block text-xs text-text-muted">{t("passwordRules")}</span>
            {errors.fields.password && <span className="mt-1 block text-sm text-red-400">{errors.fields.password.message}</span>}
            {newPasswordError && <span id="reset-password-error" className="mt-1 block text-sm text-red-400">{localizeAuthMessage(newPasswordError, t)}</span>}
          </div>
          <div>
            <label htmlFor="reset-confirm-password" className="block text-sm font-medium text-text-primary">{t("confirmPassword")}</label>
            <div className="relative">
              <input id="reset-confirm-password" autoComplete="new-password" type={showConfirmNewPassword ? "text" : "password"} required value={confirmNewPassword} onChange={(event) => { setConfirmNewPassword(event.target.value); setConfirmPasswordError(""); setError(""); }} className={`${inputClass} pr-12`} placeholder={t("repeatNewPassword")} aria-invalid={!!confirmPasswordError} aria-describedby="reset-confirm-password-error" />
              <button type="button" onClick={() => setShowConfirmNewPassword((visible) => !visible)} aria-label={showConfirmNewPassword ? t("hidePassword") : t("showPassword")} aria-pressed={showConfirmNewPassword} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                {showConfirmNewPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
              </button>
            </div>
            {confirmPasswordError && <span id="reset-confirm-password-error" className="mt-1 block text-sm text-red-400">{localizeAuthMessage(confirmPasswordError, t)}</span>}
          </div>
          <button type="submit" disabled={!signIn || busy} className={buttonClass}>{busy ? t("savingPassword") : t("savePassword")}</button>
          <button type="button" disabled={busy} onClick={() => void resetFlow()} className="min-h-11 w-full text-sm text-text-muted hover:text-text-primary">{t("cancelSignIn")}</button>
        </form>
      )}

      {message && <p role="status" className="mt-4 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-text-primary">{localizeAuthMessage(message, t)}</p>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{localizeAuthMessage(error, t)}</p>}
      <p className="mt-6 text-center text-sm text-text-muted">
        {t("noAccount")}{" "}
        <Link prefetch href={signUpDestination} className="font-semibold text-gold hover:text-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-sm">{t("registerNow")}</Link>
      </p>
    </div>
  );
}

function SignUpForm({ destination, signInDestination }: { destination: string; signInDestination: string }) {
  const t = useTranslations("auth");
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"credentials" | "verify">("credentials");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const signUpAttemptStarted = useRef(false);
  const busy = fetchStatus === "fetching";

  const required = useMemo(() => new Set([...(signUp?.requiredFields ?? []), ...requiredFields]), [requiredFields, signUp]);

  useEffect(() => {
    if (isLoaded && isSignedIn && !signUpAttemptStarted.current) router.replace(destination);
  }, [destination, isLoaded, isSignedIn, router]);

  const finalizeSignUp = async () => {
    const result = await runAuthAction(
      () => finalizeThenNavigate(
        (params) => signUp.finalize(params),
        destination,
        (url) => finishNavigation(url, destination),
      ),
      setError,
      "Konto konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
    );
    if (!result || result.error) {
      signUpAttemptStarted.current = false;
      if (result?.error) setError(readableAuthError(result.error, "Konto konnte nicht abgeschlossen werden. Bitte versuche es erneut."));
    }
  };

  const submitSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signUp || busy) return;
    setError("");
    setMessage("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Gib eine gültige E-Mail-Adresse ein.");
      return;
    }
    if (password.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen enthalten.");
      return;
    }
    signUpAttemptStarted.current = true;
    const additionalFields = {
      ...(required.has("first_name") && firstName.trim() ? { firstName: firstName.trim() } : {}),
      ...(required.has("last_name") && lastName.trim() ? { lastName: lastName.trim() } : {}),
      ...(required.has("legal_accepted") ? { legalAccepted } : {}),
    };
    const result = await runAuthAction(() => signUp.password({ emailAddress: email.trim(), password, ...additionalFields }), setError, "Registrierung fehlgeschlagen. Bitte prüfe deine Angaben.");
    if (!result || result.error) {
      signUpAttemptStarted.current = false;
      if (!result) return;
      setRequiredFields(signUp.missingFields);
      setError(readableAuthError(result.error, "Registrierung fehlgeschlagen. Bitte prüfe deine Angaben."));
      return;
    }
    if (signUp.status === "complete") {
      await finalizeSignUp();
      return;
    }
    setRequiredFields(signUp.missingFields);
    if (signUp.missingFields.length > 0 && (signUp.missingFields.includes("first_name") || signUp.missingFields.includes("last_name") || signUp.missingFields.includes("legal_accepted"))) {
      setError("Bitte ergänze die angezeigten Pflichtangaben.");
      return;
    }
    const verification = await runAuthAction(() => signUp.verifications.sendEmailCode(), setError, "Der Bestätigungscode konnte nicht gesendet werden.");
    if (!verification || verification.error) {
      if (!verification) return;
      setError(readableAuthError(verification.error, "Der Bestätigungscode konnte nicht gesendet werden."));
      return;
    }
    setStep("verify");
    setMessage("Dein Konto ist angelegt. Gib den Code ein, den wir an deine E-Mail-Adresse gesendet haben.");
  };

  const verifySignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signUp || busy) return;
    setError("");
    setMessage("");
    const result = await runAuthAction(() => signUp.verifications.verifyEmailCode({ code: code.trim() }), setError, "Der Code konnte nicht geprüft werden.");
    if (!result || result.error) {
      if (!result) return;
      setError(readableAuthError(result.error, "Der Code stimmt nicht oder ist abgelaufen. Bitte prüfe ihn und versuche es erneut."));
      return;
    }
    if (signUp.status === "complete") await finalizeSignUp();
    else if (signUp.missingFields.length > 0) {
      setRequiredFields(signUp.missingFields);
      setStep("credentials");
      setError("Bitte ergänze die noch fehlenden Pflichtangaben.");
    } else setError("Die E-Mail-Bestätigung ist noch nicht abgeschlossen. Bitte prüfe den Code.");
  };

  const resendCode = async () => {
    if (!signUp || busy) return;
    setError("");
    const result = await runAuthAction(() => signUp.verifications.sendEmailCode(), setError, "Der Bestätigungscode konnte nicht gesendet werden.");
    if (!result) return;
    if (result.error) setError(readableAuthError(result.error, "Der Bestätigungscode konnte nicht gesendet werden."));
    else setMessage("Ein neuer Bestätigungscode wurde gesendet.");
  };

  const resetSignUp = async () => {
    const result = await runAuthAction(() => signUp.reset(), setError, "Der Registrierungsvorgang konnte nicht zurückgesetzt werden.");
    if (!result || result.error) return;
    setStep("credentials");
    setCode("");
    setPassword("");
    setRequiredFields([]);
    setMessage("");
    setError("");
  };

  return (
    <div className="w-full">
      {step === "credentials" ? (
        <form onSubmit={submitSignUp} className="space-y-5" noValidate>
          <label className="block text-sm font-medium text-text-primary">{t("email")}<input autoComplete="email" autoCapitalize="none" autoCorrect="off" type="email" inputMode="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="name@beispiel.de" />
            {errors.fields.emailAddress && <span className="mt-1 block text-sm text-red-400">{errors.fields.emailAddress.message}</span>}
          </label>
          <label className="block text-sm font-medium text-text-primary">{t("password")}<input autoComplete="new-password" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} placeholder={t("minimumPassword")} />
            {errors.fields.password && <span className="mt-1 block text-sm text-red-400">{errors.fields.password.message}</span>}
          </label>
          {required.has("first_name") && <label className="block text-sm font-medium text-text-primary">{t("firstName")}<input autoComplete="given-name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} className={inputClass} />
            {errors.fields.firstName && <span className="mt-1 block text-sm text-red-400">{errors.fields.firstName.message}</span>}
          </label>}
          {required.has("last_name") && <label className="block text-sm font-medium text-text-primary">{t("lastName")}<input autoComplete="family-name" required value={lastName} onChange={(event) => setLastName(event.target.value)} className={inputClass} />
            {errors.fields.lastName && <span className="mt-1 block text-sm text-red-400">{errors.fields.lastName.message}</span>}
          </label>}
          {required.has("legal_accepted") && <label className="flex min-h-11 items-center gap-3 text-sm text-text-secondary">
            <input type="checkbox" required checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} className="h-5 w-5 accent-[var(--color-gold)]" />
            <span>{t("agree")}<Link href="/agb" target="_blank" className="underline hover:text-gold">{t("terms")}</Link> {t("and")}<Link href="/datenschutz" target="_blank" className="underline hover:text-gold">{t("privacy")}</Link> {t("agreeEnd")}</span>
            {errors.fields.legalAccepted && <span className="text-sm text-red-400">{errors.fields.legalAccepted.message}</span>}
          </label>}
          <button type="submit" disabled={!signUp || busy || (required.has("legal_accepted") && !legalAccepted)} className={buttonClass}>{busy ? t("creatingAccount") : t("createAccount")}</button>
          <p className="text-center text-xs leading-5 text-text-muted">{t("accountOnly")}</p>
          <div id="clerk-captcha" />
        </form>
      ) : (
        <form onSubmit={verifySignUp} className="space-y-5">
          <label className="block text-sm font-medium text-text-primary">{t("verificationCode")}<input autoComplete="one-time-code" inputMode="numeric" required value={code} onChange={(event) => setCode(event.target.value)} className={inputClass} placeholder={t("codeFromEmail")} />
            {errors.fields.code && <span className="mt-1 block text-sm text-red-400">{errors.fields.code.message}</span>}
          </label>
          <button type="submit" disabled={!signUp || busy} className={buttonClass}>{busy ? t("verifying") : t("verifyEmail")}</button>
          <button type="button" disabled={!signUp || busy} onClick={() => void resendCode()} className={`${secondaryButtonClass} w-full`}>{t("resendCode")}</button>
          <button type="button" disabled={busy} onClick={() => void resetSignUp()} className="min-h-11 w-full text-sm text-text-muted hover:text-text-primary">{t("changeEmail")}</button>
        </form>
      )}
      {message && <p role="status" className="mt-4 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-text-primary">{localizeAuthMessage(message, t)}</p>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{localizeAuthMessage(error, t)}</p>}
      <p className="mt-6 text-center text-sm text-text-muted">
        {t("existingAccount")}{" "}
        <Link prefetch href={signInDestination} className="font-semibold text-gold hover:text-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-sm">{t("signIn")}</Link>
      </p>
    </div>
  );
}
