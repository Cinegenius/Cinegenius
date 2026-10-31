"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { ArrowLeft, Check, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import MarketplaceOfferSummary from "@/components/MarketplaceOfferSummary";
import ListingPhotoGallery from "@/components/ListingPhotoGallery";
import { SupportMessageAction } from "@/components/admin/SupportMessageAction";
import OfferModerationStatus from "@/components/OfferModerationStatus";
import { adminReviewReason, type AdminReview } from "@/lib/admin-review";

export default function AdminReviewDetail({ review }: { review: AdminReview }) {
  const t = useTranslations("AdminReview");
  const m = useTranslations("OfferModeration");
  const [action, setAction] = useState("approve");
  const r = useTranslations("responsiblePerson");
  const format = useFormatter();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const lock = useRef(false);
  const reasonInput = useRef<HTMLTextAreaElement>(null);
  const fieldLabel = (key: string) => t.has("fields." + key) ? t("fields." + key) : key;
  function value(item: unknown, depth = 0): React.ReactNode {
    if (item === null || item === undefined || item === "") return "—";
    if (typeof item === "boolean") return t(item ? "yes" : "no");
    if (typeof item === "number") return format.number(item);
    if (Array.isArray(item)) return <ul className="list-inside list-disc space-y-1">{item.map((entry, index) => <li key={index}>{value(entry, depth + 1)}</li>)}</ul>;
    if (typeof item === "object") return depth > 4 ? <pre className="whitespace-pre-wrap break-words">{JSON.stringify(item, null, 2)}</pre> : <dl className="space-y-2">{Object.entries(item).map(([key, entry]) => <div key={key}><dt className="text-xs text-text-muted">{fieldLabel(key)}</dt><dd>{value(entry, depth + 1)}</dd></div>)}</dl>;
    return String(item);
  }
  async function transition() {
    if (lock.current) return;
    const decision = review.kind === "company" ? "approve" : action;
    if (!adminReviewReason(decision, reason, t("approvalReasonDefault"))) { setError(t("reasonError")); reasonInput.current?.focus(); return; }
    if (!acknowledged) { setError(t("reviewRequired")); return; }
    lock.current = true; setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/admin/reviews/${review.kind}/${encodeURIComponent(review.id)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: review.revision, action: decision, reason }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || t("saveError"));
      const warnings = Array.isArray(result.warnings) ? result.warnings.filter((issue: unknown): issue is string => typeof issue === "string" && t.has("issues." + issue)) : [];
      setSuccess(m("decisionSaved") + (warnings.length ? " " + t("approvedWithWarnings", { details: warnings.map((issue: string) => t("issues." + issue)).join("; ") }) : "") + (result.cacheRefreshed === false ? " " + t("cacheWarning") : ""));
      setAcknowledged(false); setReason(""); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("saveError")); }
    finally { lock.current = false; setSaving(false); }
  }
  const back = () => {
    const previous = window.history.state?.cinegeniusView?.from;
    if (typeof previous === "string" && previous.startsWith("/admin")) router.back();
    else if (document.referrer && new URL(document.referrer).origin === window.location.origin && new URL(document.referrer).pathname === "/admin") router.back();
    else router.push("/admin");
  };
  return <main className="site-container min-w-0 pt-24 pb-28 sm:pt-28">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={back} className="inline-flex min-h-11 items-center gap-2 text-sm text-text-secondary hover:text-gold"><ArrowLeft size={16} />{t("back")}</button><button type="button" onClick={() => { setAcknowledged(false); router.refresh(); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-text-secondary"><RefreshCw size={14} />{t("reload")}</button></div>
    <div className="mb-6 rounded-xl border border-gold/30 bg-bg-secondary p-4 text-sm leading-6 text-text-secondary"><p className="flex items-center gap-2 font-semibold text-gold"><ShieldCheck size={17} />{t("protected")}</p><p className="mt-1">{t("notice")}</p></div>
    <header className="mb-6 min-w-0"><p className="text-sm text-gold">{t("types." + review.kind)}</p><h1 className="mt-2 break-words font-display text-3xl text-text-primary [overflow-wrap:anywhere] sm:text-4xl">{review.title || t("untitled")}</h1><div className="mt-3 text-sm text-text-muted">{review.moderation ? <OfferModerationStatus item={{ moderation_status: review.moderation.status, moderation_reason: review.moderation.reason }} /> : t(review.published === true ? "published" : review.published === false ? "draft" : "profileVisibility")}</div></header>
    {review.images.length ? <ListingPhotoGallery images={review.images.map(image => image.src)} title={review.title || t("untitled")} label={t("photos")} priority={false} /> : <p className="rounded-xl border border-border bg-bg-secondary p-6 text-text-muted">{t("noPhotos")}</p>}
    <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <MarketplaceOfferSummary category={String(review.fields.find(field=>field.key==="category")?.value??"")} price={Number(review.fields.find(field=>field.key==="price")?.value??0)} metadata={review.fields.find(field=>field.key==="details")?.value} />
      <section className="min-w-0 rounded-xl border border-border bg-bg-secondary p-4 sm:p-6" aria-labelledby="review-details"><h2 id="review-details" className="mb-5 font-display text-2xl text-text-primary">{t("details")}</h2><dl className="space-y-5">{review.fields.map(field => <div key={field.key} className="min-w-0 border-b border-border pb-4 last:border-0 last:pb-0"><dt className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold">{fieldLabel(field.key)}</dt><dd className="whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary [overflow-wrap:anywhere]">{value(field.value)}</dd></div>)}</dl></section>
      <aside className="min-w-0 space-y-5">
        <section className="rounded-xl border border-border bg-bg-secondary p-4 sm:p-6"><h2 className="mb-4 font-display text-xl text-text-primary">{t("provider")}</h2><p className="break-words text-sm text-text-primary">{review.provider.name || t("unassigned")}</p>{review.provider.userId && <p className="mt-2 break-all font-mono text-xs text-text-muted">{review.provider.userId}</p>}<div className="mt-4 flex flex-wrap gap-3">{review.provider.companyHref && <Link prefetch={false} href={review.provider.companyHref} className="inline-flex min-h-11 items-center text-sm text-gold">{t("reviewCompany")}</Link>}{review.provider.href && <Link prefetch={false} href={review.provider.href} className="inline-flex min-h-11 items-center text-sm text-gold">{t("reviewPerson")}</Link>}</div>
          {review.responsible && <div className="mt-4 border-t border-border pt-4"><h3 className="text-xs font-semibold text-gold">{t("responsible")}</h3><p className="mt-2 break-words text-sm text-text-primary">{review.responsible.name}</p>{review.responsible.function && <p className="mt-1 text-sm text-text-secondary">{r.has("functions." + review.responsible.function) ? r("functions." + review.responsible.function) : review.responsible.function}</p>}<p className="mt-2 break-all font-mono text-xs text-text-muted">{review.responsible.userId}</p><p className="mt-2 text-xs text-text-muted">{t(review.responsible.public ? "contactPublic" : "contactPrivate")}</p></div>}
          {review.technicalCreator && <p className="mt-4 break-all border-t border-border pt-4 text-xs text-text-muted">{t("creator")}: {review.technicalCreator}</p>}
        </section>
        <section className="rounded-xl border border-border bg-bg-secondary p-4 text-sm text-text-secondary"><h2 className="mb-3 font-semibold text-text-primary">{t("status")}</h2><dl className="space-y-2"><div><dt className="text-text-muted">{t("created")}</dt><dd>{review.createdAt ? format.dateTime(new Date(review.createdAt), { dateStyle: "medium", timeStyle: "short" }) : "—"}</dd></div><div><dt className="text-text-muted">{t("updated")}</dt><dd>{review.updatedAt ? format.dateTime(new Date(review.updatedAt), { dateStyle: "medium", timeStyle: "short" }) : "—"}</dd></div></dl><p className="mt-3 break-all font-mono text-[10px]">{t("version")}: {review.revision.slice(0, 12)}</p>{review.published && review.publicHref && <a href={review.publicHref} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center text-gold">{t("publicView")}</a>}</section>
      </aside>
    </div>
    <section className="mt-6 rounded-xl border border-border bg-bg-secondary p-4 sm:p-6" aria-labelledby="review-actions"><h2 id="review-actions" className="font-display text-2xl text-text-primary">{t("actions")}</h2>
      {review.issues.length > 0 && <div className="mt-4 rounded-lg border border-gold/30 p-4"><p className="font-semibold text-gold">{t("missing")}</p><p className="mt-2 text-sm leading-6 text-text-secondary">{t("qualityNotice")}</p><ul className="mt-2 list-inside list-disc space-y-1 text-sm text-text-secondary">{review.issues.map(issue => <li key={issue}>{t("issues." + issue)}</li>)}</ul></div>}
      {review.blockingIssues.length > 0 && <div role="alert" className="mt-4 rounded-lg border border-crimson/30 p-4"><p className="font-semibold text-crimson-light">{t("blocked")}</p><ul className="mt-2 list-inside list-disc space-y-1 text-sm text-text-secondary">{review.blockingIssues.map(issue => <li key={issue}>{t("issues." + issue)}</li>)}</ul></div>}
      {review.support && <div className="mt-4"><SupportMessageAction targetType={review.support.type} targetId={review.support.id} label={t("requestCorrection")} /><p className="mt-2 text-xs leading-5 text-text-muted">{t("supportNotice")}</p></div>}
      {review.moderation ? <div className="mt-5 border-t border-border pt-5"><label className="block text-sm text-text-primary" htmlFor="review-reason">{t(action === "approve" ? "reasonOptional" : "reason")}</label><p id="review-reason-help" className="mt-1 text-xs leading-5 text-text-muted">{t("reasonHelp")}</p><textarea ref={reasonInput} id="review-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={3} disabled={saving} aria-describedby="review-reason-help" className="mt-2 w-full rounded-lg border border-border bg-bg-primary p-3 text-sm text-text-primary" /><label className="mt-3 block text-sm text-text-secondary">{m("statusLabel")}<select value={action} onChange={event => setAction(event.target.value)} disabled={saving} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-bg-primary p-3">{["approve", "changes_requested", "reject", "hide"].map(key => <option key={key} value={key}>{m(key === "changes_requested" ? "requestChanges" : key)}</option>)}</select></label><p id="review-effect" className="mt-2 text-sm leading-6 text-text-muted">{action === "approve" ? t(review.moderation.status === "draft" ? "draftPublishEffect" : "publishEffect") : action === "hide" ? t("hideEffect") : t("privateDecisionEffect")}</p><label className="mt-4 flex min-h-11 items-start gap-3 text-sm leading-6 text-text-secondary"><input type="checkbox" checked={acknowledged} disabled={saving} onChange={event => setAcknowledged(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-gold" />{t("acknowledge")}</label><button type="button" disabled={saving || !acknowledged || (action === "approve" && !review.canPublish)} onClick={() => void transition()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-gold px-5 py-3 text-sm font-semibold text-bg-primary disabled:cursor-not-allowed disabled:opacity-40">{saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{saving ? t("saving") : m(action === "changes_requested" ? "requestChanges" : action)}</button></div>  : review.kind === "company" && review.published === false ? <div className="mt-5 border-t border-border pt-5"><p className="text-sm leading-6 text-text-muted">{t("companyPublishEffect")}</p><label className="mt-4 flex min-h-11 items-start gap-3 text-sm leading-6 text-text-secondary"><input type="checkbox" checked={acknowledged} disabled={saving} onChange={event => setAcknowledged(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-gold" />{t("acknowledge")}</label><button type="button" disabled={saving || !acknowledged || !review.canPublish} onClick={() => void transition()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-gold px-5 py-3 text-sm font-semibold text-bg-primary disabled:cursor-not-allowed disabled:opacity-40">{saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{saving ? t("saving") : m("approve")}</button></div> : <p className="mt-5 text-sm leading-6 text-text-muted">{t("existingRules")}</p>}
      {review.moderation && <div className="mt-6 border-t border-border pt-5"><h3 className="mb-3 font-semibold">{m("history")}</h3>{review.moderation.events.length ? <ol className="space-y-3">{review.moderation.events.map((event, index) => <li key={index} className="min-w-0 rounded-lg border border-border p-3 text-sm"><p>{m("statuses." + event.status)} · {m("revision", { revision: event.revision })}</p><p className="mt-1 break-words text-xs text-text-muted">{format.dateTime(new Date(event.at), { dateStyle: "medium", timeStyle: "short" })} · {event.actor || "—"}</p>{event.reason && <p className="mt-2 whitespace-pre-wrap break-words text-text-secondary">{event.reason}</p>}</li>)}</ol> : <p className="text-sm text-gold">{m("noEvidence")}</p>}</div>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-crimson/30 p-4 text-sm text-crimson-light">{error}</p>}{success && <p role="status" className="mt-4 rounded-lg border border-success/30 p-4 text-sm text-success">{success}</p>}
    </section>
  </main>;
}
