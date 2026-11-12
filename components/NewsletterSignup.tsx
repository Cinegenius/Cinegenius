"use client";

import { FormEvent, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Mail, Send } from "lucide-react";
import { uiErrorMessage } from "@/lib/ui-error-message";

export function NewsletterSignup() {
  const t = useTranslations("NewsletterSignup");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [fieldError, setFieldError] = useState<"emailRequired" | "emailInvalid" | "consentRequired" | null>(null);
  const pending = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setMessage(null);
    const emailField = event.currentTarget.elements.namedItem("email") as HTMLInputElement;
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) || emailField.validity.typeMismatch) {
      setFieldError(trimmedEmail ? "emailInvalid" : "emailRequired");
      emailField.focus();
      return;
    }
    if (!consent) {
      setFieldError("consentRequired");
      (event.currentTarget.elements.namedItem("consent") as HTMLInputElement).focus();
      return;
    }
    setFieldError(null);
    pending.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, consent }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : t("submitError"));
      if (typeof result?.message !== "string" || !result.message.trim() || result.error !== undefined) throw new Error(t("submitError"));
      setMessage({ ok: true, text: result.message });
    } catch (error) {
      setMessage({ ok: false, text: uiErrorMessage(error, t("submitError")) });
    } finally { pending.current = false; setBusy(false); }
  }

  return <section aria-labelledby="newsletter-signup-title" className="mt-5 max-w-sm rounded-xl border border-border bg-bg-primary/50 p-4">
    <div className="flex items-center gap-2 text-text-primary"><Mail aria-hidden="true" size={16} className="shrink-0 text-gold" /><h4 id="newsletter-signup-title" className="text-sm font-semibold">{t("title")}</h4></div>
    <p className="mt-1 text-xs leading-5 text-text-muted">{t("intro")}</p>
    <form onSubmit={submit} noValidate aria-busy={busy} className="mt-3 space-y-3">
      <label className="sr-only" htmlFor="newsletter-email">{t("emailLabel")}</label>
      <input id="newsletter-email" name="email" type="email" required disabled={busy} autoComplete="email" maxLength={254} value={email} onChange={event => { setEmail(event.target.value); setFieldError(null); setMessage(null); }} aria-invalid={fieldError === "emailRequired" || fieldError === "emailInvalid"} aria-describedby={fieldError === "emailRequired" || fieldError === "emailInvalid" ? "newsletter-email-error" : undefined} placeholder={t("emailPlaceholder")} className="min-h-11 w-full min-w-0 rounded-lg border border-border bg-bg-secondary px-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-gold sm:text-sm" />
      {(fieldError === "emailRequired" || fieldError === "emailInvalid") && <p id="newsletter-email-error" role="alert" className="text-xs leading-5 text-text-primary">{t(fieldError)}</p>}
      <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-xs leading-5 text-text-secondary">
        <input name="consent" type="checkbox" required disabled={busy} checked={consent} onChange={event => { setConsent(event.target.checked); setFieldError(null); setMessage(null); }} aria-invalid={fieldError === "consentRequired"} aria-describedby={fieldError === "consentRequired" ? "newsletter-consent-error" : undefined} className="h-5 w-5 shrink-0 accent-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold" />
        <span className="min-w-0 [overflow-wrap:anywhere]">{t("consent")} <Link href="/datenschutz" className="text-gold underline underline-offset-2">{t("privacyLink")}</Link></span>
      </label>
      {fieldError === "consentRequired" && <p id="newsletter-consent-error" role="alert" className="text-xs leading-5 text-text-primary">{t(fieldError)}</p>}
      <button type="submit" disabled={busy} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-bg-primary hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-60">
        {busy ? <span aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-bg-primary/30 border-t-bg-primary" /> : <Send aria-hidden="true" size={15} className="shrink-0" />}
        {busy ? t("sending") : t(message?.ok === false ? "retry" : "submit")}
      </button>
      <p role={message?.ok === false ? "alert" : "status"} aria-atomic="true" className="text-xs leading-5 text-text-primary [overflow-wrap:anywhere]">{message?.text}</p>
    </form>
  </section>;
}
