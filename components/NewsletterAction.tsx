"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Mail, XCircle } from "lucide-react";
import { uiErrorMessage } from "@/lib/ui-error-message";

type Props = { mode: "confirm" | "unsubscribe"; token?: string; id?: string; proof?: string };

export function NewsletterAction({ mode, token, id, proof }: Props) {
  const t = useTranslations("NewsletterSignup");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const pending = useRef(false);
  const confirm = mode === "confirm";

  async function apply() {
    if (pending.current || result?.ok) return;
    pending.current = true;
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch(confirm ? "/api/newsletter/confirm" : "/api/newsletter/unsubscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirm ? { token } : { id, proof }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const errorKey = response.status === 400 ? (confirm ? "confirmInvalid" : "unsubscribeInvalid") : response.status === 429 ? "actionRateLimited" : "actionError";
        throw new Error(response.status === 400 && typeof body?.error === "string" ? body.error : t(errorKey));
      }
      if (typeof body?.message !== "string" || !body.message.trim() || body.error !== undefined) throw new Error(t("actionError"));
      setResult({ ok: true, text: body.message });
    } catch (error) {
      setResult({ ok: false, text: uiErrorMessage(error, t("actionError")) });
    } finally { pending.current = false; setBusy(false); }
  }

  const valid = confirm ? Boolean(token) : Boolean(id && proof);
  return <div className="mx-auto flex min-h-[55vh] w-full max-w-xl items-center px-4 py-12">
    <section aria-busy={busy} className="w-full min-w-0 rounded-2xl border border-border bg-bg-secondary p-6 sm:p-8">
      <div aria-hidden="true" className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold">{confirm ? <Mail size={19} /> : <XCircle size={19} />}</div>
      <h1 className="font-display text-2xl font-semibold text-text-primary [overflow-wrap:anywhere]">{t(confirm ? "confirmPageTitle" : "unsubscribePageTitle")}</h1>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{t(confirm ? "confirmPageIntro" : "unsubscribePageIntro")}</p>
      {!valid && <p role="alert" className="mt-5 text-sm text-text-primary">{t(confirm ? "confirmInvalid" : "unsubscribeInvalid")}</p>}
      {valid && !result?.ok && <button type="button" onClick={() => void apply()} disabled={busy} className="mt-6 inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg bg-gold px-5 py-2 text-left text-sm font-semibold text-bg-primary hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-60">
        {busy ? <span aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-bg-primary/30 border-t-bg-primary" /> : <Check aria-hidden="true" size={16} className="shrink-0" />}
        <span className="min-w-0 [overflow-wrap:anywhere]">{busy ? t("processing") : t(result?.ok === false ? "retry" : confirm ? "confirmButton" : "unsubscribeButton")}</span>
      </button>}
      <p role={result?.ok === false ? "alert" : "status"} aria-atomic="true" className="mt-5 text-sm leading-6 text-text-primary [overflow-wrap:anywhere]">{result?.text}</p>
    </section>
  </div>;
}
