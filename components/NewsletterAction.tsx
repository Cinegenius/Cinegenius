"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Mail, XCircle } from "lucide-react";

type Props = { mode: "confirm" | "unsubscribe"; token?: string; id?: string; proof?: string };

export function NewsletterAction({ mode, token, id, proof }: Props) {
  const t = useTranslations("NewsletterSignup");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const confirm = mode === "confirm";

  async function apply() {
    if (busy || result?.ok) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch(confirm ? "/api/newsletter/confirm" : "/api/newsletter/unsubscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirm ? { token } : { id, proof }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : t(confirm ? "confirmInvalid" : "unsubscribeInvalid"));
      setResult({ ok: true, text: typeof body.message === "string" ? body.message : t(confirm ? "confirmed" : "unsubscribed") });
    } catch (error) {
      setResult({ ok: false, text: error instanceof Error ? error.message : t(confirm ? "confirmInvalid" : "unsubscribeInvalid") });
    } finally { setBusy(false); }
  }

  const valid = confirm ? Boolean(token) : Boolean(id && proof);
  return <main className="mx-auto flex min-h-[55vh] w-full max-w-xl items-center px-4 py-12">
    <section className="w-full rounded-2xl border border-border bg-bg-secondary p-6 sm:p-8">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-lime/25 bg-lime/10 text-lime">{confirm ? <Mail size={19} /> : <XCircle size={19} />}</div>
      <h1 className="font-display text-2xl font-semibold text-text-primary">{t(confirm ? "confirmPageTitle" : "unsubscribePageTitle")}</h1>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{t(confirm ? "confirmPageIntro" : "unsubscribePageIntro")}</p>
      {!valid && <p role="alert" className="mt-5 text-sm text-crimson-light">{t(confirm ? "confirmInvalid" : "unsubscribeInvalid")}</p>}
      {valid && !result?.ok && <button type="button" onClick={() => void apply()} disabled={busy} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-lime px-5 text-sm font-semibold text-bg-primary disabled:opacity-60">
        {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-bg-primary/30 border-t-bg-primary" /> : <Check size={16} />}
        {busy ? t("processing") : t(confirm ? "confirmButton" : "unsubscribeButton")}
      </button>}
      {result && <p role={result.ok ? "status" : "alert"} className={`mt-5 text-sm leading-6 ${result.ok ? "text-success" : "text-crimson-light"}`}>{result.text}</p>}
    </section>
  </main>;
}
