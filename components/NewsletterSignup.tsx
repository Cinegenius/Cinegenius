"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Mail, Send } from "lucide-react";

export function NewsletterSignup() {
  const t = useTranslations("NewsletterSignup");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : t("submitError"));
      setMessage({ ok: true, text: typeof result.message === "string" ? result.message : t("genericResponse") });
      setEmail("");
      setConsent(false);
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : t("submitError") });
    } finally { setBusy(false); }
  }

  return <section aria-labelledby="newsletter-signup-title" className="mt-5 max-w-sm rounded-xl border border-border bg-bg-primary/50 p-4">
    <div className="flex items-center gap-2 text-text-primary"><Mail size={16} className="text-lime" /><h4 id="newsletter-signup-title" className="text-sm font-semibold">{t("title")}</h4></div>
    <p className="mt-1 text-xs leading-5 text-text-muted">{t("intro")}</p>
    <form onSubmit={submit} className="mt-3 space-y-3">
      <label className="sr-only" htmlFor="newsletter-email">{t("emailLabel")}</label>
      <input id="newsletter-email" type="email" required autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder={t("emailPlaceholder")} className="min-h-10 w-full rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-lime" />
      <label className="flex items-start gap-2 text-xs leading-5 text-text-secondary">
        <input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1 accent-lime" />
        <span>{t("consent")} <Link href="/datenschutz" className="text-lime underline underline-offset-2">{t("privacyLink")}</Link></span>
      </label>
      <button type="submit" disabled={busy || !consent} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-lime px-4 text-sm font-semibold text-bg-primary disabled:opacity-60">
        {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-bg-primary/30 border-t-bg-primary" /> : <Send size={15} />}
        {busy ? t("sending") : t("submit")}
      </button>
      {message && <p role={message.ok ? "status" : "alert"} className={`text-xs leading-5 ${message.ok ? "text-success" : "text-crimson-light"}`}>{message.text}</p>}
    </form>
  </section>;
}
