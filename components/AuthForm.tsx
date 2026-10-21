"use client";

import { useAuth, useSignIn, useSignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMfaResendChannel, getPasswordSignInAction, selectSecondFactor, shouldFallbackAfterFinalize, shouldRedirectForActiveSession } from "@/lib/sign-in-flow";

type AuthMode = "sign-in" | "sign-up";
type SignInStep = "credentials" | "email-code" | "mfa" | "reset-code" | "new-password";

type AuthFormProps = {
  mode: AuthMode;
  destination: string;
  signUpDestination?: string;
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

function finishNavigation(destination: string, decorateUrl: (url: string) => string) {
  const url = decorateUrl(destination);
  try {
    const target = new URL(url, window.location.origin);
    if (target.origin === window.location.origin) {
      window.location.replace(`${target.pathname}${target.search}${target.hash}`);
      return;
    }
  } catch {
    // Use the already validated same-origin destination below.
  }
  window.location.replace(destination);
}

export default function AuthForm({ mode, destination, signUpDestination }: AuthFormProps) {
  return mode === "sign-in"
    ? <SignInForm destination={destination} signUpDestination={signUpDestination ?? "/sign-up"} />
    : <SignUpForm destination={destination} />;
}

function SignInForm({ destination, signUpDestination }: { destination: string; signUpDestination: string }) {
  const { signIn, errors, fetchStatus } = useSignIn();
  const { isLoaded, isSignedIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [step, setStep] = useState<SignInStep>("credentials");
  const [factor, setFactor] = useState<"email_code" | "phone_code" | "totp" | "backup_code" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const signInAttemptStarted = useRef(false);
  const navigationStarted = useRef(false);
  const busy = fetchStatus === "fetching" || submitting;

  const navigateOnce = useCallback((url: string) => {
    if (navigationStarted.current) return;
    navigationStarted.current = true;
    finishNavigation(url, (value) => value);
  }, []);

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
    let navigationCallbackCalled = false;
    const result = await runAuthAction(
      () => signIn.finalize({ navigate: ({ decorateUrl }) => {
        navigationCallbackCalled = true;
        navigateOnce(decorateUrl(destination));
      } }),
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
    if (shouldFallbackAfterFinalize(false, navigationCallbackCalled)) navigateOnce(destination);
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
    if (!signIn || busy || !email.trim()) {
      setError("Gib zuerst deine E-Mail-Adresse ein.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Gib eine gültige E-Mail-Adresse ein.");
      return;
    }
    setError("");
    setMessage("");
    const startResult = await runAuthAction(() => signIn.create({ identifier: email.trim() }), setError, "Die Wiederherstellung konnte nicht gestartet werden.");
    if (!startResult || startResult.error) {
      if (!startResult) return;
      setError(readableAuthError(startResult.error, "Die Wiederherstellung konnte nicht gestartet werden."));
      return;
    }
    const codeResult = await runAuthAction(() => signIn.resetPasswordEmailCode.sendCode(), setError, "Der Wiederherstellungscode konnte nicht gesendet werden.");
    if (!codeResult || codeResult.error) {
      if (!codeResult) return;
      setError(readableAuthError(codeResult.error, "Der Wiederherstellungscode konnte nicht gesendet werden."));
      return;
    }
    setStep("reset-code");
    setCode("");
    setMessage("Wir haben einen Wiederherstellungscode an deine E-Mail-Adresse gesendet.");
  };

  const submitResetCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signIn || busy) return;
    setError("");
    setMessage("");
    const result = await runAuthAction(() => signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() }), setError, "Der Code konnte nicht geprüft werden.");
    if (!result || result.error) {
      if (!result) return;
      setError(readableAuthError(result.error, "Der Code stimmt nicht oder ist abgelaufen."));
    }
    else if (signIn.status === "needs_new_password") setStep("new-password");
    else setError("Der Code wurde nicht akzeptiert. Bitte fordere einen neuen Code an.");
  };

  const submitNewPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signIn || busy) return;
    setError("");
    if (newPassword.length < 8) {
      setError("Das neue Passwort muss mindestens 8 Zeichen enthalten.");
      return;
    }
    const result = await runAuthAction(() => signIn.resetPasswordEmailCode.submitPassword({ password: newPassword }), setError, "Das neue Passwort konnte nicht gespeichert werden.");
    if (!result || result.error) {
      if (!result) return;
      setError(readableAuthError(result.error, "Das neue Passwort konnte nicht gespeichert werden."));
    }
    else if (signIn.status === "complete") await completeSignIn();
    else setError("Die Passwortänderung ist noch nicht abgeschlossen.");
  };

  const resetFlow = async () => {
    const result = await runAuthAction(() => signIn.reset(), setError, "Der Anmeldevorgang konnte nicht zurückgesetzt werden.");
    if (!result || result.error) return;
    setStep("credentials");
    setCode("");
    setNewPassword("");
    setMessage("");
    setError("");
  };

  return (
    <div className="w-full">
      {step === "credentials" && (
        <form onSubmit={submitPassword} className="space-y-5" noValidate>
          <label className="block text-sm font-medium text-text-primary">
            E-Mail-Adresse
            <input autoComplete="email" autoCapitalize="none" autoCorrect="off" type="email" inputMode="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="name@beispiel.de" />
            {errors.fields.identifier && <span className="mt-1 block text-sm text-red-400">{errors.fields.identifier.message}</span>}
          </label>
          <label className="block text-sm font-medium text-text-primary">
            Passwort
            <input autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} placeholder="Dein Passwort" />
            {errors.fields.password && <span className="mt-1 block text-sm text-red-400">{errors.fields.password.message}</span>}
          </label>
          <button type="submit" disabled={!signIn || busy} className={buttonClass}>
            {busy ? "Anmeldung läuft …" : "Anmelden"}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <button type="button" disabled={!signIn || busy || !email.trim()} onClick={() => void startPasswordReset()} className="min-h-11 text-text-muted underline-offset-4 hover:text-gold hover:underline disabled:opacity-50">
              Passwort vergessen?
            </button>
            <button type="button" disabled={!signIn || busy || !email.trim()} onClick={() => void sendEmailCode()} className="min-h-11 text-gold underline-offset-4 hover:underline disabled:opacity-50">
              Mit E-Mail-Code anmelden
            </button>
          </div>
        </form>
      )}

      {(step === "email-code" || step === "mfa") && (
        <form onSubmit={submitCode} className="space-y-5">
          <label className="block text-sm font-medium text-text-primary">
            {step === "mfa" && factor === "totp" ? "Code aus der Authenticator-App" : step === "mfa" && factor === "backup_code" ? "Wiederherstellungscode" : "E-Mail-Code"}
            <input autoComplete="one-time-code" inputMode="numeric" required value={code} onChange={(event) => setCode(event.target.value)} className={inputClass} placeholder="Bestätigungscode" />
            {errors.fields.code && <span className="mt-1 block text-sm text-red-400">{errors.fields.code.message}</span>}
          </label>
          <button type="submit" disabled={!signIn || busy} className={buttonClass}>{busy ? "Prüfe Code …" : "Code bestätigen"}</button>
          {step === "email-code" && <button type="button" disabled={!signIn || busy} onClick={() => void sendEmailCode()} className={`${secondaryButtonClass} w-full`}>Neuen Code senden</button>}
          {step === "mfa" && getMfaResendChannel(factor) && <button type="button" disabled={!signIn || busy} onClick={() => void resendSecondFactorCode()} className={`${secondaryButtonClass} w-full`}>Neuen Code senden</button>}
          <button type="button" disabled={busy} onClick={() => void resetFlow()} className="min-h-11 w-full text-sm text-text-muted hover:text-text-primary">Zurück zur Anmeldung</button>
        </form>
      )}

      {step === "reset-code" && (
        <form onSubmit={submitResetCode} className="space-y-5">
          <label className="block text-sm font-medium text-text-primary">Wiederherstellungscode
            <input autoComplete="one-time-code" inputMode="numeric" required value={code} onChange={(event) => setCode(event.target.value)} className={inputClass} placeholder="Code aus der E-Mail" />
            {errors.fields.code && <span className="mt-1 block text-sm text-red-400">{errors.fields.code.message}</span>}
          </label>
          <button type="submit" disabled={!signIn || busy} className={buttonClass}>{busy ? "Prüfe Code …" : "Code bestätigen"}</button>
          <button type="button" disabled={busy} onClick={() => void resetFlow()} className="min-h-11 w-full text-sm text-text-muted hover:text-text-primary">Zurück zur Anmeldung</button>
        </form>
      )}

      {step === "new-password" && (
        <form onSubmit={submitNewPassword} className="space-y-5">
          <label className="block text-sm font-medium text-text-primary">Neues Passwort
            <input autoComplete="new-password" type="password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClass} placeholder="Mindestens 8 Zeichen" />
            {errors.fields.password && <span className="mt-1 block text-sm text-red-400">{errors.fields.password.message}</span>}
          </label>
          <button type="submit" disabled={!signIn || busy} className={buttonClass}>{busy ? "Speichere Passwort …" : "Passwort speichern und anmelden"}</button>
        </form>
      )}

      {message && <p role="status" className="mt-4 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-text-primary">{message}</p>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
      <p className="mt-6 text-center text-sm text-text-muted">
        Noch kein Konto?{" "}
        <Link prefetch href={signUpDestination} className="font-semibold text-gold hover:text-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-sm">Jetzt registrieren</Link>
      </p>
    </div>
  );
}

function SignUpForm({ destination }: { destination: string }) {
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();
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
  const busy = fetchStatus === "fetching";

  const required = useMemo(() => new Set([...(signUp?.requiredFields ?? []), ...requiredFields]), [requiredFields, signUp]);

  useEffect(() => {
    if (isSignedIn) router.replace(destination);
  }, [destination, isSignedIn, router]);

  const finalizeSignUp = async () => {
    const result = await runAuthAction(
      () => signUp.finalize({ navigate: ({ decorateUrl }) => finishNavigation(destination, decorateUrl) }),
      setError,
      "Konto konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
    );
    if (result?.error) setError(readableAuthError(result.error, "Konto konnte nicht abgeschlossen werden. Bitte versuche es erneut."));
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
    const additionalFields = {
      ...(required.has("first_name") && firstName.trim() ? { firstName: firstName.trim() } : {}),
      ...(required.has("last_name") && lastName.trim() ? { lastName: lastName.trim() } : {}),
      ...(required.has("legal_accepted") ? { legalAccepted } : {}),
    };
    const result = await runAuthAction(() => signUp.password({ emailAddress: email.trim(), password, ...additionalFields }), setError, "Registrierung fehlgeschlagen. Bitte prüfe deine Angaben.");
    if (!result || result.error) {
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
          <label className="block text-sm font-medium text-text-primary">E-Mail-Adresse
            <input autoComplete="email" autoCapitalize="none" autoCorrect="off" type="email" inputMode="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="name@beispiel.de" />
            {errors.fields.emailAddress && <span className="mt-1 block text-sm text-red-400">{errors.fields.emailAddress.message}</span>}
          </label>
          <label className="block text-sm font-medium text-text-primary">Passwort
            <input autoComplete="new-password" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} placeholder="Mindestens 8 Zeichen" />
            {errors.fields.password && <span className="mt-1 block text-sm text-red-400">{errors.fields.password.message}</span>}
          </label>
          {required.has("first_name") && <label className="block text-sm font-medium text-text-primary">Vorname
            <input autoComplete="given-name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} className={inputClass} />
            {errors.fields.firstName && <span className="mt-1 block text-sm text-red-400">{errors.fields.firstName.message}</span>}
          </label>}
          {required.has("last_name") && <label className="block text-sm font-medium text-text-primary">Nachname
            <input autoComplete="family-name" required value={lastName} onChange={(event) => setLastName(event.target.value)} className={inputClass} />
            {errors.fields.lastName && <span className="mt-1 block text-sm text-red-400">{errors.fields.lastName.message}</span>}
          </label>}
          {required.has("legal_accepted") && <label className="flex min-h-11 items-center gap-3 text-sm text-text-secondary">
            <input type="checkbox" required checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} className="h-5 w-5 accent-[var(--color-gold)]" />
            <span>Ich stimme den <Link href="/agb" target="_blank" className="underline hover:text-gold">Nutzungsbedingungen</Link> und <Link href="/datenschutz" target="_blank" className="underline hover:text-gold">Datenschutzhinweisen</Link> zu.</span>
            {errors.fields.legalAccepted && <span className="text-sm text-red-400">{errors.fields.legalAccepted.message}</span>}
          </label>}
          <button type="submit" disabled={!signUp || busy || (required.has("legal_accepted") && !legalAccepted)} className={buttonClass}>{busy ? "Konto wird erstellt …" : "Konto erstellen"}</button>
          <p className="text-center text-xs leading-5 text-text-muted">Mit der Registrierung wird nur dein Konto angelegt. Tätigkeiten und Profildetails ergänzt du anschließend.</p>
          <div id="clerk-captcha" />
        </form>
      ) : (
        <form onSubmit={verifySignUp} className="space-y-5">
          <label className="block text-sm font-medium text-text-primary">Bestätigungscode
            <input autoComplete="one-time-code" inputMode="numeric" required value={code} onChange={(event) => setCode(event.target.value)} className={inputClass} placeholder="Code aus der E-Mail" />
            {errors.fields.code && <span className="mt-1 block text-sm text-red-400">{errors.fields.code.message}</span>}
          </label>
          <button type="submit" disabled={!signUp || busy} className={buttonClass}>{busy ? "Bestätige …" : "E-Mail bestätigen"}</button>
          <button type="button" disabled={!signUp || busy} onClick={() => void resendCode()} className={`${secondaryButtonClass} w-full`}>Code erneut senden</button>
          <button type="button" disabled={busy} onClick={() => void resetSignUp()} className="min-h-11 w-full text-sm text-text-muted hover:text-text-primary">E-Mail-Adresse ändern</button>
        </form>
      )}
      {message && <p role="status" className="mt-4 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-text-primary">{message}</p>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
      <p className="mt-6 text-center text-sm text-text-muted">
        Schon registriert?{" "}
        <Link prefetch href="/sign-in" className="font-semibold text-gold hover:text-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-sm">Anmelden</Link>
      </p>
    </div>
  );
}
