"use client";

import { useAuth, useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations , useLocale } from "next-intl";
import { localizeAuthMessage } from "@/lib/i18n/auth-messages";
import { Eye, EyeOff } from "lucide-react";
import { finalizeThenNavigate, getMfaResendChannel, getPasswordSignInAction, resolveAuthNavigationUrl, selectSecondFactor, shouldRedirectForActiveSession } from "@/lib/sign-in-flow";
import { classifyPasswordResetError, getPasswordResetRequestErrorMessage, PASSWORD_RESET_NEUTRAL_MESSAGE, PASSWORD_RESET_RESEND_COOLDOWN_SECONDS, validateNewPassword } from "@/lib/password-reset-flow";
import { readableAuthError, type AuthErrorContext } from "@/lib/auth-error-message";

type AuthMode = "sign-in" | "sign-up";
type SignInStep = "credentials" | "email-code" | "mfa" | "reset-code" | "new-password";

type AuthFormProps = {
  mode: AuthMode;
  destination: string;
  signUpDestination?: string;
  signInDestination?: string;
};

const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-border bg-bg-secondary px-4 text-base text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-gold/20";
const buttonClass = "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gold px-5 text-base font-bold text-bg-primary transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass = "inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-text-secondary transition-colors hover:border-gold hover:text-gold disabled:opacity-60";

async function runAuthAction<T>(translate: (key: string, values?: Record<string, string | number>) => string, action: () => Promise<T>, setError: (message: string) => void, fallback: string, context: AuthErrorContext = "sign-in"): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    setError(readableAuthError(translate, error, fallback, context));
    return undefined;
  }
}

function finishNavigation(url: string, fallback: string, navigate: (url: string) => void | Promise<unknown>) {
  const target = resolveAuthNavigationUrl(url, window.location.origin, fallback);
  // The SDK awaits Next.js transitions and signals its own document redirects.
  // Bypassing it for Safari's ITP URL lets setActive refresh a departing page.
  return navigate(target);
}

export default function AuthForm({ mode, destination, signUpDestination, signInDestination }: AuthFormProps) {
  return mode === "sign-in"
    ? <SignInForm destination={destination} signUpDestination={signUpDestination ?? "/sign-up"} />
    : <SignUpForm destination={destination} signInDestination={signInDestination ?? "/sign-in"} />;
}

function SignInForm({ destination, signUpDestination }: { destination: string; signUpDestination: string }) {
  const uiText = useTranslations();

  const t = useTranslations("auth");
  const { signIn, errors, fetchStatus } = useSignIn();
  const clerk = useClerk();
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
  const [storedStep, setStep] = useState<SignInStep>("credentials");
  const [factor, setFactor] = useState<"email_code" | "phone_code" | "totp" | "backup_code" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const signInAttemptStarted = useRef(false);
  const navigationStarted = useRef(false);
  const busy = fetchStatus === "fetching" || submitting;
  // A restored Clerk attempt can already require a new password before this
  // component's local step has changed. Do not replace or reset that attempt.
  const step = isLoaded && signIn.status === "needs_new_password" ? "new-password" : storedStep;

  useEffect(() => {
    if (resetCooldownSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setResetCooldownSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resetCooldownSeconds]);

  const navigateOnce = useCallback(async (url: string) => {
    if (navigationStarted.current) return;
    navigationStarted.current = true;
    // Clerk's Next.js adapter resolves after the route transition commits.
    // A raw router.replace returns void and lets finalization refresh too early.
    try {
      return await finishNavigation(url, destination, (target) => clerk.navigate(target, { replace: true }));
    } catch (error) {
      navigationStarted.current = false;
      throw error;
    }
  }, [clerk, destination]);

  const beginSubmission = () => {
    if (!isLoaded || !signIn || busy || submissionInFlight.current) return false;
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
      void navigateOnce(destination).catch((error) => setError(readableAuthError(uiText, error, t("finishError"))));
    }
  }, [destination, error, isLoaded, isSignedIn, navigateOnce, t, uiText]);

  const completeSignIn = async () => {
    const result = await runAuthAction(uiText,
      () => finalizeThenNavigate(
        (params) => signIn.finalize(params),
        destination,
        navigateOnce,
      ),
      setError,
      uiText("auth.finishError"),
    );
    if (!result) {
      signInAttemptStarted.current = false;
      return;
    }
    if (result.error) {
      setError(readableAuthError(uiText, result.error, uiText("auth.finishError")));
      signInAttemptStarted.current = false;
      return;
    }
  };

  const prepareSecondFactor = async () => {
    const supported = signIn.supportedSecondFactors.map((entry) => entry.strategy);
    const selected = selectSecondFactor(supported);
    if (!selected) {
      setError(uiText("auth.unsupportedChallenge"));
      return;
    }
    setFactor(selected);
    setStep("mfa");
    setCode("");
    if (selected === "email_code") {
      const result = await runAuthAction(uiText, () => signIn.mfa.sendEmailCode(), setError, uiText("auth.codeSendError"));
      if (!result) return;
      if (result.error) setError(readableAuthError(uiText, result.error, uiText("auth.codeSendError")));
      else setMessage(uiText("auth.sentEmail"));
    } else if (selected === "phone_code") {
      const result = await runAuthAction(uiText, () => signIn.mfa.sendPhoneCode(), setError, uiText("auth.codeSendError"));
      if (!result) return;
      if (result.error) setError(readableAuthError(uiText, result.error, uiText("auth.codeSendError")));
      else setMessage(uiText("auth.sentPhone"));
    } else {
      setMessage(selected === "totp" ? uiText("auth.authenticatorInstruction") : uiText("auth.backupInstruction"));
    }
  };

  const resendSecondFactorCode = async () => {
    if (!isLoaded || !signIn || busy) return;
    const channel = getMfaResendChannel(factor);
    if (!channel) return;
    setError("");
    setMessage("");
    const fallback = uiText("Ui.text_62939a0448e348");
    const result = await runAuthAction(uiText,
      () => channel === "email" ? signIn.mfa.sendEmailCode() : signIn.mfa.sendPhoneCode(),
      setError,
      fallback,
    );
    if (!result || result.error) {
      if (result?.error) setError(readableAuthError(uiText, result.error, fallback));
      return;
    }
    setMessage(channel === "email"
      ? uiText("Ui.text_a61a03e5cd6b6a")
      : uiText("Ui.text_463bc84306a541"));
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
        setError(uiText("auth.invalidEmail"));
        return;
      }
      const result = await runAuthAction(uiText, () => signIn.password({ emailAddress: email.trim(), password }), setError, uiText("auth.loginError"));
      if (!result || result.error) {
        signInAttemptStarted.current = false;
        if (result?.error) setError(readableAuthError(uiText, result.error, uiText("auth.loginError")));
        return;
      }
      const nextAction = getPasswordSignInAction(signIn.status);
      if (nextAction === "complete") await completeSignIn();
      else if (nextAction === "mfa") await prepareSecondFactor();
      else if (nextAction === "new-password") {
        setStep("new-password");
        setMessage(uiText("auth.passwordChangeRequired"));
      } else {
        signInAttemptStarted.current = false;
        setError(uiText("Ui.text_fe3e3d3d3203bd"));
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
      setError(uiText("auth.invalidEmail"));
      finishSubmission();
      return;
    }
    try {
      const result = await runAuthAction(uiText, () => signIn.emailCode.sendCode({ emailAddress: email.trim() }), setError, uiText("Ui.text_1ff24e3645f178"));
      if (!result || result.error) {
        signInAttemptStarted.current = false;
        if (result?.error) setError(readableAuthError(uiText, result.error, uiText("Ui.text_1ff24e3645f178")));
      }
      else {
        setStep("email-code");
        setCode("");
        setMessage(uiText("Ui.text_84e09ad283b71c"));
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
      const result = await runAuthAction(uiText, async () => step === "mfa"
        ? factor === "email_code" ? await signIn.mfa.verifyEmailCode({ code: code.trim() })
          : factor === "phone_code" ? await signIn.mfa.verifyPhoneCode({ code: code.trim() })
            : factor === "totp" ? await signIn.mfa.verifyTOTP({ code: code.trim() })
              : await signIn.mfa.verifyBackupCode({ code: code.trim() })
        : await signIn.emailCode.verifyCode({ code: code.trim() }), setError, uiText("auth.codeError"));
      if (!result || result.error) {
        if (result?.error) setError(readableAuthError(uiText, result.error, uiText("Ui.text_db77886f4bf574")));
        return;
      }
      if (signIn.status === "complete") await completeSignIn();
      else if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") await prepareSecondFactor();
      else if (signIn.status === "needs_new_password") {
        setStep("new-password");
        setMessage(uiText("auth.passwordChangeRequired"));
      } else setError(uiText("Ui.text_61796f18c9376c"));
    } finally {
      finishSubmission();
    }
  };

  const startPasswordReset = async () => {
    if (!isLoaded || !signIn || busy) return;
    if (resetCooldownSeconds > 0) {
      setResetEmailError(uiText("Ui.text_2bfda3734735f4", { value1: String(resetCooldownSeconds) }));
      return;
    }
    if (!email.trim()) {
      setResetEmailError(uiText("auth.emailFirst"));
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setResetEmailError(uiText("auth.invalidEmail"));
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
        setError(uiText("auth.recoveryError"));
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
      setResetCodeError(uiText("auth.enterEmailCode"));
      finishSubmission();
      return;
    }
    try {
      const result = await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() });
      if (result.error) setResetCodeError(readableAuthError(uiText, result.error, uiText("Ui.text_7a8518e113003d")));
      else if (signIn.status === "needs_new_password") setStep("new-password");
      else setResetCodeError(uiText("Ui.text_e142fb710b14e3"));
    } catch {
      setResetCodeError(uiText("Ui.text_7454aaf04edc68"));
    } finally {
      finishSubmission();
    }
  };

  const resendPasswordResetCode = async () => {
    if (!isLoaded || !signIn || busy) return;
    if (resetCooldownSeconds > 0) {
      setError(uiText("Ui.text_e03259f7102497", { value1: String(resetCooldownSeconds) }));
      return;
    }
    if (!beginSubmission()) return;
    setError("");
    setMessage("");
    setResetCodeError("");
    try {
      const resetResult = await signIn.reset();
      if (resetResult.error) {
        setError(uiText("auth.recoveryError"));
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
        setError(uiText("Ui.text_de55d536eaca2a"));
        return;
      }
      const result = await signIn.emailCode.sendCode({ emailAddress: email.trim() });
      if (result.error) {
        setError(readableAuthError(uiText, result.error, uiText("Ui.text_1ff24e3645f178")));
        return;
      }
      setStep("email-code");
      setCode("");
      setMessage(uiText("Ui.text_b6dbc6d6e4cf17"));
    } catch {
      setError(uiText("Ui.text_638260a6b0785b"));
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
        setNewPasswordError(readableAuthError(uiText, result.error, uiText("auth.passwordSaveError"), "new-password"));
        return;
      }
      const nextAction = getPasswordSignInAction(signIn.status);
      if (nextAction === "complete") {
        setMessage(uiText("auth.passwordSuccess"));
        await completeSignIn();
      } else if (nextAction === "mfa") {
        setMessage(uiText("auth.passwordSecurity"));
        await prepareSecondFactor();
      } else {
        signInAttemptStarted.current = false;
        setError(uiText("auth.passwordUnconfirmed"));
      }
    } catch (error) {
      signInAttemptStarted.current = false;
      setError(readableAuthError(uiText, error, uiText("Ui.text_a1d773d89cdd06"), "new-password"));
    } finally {
      finishSubmission();
    }
  };

  const resetFlow = async () => {
    if (!signIn || !beginSubmission()) return;
    try {
      const result = await signIn.reset();
      if (result.error) {
        setError(uiText("auth.restartError"));
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
            {t("email")}<input id="sign-in-email" autoComplete="email" autoCapitalize="none" autoCorrect="off" type="email" inputMode="email" required value={email} onChange={(event) => { setEmail(event.target.value); setResetEmailError(""); }} className={inputClass} placeholder={uiText("Ui.text_990cce75c691b0")} aria-invalid={!!resetEmailError} aria-describedby={resetEmailError ? "reset-email-error" : undefined} />
            {errors.fields.identifier && <span className="mt-1 block text-sm text-red-400">{readableAuthError(uiText, errors.fields.identifier, t("invalidEmail"))}</span>}
            {resetEmailError && <span id="reset-email-error" className="mt-1 block text-sm text-red-400">{localizeAuthMessage(resetEmailError, t)}</span>}
          </label>
          <label className="block text-sm font-medium text-text-primary">
            {t("password")}<input autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} placeholder={t("yourPassword")} />
            {errors.fields.password && <span className="mt-1 block text-sm text-red-400">{readableAuthError(uiText, errors.fields.password, t("credentialsError"))}</span>}
          </label>
          <button type="submit" disabled={!isLoaded || !signIn || busy} className={buttonClass}>
            {!isLoaded ? t("loadingService") : busy ? t("signingIn") : t("signIn")}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <button type="button" disabled={!isLoaded || !signIn || busy || !email.trim() || resetCooldownSeconds > 0} onClick={() => void startPasswordReset()} className="min-h-11 text-text-muted underline-offset-4 hover:text-gold hover:underline disabled:opacity-50">
              {resetRequestInProgress ? t("recovering") : resetCooldownSeconds > 0 ? t("retrySeconds", {seconds: resetCooldownSeconds}) : t("forgotPassword")}
            </button>
            <button type="button" disabled={!isLoaded || !signIn || busy || !email.trim()} onClick={() => void sendEmailCode()} className="min-h-11 text-gold underline-offset-4 hover:underline disabled:opacity-50">
              {t("emailSignIn")}</button>
          </div>
        </form>
      )}

      {(step === "email-code" || step === "mfa") && (
        <form onSubmit={submitCode} className="space-y-5">
          <label className="block text-sm font-medium text-text-primary">
            {step === "mfa" && factor === "totp" ? t("authenticatorCode") : step === "mfa" && factor === "backup_code" ? t("recoveryCode") : t("emailCode")}
            <input autoComplete="one-time-code" inputMode="numeric" required value={code} onChange={(event) => setCode(event.target.value)} className={inputClass} placeholder={t("verificationCode")} />
            {errors.fields.code && <span className="mt-1 block text-sm text-red-400">{readableAuthError(uiText, errors.fields.code, t("codeError"))}</span>}
          </label>
          <button type="submit" disabled={!isLoaded || !signIn || busy} className={buttonClass}>{busy ? t("checkingCode") : t("verifyCode")}</button>
          {step === "email-code" && <button type="button" disabled={!isLoaded || !signIn || busy} onClick={() => void sendEmailCode()} className={`${secondaryButtonClass} w-full`}>{t("sendNewCode")}</button>}
          {step === "mfa" && getMfaResendChannel(factor) && <button type="button" disabled={!isLoaded || !signIn || busy} onClick={() => void resendSecondFactorCode()} className={`${secondaryButtonClass} w-full`}>{t("sendNewCode")}</button>}
          <button type="button" disabled={busy} onClick={() => void resetFlow()} className="min-h-11 w-full text-sm text-text-muted hover:text-text-primary">{t("backSignIn")}</button>
        </form>
      )}

      {step === "reset-code" && (
        <form onSubmit={submitResetCode} className="space-y-5" noValidate>
          <p className="text-sm leading-relaxed text-text-muted">{t("recoveryInstructions")}</p>
          <label className="block text-sm font-medium text-text-primary">{t("recoveryCode")}<input autoComplete="one-time-code" inputMode="numeric" required value={code} onChange={(event) => { setCode(event.target.value); setResetCodeError(""); }} className={inputClass} placeholder={t("codeFromEmail")} aria-invalid={!!resetCodeError} />
            {errors.fields.code && <span className="mt-1 block text-sm text-red-400">{readableAuthError(uiText, errors.fields.code, t("codeError"))}</span>}
            {resetCodeError && <span className="mt-1 block text-sm text-red-400">{localizeAuthMessage(resetCodeError, t)}</span>}
          </label>
          <button type="submit" disabled={!isLoaded || !signIn || busy} className={buttonClass}>{busy ? t("checkingCode") : t("verifyCode")}</button>
          <button type="button" disabled={!isLoaded || !signIn || busy || resetCooldownSeconds > 0} onClick={() => void resendPasswordResetCode()} className={`${secondaryButtonClass} w-full`}>
            {busy ? t("sendingCode") : resetCooldownSeconds > 0 ? t("requestSeconds", {seconds: resetCooldownSeconds}) : t("requestCode")}
          </button>
          <button type="button" disabled={!isLoaded || !signIn || busy} onClick={() => void startEmailCodeSignIn()} className="min-h-11 w-full text-sm font-semibold text-gold hover:underline">
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
            {errors.fields.password && <span className="mt-1 block text-sm text-red-400">{readableAuthError(uiText, errors.fields.password, t("passwordSaveError"), "new-password")}</span>}
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
          <button type="submit" disabled={!isLoaded || !signIn || busy} className={buttonClass}>{busy ? t("savingPassword") : t("savePassword")}</button>
          <button type="button" disabled={busy} onClick={() => void resetFlow()} className="min-h-11 w-full text-sm text-text-muted hover:text-text-primary">{t("cancelSignIn")}</button>
        </form>
      )}

      {(message || (step === "new-password" && !error)) && <p role="status" className="mt-4 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-text-primary">{message ? localizeAuthMessage(message, t) : t("passwordChangeRequired")}</p>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{localizeAuthMessage(error, t)}</p>}
      <p className="mt-6 text-center text-sm text-text-muted">
        {t("noAccount")}{" "}
        <Link prefetch href={signUpDestination} className="font-semibold text-gold hover:text-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-sm">{t("registerNow")}</Link>
      </p>
    </div>
  );
}

function SignUpForm({ destination, signInDestination }: { destination: string; signInDestination: string }) {
  const activeLocale = useLocale();
  const uiText = useTranslations();

  const t = useTranslations("auth");
  const { signUp, errors, fetchStatus } = useSignUp();
  const clerk = useClerk();
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
  const [submitting, setSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const busy = fetchStatus === "fetching" || submitting;

  const beginSubmission = () => {
    if (!isLoaded || !signUp || busy || submissionInFlight.current) return false;
    submissionInFlight.current = true;
    setSubmitting(true);
    return true;
  };

  const finishSubmission = () => {
    submissionInFlight.current = false;
    setSubmitting(false);
  };

  const required = useMemo(() => new Set([...(signUp?.requiredFields ?? []), ...requiredFields]), [requiredFields, signUp]);

  useEffect(() => {
    if (isLoaded && isSignedIn && !signUpAttemptStarted.current) router.replace(destination);
  }, [destination, isLoaded, isSignedIn, router]);

  const finalizeSignUp = async () => {
    const result = await runAuthAction(uiText,
      () => finalizeThenNavigate(
        (params) => signUp.finalize(params),
        destination,
        (url) => finishNavigation(url, destination, (target) => clerk.navigate(target, { replace: true })),
      ),
      setError,
      uiText("Ui.text_dadb5ea5e4bbac"),
    );
    if (!result || result.error) {
      signUpAttemptStarted.current = false;
      if (result?.error) setError(readableAuthError(uiText, result.error, uiText("Ui.text_dadb5ea5e4bbac")));
    }
  };

  const submitSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!beginSubmission()) return;
    try {
      setError("");
      setMessage("");
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
        setError(uiText("auth.invalidEmail"));
        return;
      }
      if (password.length < 8) {
        setError(uiText("auth.passwordLength"));
        return;
      }
      signUpAttemptStarted.current = true;
      const additionalFields = {
        ...(required.has("first_name") && firstName.trim() ? { firstName: firstName.trim() } : {}),
        ...(required.has("last_name") && lastName.trim() ? { lastName: lastName.trim() } : {}),
        ...(required.has("legal_accepted") ? { legalAccepted } : {}),
      };
      const result = await runAuthAction(uiText, () => signUp.password({ emailAddress: email.trim(), password, ...additionalFields , locale: activeLocale }), setError, uiText("auth.registrationError"), "sign-up");
      if (!result || result.error) {
        signUpAttemptStarted.current = false;
        if (!result) return;
        setRequiredFields(signUp.missingFields);
        setError(readableAuthError(uiText, result.error, uiText("auth.registrationError"), "sign-up"));
        return;
      }
      if (signUp.status === "complete") {
        await finalizeSignUp();
        return;
      }
      setRequiredFields(signUp.missingFields);
      if (signUp.missingFields.length > 0 && (signUp.missingFields.includes("first_name") || signUp.missingFields.includes("last_name") || signUp.missingFields.includes("legal_accepted"))) {
        setError(uiText("auth.requiredFields"));
        return;
      }
      const verification = await runAuthAction(uiText, () => signUp.verifications.sendEmailCode(), setError, uiText("auth.codeSendError"));
      if (!verification || verification.error) {
        if (!verification) return;
        setError(readableAuthError(uiText, verification.error, uiText("auth.codeSendError")));
        return;
      }
      setStep("verify");
      setMessage(uiText("auth.accountCreated"));
    } finally {
      finishSubmission();
    }
  };

  const verifySignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!beginSubmission()) return;
    try {
      setError("");
      setMessage("");
      const result = await runAuthAction(uiText, () => signUp.verifications.verifyEmailCode({ code: code.trim() }), setError, uiText("Ui.text_47b6b76cb146a0"));
      if (!result || result.error) {
        if (!result) return;
        setError(readableAuthError(uiText, result.error, uiText("Ui.text_db77886f4bf574")));
        return;
      }
      if (signUp.status === "complete") await finalizeSignUp();
      else if (signUp.missingFields.length > 0) {
        setRequiredFields(signUp.missingFields);
        setStep("credentials");
        setError(uiText("Ui.text_b4abaca3b3197e"));
      } else setError(uiText("Ui.text_2b7bd895a01ba7"));
    } finally {
      finishSubmission();
    }
  };

  const resendCode = async () => {
    if (!beginSubmission()) return;
    try {
      setError("");
      const result = await runAuthAction(uiText, () => signUp.verifications.sendEmailCode(), setError, uiText("auth.codeSendError"));
      if (!result) return;
      if (result.error) setError(readableAuthError(uiText, result.error, uiText("auth.codeSendError")));
      else setMessage(uiText("Ui.text_2e266434078269"));
    } finally {
      finishSubmission();
    }
  };

  const resetSignUp = async () => {
    if (!beginSubmission()) return;
    try {
      const result = await runAuthAction(uiText, () => signUp.reset(), setError, uiText("Ui.text_7a0b0cb6f5506e"));
      if (!result || result.error) {
        if (result?.error) setError(readableAuthError(uiText, result.error, uiText("Ui.text_7a0b0cb6f5506e")));
        return;
      }
      setStep("credentials");
      setCode("");
      setPassword("");
      setRequiredFields([]);
      setMessage("");
      setError("");
    } finally {
      finishSubmission();
    }
  };

  return (
    <div className="w-full">
      {step === "credentials" ? (
        <form onSubmit={submitSignUp} className="space-y-5" noValidate>
          <label className="block text-sm font-medium text-text-primary">{t("email")}<input autoComplete="email" autoCapitalize="none" autoCorrect="off" type="email" inputMode="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder={uiText("Ui.text_990cce75c691b0")} />
            {errors.fields.emailAddress && <span className="mt-1 block text-sm text-red-400">{readableAuthError(uiText, errors.fields.emailAddress, t("invalidEmail"))}</span>}
          </label>
          <label className="block text-sm font-medium text-text-primary">{t("password")}<input autoComplete="new-password" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} placeholder={t("minimumPassword")} />
            {errors.fields.password && <span className="mt-1 block text-sm text-red-400">{readableAuthError(uiText, errors.fields.password, t("passwordRules"), "sign-up")}</span>}
          </label>
          {required.has("first_name") && <label className="block text-sm font-medium text-text-primary">{t("firstName")}<input autoComplete="given-name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} className={inputClass} />
            {errors.fields.firstName && <span className="mt-1 block text-sm text-red-400">{readableAuthError(uiText, errors.fields.firstName, t("requiredFields"))}</span>}
          </label>}
          {required.has("last_name") && <label className="block text-sm font-medium text-text-primary">{t("lastName")}<input autoComplete="family-name" required value={lastName} onChange={(event) => setLastName(event.target.value)} className={inputClass} />
            {errors.fields.lastName && <span className="mt-1 block text-sm text-red-400">{readableAuthError(uiText, errors.fields.lastName, t("requiredFields"))}</span>}
          </label>}
          {required.has("legal_accepted") && <label className="flex min-h-11 items-center gap-3 text-sm text-text-secondary">
            <input type="checkbox" required checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} className="h-5 w-5 accent-[var(--color-gold)]" />
            <span>{t.rich("acceptTerms", {terms: chunks => <Link href="/agb" target="_blank" rel="noopener noreferrer" className="underline hover:text-gold">{chunks}</Link>})}</span>
            {errors.fields.legalAccepted && <span className="text-sm text-red-400">{readableAuthError(uiText, errors.fields.legalAccepted, t("requiredFields"))}</span>}
          </label>}
          <p className="text-xs leading-5 text-text-muted">{t.rich(required.has("legal_accepted") ? "registrationPrivacyNotice" : "registrationLegalNotice", {terms: chunks => <Link href="/agb" target="_blank" rel="noopener noreferrer" className="underline hover:text-gold">{chunks}</Link>, privacy: chunks => <Link href="/datenschutz" target="_blank" rel="noopener noreferrer" className="underline hover:text-gold">{chunks}</Link>})}</p>
          <button type="submit" disabled={!isLoaded || !signUp || busy || (required.has("legal_accepted") && !legalAccepted)} className={buttonClass}>{!isLoaded ? t("loadingService") : busy ? t("creatingAccount") : t("createAccount")}</button>
          <p className="text-center text-xs leading-5 text-text-muted">{t("accountOnly")}</p>
          <div id="clerk-captcha" />
        </form>
      ) : (
        <form onSubmit={verifySignUp} className="space-y-5">
          <label className="block text-sm font-medium text-text-primary">{t("verificationCode")}<input autoComplete="one-time-code" inputMode="numeric" required value={code} onChange={(event) => setCode(event.target.value)} className={inputClass} placeholder={t("codeFromEmail")} />
            {errors.fields.code && <span className="mt-1 block text-sm text-red-400">{readableAuthError(uiText, errors.fields.code, t("codeError"))}</span>}
          </label>
          <button type="submit" disabled={!isLoaded || !signUp || busy} className={buttonClass}>{busy ? t("verifying") : t("verifyEmail")}</button>
          <button type="button" disabled={!isLoaded || !signUp || busy} onClick={() => void resendCode()} className={`${secondaryButtonClass} w-full`}>{t("resendCode")}</button>
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
