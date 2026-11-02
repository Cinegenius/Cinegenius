"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ExternalLink, Mail, Send } from "lucide-react";

type Copy = { subject: string; heading: string; body: string; ctaLabel: string; ctaUrl: string; recommend: string; instagramLabel: string; instagramUrl: string; signature: string };

export function AdminNewsletter() {
  const t = useTranslations("AdminNewsletter");
  const [copy, setCopy] = useState<Copy>({ subject: t("subject"), heading: t("heading"), body: t("body"), ctaLabel: t("ctaLabel"), ctaUrl: t("ctaUrl"), recommend: t("recommend"), instagramLabel: t("instagramCta"), instagramUrl: "https://www.instagram.com/cinegenius.co?mdxt=MXZvaG40YWprY2R1bw%3D%3D&utm_source=qr", signature: t("signature") });
  const [audience, setAudience] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const bodyParagraphs = useMemo(() => copy.body.split(/\r?\n/).filter(Boolean), [copy.body]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/newsletter/audience", { cache: "no-store" }).then(async response => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(t("audienceUnavailable"));
      if (active) setAudience(Number(payload.confirmedCount) || 0);
    }).catch(() => { if (active) setAudience(null); });
    return () => { active = false; };
  }, [t]);

  function update(field: keyof Copy, value: string) { setCopy(current => ({ ...current, [field]: value })); }

  async function sendTest() {
    if (busy) return;
    setBusy(true); setResult(null);
    try {
      const response = await fetch("/api/admin/newsletter/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(copy) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : t("sendError"));
      setResult({ ok: true, text: t("sent", { email: payload.email }) });
    } catch (error) { setResult({ ok: false, text: error instanceof Error ? error.message : t("sendError") }); }
    finally { setBusy(false); }
  }

  async function sendCampaign() {
    if (busy || !audience || audience > 500) return;
    setBusy(true); setResult(null);
    const id = campaignId ?? crypto.randomUUID();
    setCampaignId(id);
    try {
      const response = await fetch("/api/admin/newsletter/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId: id, copy }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : t("campaignError"));
      const count = Number(payload.sentCount) || 0;
      setResult({ ok: true, text: payload.complete ? t("campaignSent", { count: Number(payload.totalSent) || count }) : t("campaignPartialResult", { count }) });
      if (payload.complete) setCampaignId(null);
    } catch (error) { setResult({ ok: false, text: error instanceof Error ? error.message : t("campaignError") }); }
    finally { setBusy(false); setConfirmSend(false); }
  }

  const inputClass = "mt-1 min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-lime";
  return <div className="mx-auto w-full max-w-4xl space-y-5">
    <section className="rounded-xl border border-border bg-bg-secondary p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-lime/30 bg-lime/10 text-lime"><Mail size={19} /></span>
        <div className="min-w-0"><h2 className="font-display text-xl font-semibold text-text-primary">{t("title")}</h2><p className="mt-1 text-sm leading-6 text-text-muted">{t("intro")}</p></div>
      </div>
      <div className="mt-5 rounded-lg border border-lime/25 bg-lime/5 px-4 py-3 text-sm leading-6 text-text-secondary"><strong className="text-lime">{t("audienceTitle")}</strong> {audience === null ? t("audienceLoading") : t("confirmedAudience", { count: audience })} {t("audienceNotice")}</div>
    </section>

    <section className="overflow-hidden rounded-xl border border-border bg-bg-secondary">
      <div className="border-b border-border px-5 py-4 sm:px-7"><h3 className="text-sm font-semibold text-text-primary">{t("editorTitle")}</h3></div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
        <label className="text-sm text-text-secondary">{t("subjectLabel")}<input className={inputClass} maxLength={140} value={copy.subject} onChange={e => update("subject", e.target.value)} /></label>
        <label className="text-sm text-text-secondary">{t("headingLabel")}<input className={inputClass} maxLength={180} value={copy.heading} onChange={e => update("heading", e.target.value)} /></label>
        <label className="text-sm text-text-secondary sm:col-span-2">{t("bodyLabel")}<textarea className={`${inputClass} min-h-36`} maxLength={6000} value={copy.body} onChange={e => update("body", e.target.value)} /><span className="mt-1 block text-xs text-text-muted">{t("bodyHelp")}</span></label>
        <label className="text-sm text-text-secondary">{t("ctaLabelField")}<input className={inputClass} maxLength={80} value={copy.ctaLabel} onChange={e => update("ctaLabel", e.target.value)} /></label>
        <label className="text-sm text-text-secondary">{t("ctaUrlField")}<input className={inputClass} type="url" maxLength={2000} value={copy.ctaUrl} onChange={e => update("ctaUrl", e.target.value)} /></label>
        <label className="text-sm text-text-secondary">{t("recommendLabel")}<input className={inputClass} maxLength={300} value={copy.recommend} onChange={e => update("recommend", e.target.value)} /></label>
        <label className="text-sm text-text-secondary">{t("instagramLabelField")}<input className={inputClass} maxLength={120} value={copy.instagramLabel} onChange={e => update("instagramLabel", e.target.value)} /></label>
        <label className="text-sm text-text-secondary">{t("instagramUrlField")}<input className={inputClass} type="url" maxLength={2000} value={copy.instagramUrl} onChange={e => update("instagramUrl", e.target.value)} /></label>
        <label className="text-sm text-text-secondary">{t("signatureLabel")}<input className={inputClass} maxLength={120} value={copy.signature} onChange={e => update("signature", e.target.value)} /></label>
      </div>
      <div className="border-y border-border px-5 py-4 sm:px-7"><h3 className="text-sm font-semibold text-text-primary">{t("previewTitle")}</h3></div>
      <div className="bg-[#0e1016] p-4 sm:p-8">
        <article className="mx-auto max-w-[600px] overflow-hidden rounded-xl border border-[#29344a] bg-[#171b24]">
          <header className="border-b border-[#29344a] px-6 py-5"><span className="text-xl font-bold tracking-tight text-[#f4f5f7]"><span className="text-[#c2f135]">›</span> {t("brandName")}</span></header>
          <div className="space-y-4 px-6 py-6 sm:px-8 sm:py-8"><h4 className="text-xl font-bold leading-7 text-[#f4f5f7]">{copy.heading || t("previewHeadingFallback")}</h4>
            {bodyParagraphs.map((paragraph, index) => <p key={index} className="text-sm leading-6 text-[#a7afbf]">{paragraph}</p>)}
            <a href={copy.ctaUrl || "#"} onClick={event => event.preventDefault()} className="inline-flex min-h-11 items-center rounded-lg bg-[#c2f135] px-5 text-sm font-semibold text-[#10131b]">{copy.ctaLabel || t("ctaLabel")}</a>
            <div className="flex flex-wrap gap-4 text-sm"><span className="text-[#a7afbf]">{copy.recommend}</span><a href={copy.instagramUrl} onClick={event => event.preventDefault()} className="inline-flex items-center gap-2 font-medium text-[#c2f135]"><ExternalLink size={15} />{copy.instagramLabel}</a></div>
            <p className="text-sm font-medium text-[#f4f5f7]">{copy.signature}</p>
          </div>
          <footer className="border-t border-[#29344a] px-6 py-4 text-xs leading-5 text-[#7e899d]">{t("unsubscribePreview")}</footer>
        </article>
      </div>
      <div className="space-y-4 p-5 sm:p-7">
        <div className="flex flex-wrap gap-3">
          <button onClick={() => void sendTest()} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-text-primary disabled:opacity-60">{busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" /> : <Send size={16} />}{busy ? t("sending") : t("sendTest")}</button>
          <button onClick={() => { setConfirmSend(value => !value); setResult(null); }} disabled={busy || !audience || audience === 0 || audience > 500} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-lime px-5 py-2.5 text-sm font-semibold text-bg-primary disabled:opacity-50"><Mail size={16} />{t("prepareCampaign")}</button>
        </div>
        {confirmSend && <div className="space-y-3 rounded-lg border border-lime/30 bg-bg-primary p-4">
          <p className="text-sm leading-6 text-text-secondary">{t("confirmCampaign", { count: audience ?? 0 })}</p>
          <p className="text-xs leading-5 text-text-muted">{t("campaignLimit")}</p>
          <div className="flex flex-wrap gap-3"><button onClick={() => void sendCampaign()} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-lime px-5 text-sm font-semibold text-bg-primary disabled:opacity-60">{busy ? t("sending") : t("sendCampaign", { count: audience ?? 0 })}</button><button onClick={() => setConfirmSend(false)} disabled={busy} className="min-h-11 rounded-lg border border-border px-4 text-sm text-text-secondary">{t("cancel")}</button></div>
        </div>}
        {result && <p role={result.ok ? "status" : "alert"} className={`flex items-start gap-2 text-sm ${result.ok ? "text-success" : "text-crimson-light"}`}>{result.ok && <Check size={16} className="mt-0.5 shrink-0" />}{result.text}</p>}
        <p className="text-xs leading-5 text-text-muted">{t("testOnlyNote")}</p>
      </div>
    </section>
  </div>;
}
