"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ExternalLink, Mail, Send } from "lucide-react";

export function AdminNewsletter() {
  const t = useTranslations("AdminNewsletter");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function sendTest() {
    if (sending) return;
    setSending(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/newsletter/test", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : t("sendError"));
      const sentText = t("sent", { email: body.email });
      setResult({ ok: true, text: body.auditLogged === false ? `${sentText} ${t("auditIncomplete")}` : sentText });
    } catch (error) {
      setResult({ ok: false, text: error instanceof Error ? error.message : t("sendError") });
    } finally {
      setSending(false);
    }
  }

  return <div className="mx-auto w-full max-w-4xl space-y-5">
    <section className="rounded-xl border border-border bg-bg-secondary p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 text-gold"><Mail size={19} /></span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold text-text-primary">{t("title")}</h2>
          <p className="mt-1 text-sm leading-6 text-text-muted">{t("intro")}</p>
        </div>
      </div>
      <div className="mt-5 rounded-lg border border-gold/25 bg-gold/5 px-4 py-3 text-sm leading-6 text-text-secondary">
        <strong className="text-gold">{t("audienceTitle")}</strong> {t("audienceNotice")}
      </div>
    </section>

    <section className="overflow-hidden rounded-xl border border-border bg-bg-secondary">
      <div className="border-b border-border px-5 py-4 sm:px-7">
        <h3 className="text-sm font-semibold text-text-primary">{t("previewTitle")}</h3>
      </div>
      <div className="bg-[#0a0a0a] p-4 sm:p-8">
        <article className="mx-auto max-w-[580px] overflow-hidden rounded-xl border border-[#262626] bg-[#111]">
          <header className="border-b border-[#262626] px-6 py-5"><span className="text-xl font-bold tracking-tight text-[#d4a843]">{t("brand")}</span></header>
          <div className="space-y-3 px-6 py-6 sm:px-8 sm:py-8">
            <p className="text-xl font-bold text-[#f0f0f0]">{t("subject")}</p>
            <p className="text-sm leading-6 text-[#aaa]">{t("greeting")}</p>
            <p className="text-sm leading-6 text-[#aaa]">{t("community")}</p>
            <p className="text-sm leading-6 text-[#aaa]">{t("offers")}</p>
            <p className="text-sm leading-6 text-[#aaa]">{t("feedback")}</p>
            <a href="https://www.cinegenius.co/" className="inline-flex min-h-11 items-center rounded-lg bg-[#d4a843] px-5 text-sm font-semibold text-[#0a0a0a]">{t("visitCta")}</a>
            <p className="pt-2 text-sm leading-6 text-[#aaa]">{t("recommend")}</p>
            <a href="https://www.instagram.com/cinegenius.co?mdxt=MXZvaG40YWprY2R1bw%3D%3D&utm_source=qr" className="inline-flex items-center gap-2 text-sm font-medium text-[#d4a843]"><ExternalLink size={16} /> {t("instagramCta")}</a>
            <p className="pt-2 text-sm leading-6 text-[#aaa]">{t("closing")}</p>
            <p className="text-sm font-medium text-[#f0f0f0]">{t("signature")}</p>
          </div>
          <footer className="border-t border-[#262626] px-6 py-4 text-xs leading-5 text-[#777]">{t("emailFooter")}</footer>
        </article>
      </div>
      <div className="space-y-3 p-5 sm:p-7">
        <button onClick={() => void sendTest()} disabled={sending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-lime px-5 py-2.5 text-sm font-semibold text-bg-primary disabled:cursor-wait disabled:opacity-60">
          {sending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-bg-primary/30 border-t-bg-primary" /> : <Send size={16} />}
          {sending ? t("sending") : t("sendTest")}
        </button>
        {result && <p role={result.ok ? "status" : "alert"} className={`flex items-start gap-2 text-sm ${result.ok ? "text-success" : "text-crimson-light"}`}>{result.ok && <Check size={16} className="mt-0.5 shrink-0" />}{result.text}</p>}
        <p className="text-xs leading-5 text-text-muted">{t("testOnlyNote")}</p>
      </div>
    </section>
  </div>;
}
