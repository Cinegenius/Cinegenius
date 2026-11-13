"use client";
import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Briefcase, Calendar, MapPin, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import ContextBackLink from "@/components/ContextBackLink";
import FavoriteButton from "@/components/FavoriteButton";
import ReportButton from "@/components/ReportButton";
import FormDraftStatus from "@/components/FormDraftStatus";
import { useFormDraft } from "@/lib/use-form-draft";
import { jobFacts, jobRateLabel, jobDateLabel, canonicalJobPayType, type BrowseJob } from "@/lib/job-metadata";
import { projectTypeLabel } from "@/lib/project-type-labels";
import { taxonomyLabel } from "@/lib/departments";
import { uiErrorMessage } from "@/lib/ui-error-message";

function JobApplication({ job, userId }: { job: BrowseJob; userId: string }) {
  const ui = useTranslations(), t = useTranslations("JobsRefresh");
  const [message, setMessage] = useState(""), [portfolio, setPortfolio] = useState(""), [dayRate, setDayRate] = useState("");
  const [posting, setPosting] = useState(false);
  const [submitting, setSubmitting] = useState(false), [submitted, setSubmitted] = useState(false), [error, setError] = useState("");
  const pending = useRef(false), active = useRef(true);
  useLayoutEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const draft = useFormDraft({ formKey: `application:${job.id}`, value: { message, portfolio, dayRate }, enabled: !submitted, busy: posting,
    restore: saved => { if (typeof saved.message === "string") setMessage(saved.message); if (typeof saved.portfolio === "string") setPortfolio(saved.portfolio); if (typeof saved.dayRate === "string") setDayRate(saved.dayRate); },
  });
  const handleApply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.loaded || pending.current || !message.trim()) return;
    pending.current = true; setSubmitting(true); setError("");
    try {
      if (!await draft.flush()) throw new Error(ui("MessagingBackend.saveError"));
      if (!active.current) return;
      setPosting(true);
      const response = await fetch("/api/applications", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(25000),
        body: JSON.stringify({ jobId: job.id, message: message.trim(), portfolioUrl: portfolio.trim(), dayRate: (!pay || pay === "Paid" || pay === "Deferred") ? dayRate.trim() : "", accountId: userId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? ui("System.requestFailed"));
      if (!active.current) return;
      await draft.complete();
      if (active.current) setSubmitted(true);
    } catch (failure) { if (active.current) setError(uiErrorMessage(failure, ui("System.requestFailed"))); }
    finally { pending.current = false; if (active.current) { setSubmitting(false); setPosting(false); } }
  };
  if (submitted) return <div role="status" className="space-y-3 py-3"><CheckCircle size={28} className="text-gold" /><h2 className="text-lg font-semibold">{ui("Ui.text_a9b52d46fb42d8")}</h2><p className="text-sm text-text-secondary">{t("applicationSent")}</p><Link className="inline-flex min-h-11 items-center text-sm text-gold" href="/dashboard?tab=applications">{t("myApplications")} →</Link></div>;
  const pay = canonicalJobPayType(jobFacts(job).payType);
  return <form onSubmit={handleApply} className="space-y-4">
    <div><h2 className="text-xl font-semibold">{t("apply")}</h2><p className="mt-2 text-sm text-text-secondary">{t("applyHint")}</p></div>
    <FormDraftStatus draft={draft} />
    <fieldset disabled={!draft.loaded || submitting} className="space-y-4 disabled:opacity-60">
      <label htmlFor="job-message" className="block text-sm text-text-secondary">{ui("Ui.text_cc108e93420d0d")}<textarea id="job-message" required maxLength={5000} rows={6} value={message} onChange={event => setMessage(event.target.value)} className="mt-2 block w-full resize-y rounded-xl border border-border bg-bg-elevated px-3 py-3 text-base text-text-primary outline-none focus:border-gold" /></label>
      <label htmlFor="job-portfolio" className="block text-sm text-text-secondary">{ui("Ui.text_8d7b6aaa002591")}<input id="job-portfolio" type="url" maxLength={2000} value={portfolio} onChange={event => setPortfolio(event.target.value)} autoComplete="url" placeholder={ui("Ui.text_1981d29fbbd386")} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-bg-elevated px-3 text-base text-text-primary outline-none focus:border-gold" /></label>
      {(!pay || pay === "Paid" || pay === "Deferred") && <label htmlFor="job-rate" className="block text-sm text-text-secondary">{ui("Ui.text_35d10be835695b")}<input id="job-rate" maxLength={100} value={dayRate} onChange={event => setDayRate(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-bg-elevated px-3 text-base text-text-primary outline-none focus:border-gold" /></label>}
      {error && <p role="alert" className="text-sm text-crimson-light">{error}</p>}
      <button type="submit" disabled={!message.trim()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-bg-primary disabled:opacity-50">{submitting && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}{ui("Ui.text_329d7a850baa31")}</button>
    </fieldset>
  </form>;
}

export default function JobDetail({ job, preview = false }: { job: BrowseJob; preview?: boolean }) {
  const ui = useTranslations(), t = useTranslations("JobsRefresh"), locale = useLocale();
  const { userId, isLoaded } = useAuth(), facts = jobFacts(job), dates = jobDateLabel(job, locale);
  const own = !!userId && userId === job.ownerId;
  const employment = facts.jobType ? ui(`jobs.${({ freelance: "filterFreelance", festanstellung: "filterFulltime", praktikum: "filterInternship" })[facts.jobType]}`) : "";
  return <main className="min-h-screen bg-bg-primary mobile-bottom-nav-clear">
    <div className="site-container py-6 sm:py-8">
      <ContextBackLink href="/jobs" className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-text-secondary hover:text-gold"><ArrowLeft size={16} aria-hidden="true" />{t("back")}</ContextBackLink>
      {preview && <div className="mb-5 rounded-xl border border-border bg-bg-secondary p-4"><p className="font-semibold text-gold">{ui("Ui.text_905c2a0a517109")}</p><p className="mt-1 text-sm text-text-secondary">{ui("Ui.text_7b1849380ac701")}</p></div>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-10">
        <article className="min-w-0">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="mb-2 text-sm text-text-muted">{[facts.company, facts.projectType && projectTypeLabel(facts.projectType, ui)].filter(Boolean).join(" · ")}</p><h1 className="break-words font-serif text-3xl leading-tight text-text-primary sm:text-4xl">{job.title}</h1></div>{!preview && <div className="flex shrink-0 [&_button]:min-h-11 [&_button]:min-w-11"><FavoriteButton className="min-h-11 min-w-11" listingId={job.id} listingType="job" listingTitle={job.title} listingCity={job.location} /><ReportButton listingId={job.id} /></div>}</div>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm text-text-secondary">{job.location && <span className="inline-flex items-center gap-2"><MapPin size={16} aria-hidden="true" className="shrink-0 text-text-muted" />{job.location}</span>}{dates && <span className="inline-flex items-center gap-2"><Calendar size={16} aria-hidden="true" className="shrink-0 text-text-muted" />{dates}</span>}{employment && <span className="inline-flex items-center gap-2"><Briefcase size={16} aria-hidden="true" />{employment}</span>}</div>
          <div className="my-6 flex flex-wrap items-center justify-between gap-3 border-y border-border py-4"><div><p className="text-xs text-text-muted">{ui("jobs.filterPay")}</p><p className="mt-1 text-lg font-semibold text-gold">{jobRateLabel(job, ui, locale)}</p></div>{facts.urgent && <span className="text-sm text-text-secondary">{ui("jobs.urgentBadge")}</span>}</div>
          {!preview && !own && <a href="#job-application" className="mb-6 inline-flex min-h-11 items-center rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary xl:hidden">{t("apply")}</a>}
          {facts.contentWarnings.length > 0 && <div className="mb-6 flex items-start gap-3 rounded-xl border border-border bg-bg-secondary p-4 text-sm"><AlertTriangle size={18} aria-hidden="true" className="shrink-0 text-text-muted" /><div><p className="font-medium">{ui("Ui.text_2fe8436ee7e437")}</p><p className="mt-1 text-text-secondary">{facts.contentWarnings.map(value => taxonomyLabel(value, ui)).join(" · ")}</p></div></div>}
          <h2 className="mb-3 text-lg font-semibold">{ui("Ui.text_19b271fac2256e")}</h2><p className="whitespace-pre-line break-words text-sm leading-7 text-text-secondary sm:text-base">{facts.description || t("noDescription")}</p>
          {job.createdAt && Number.isFinite(Date.parse(job.createdAt)) && <p className="mt-6 text-xs text-text-muted">{t("published", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(job.createdAt)) })}</p>}
        </article>
        <aside id="job-application" className="min-w-0 scroll-mt-28"><div className="browse-card p-4 sm:p-5 xl:sticky xl:top-24">
          {preview || own ? <div><h2 className="text-lg font-semibold">{t("manage")}</h2><p className="mt-2 text-sm text-text-secondary">{preview ? ui("Ui.text_b789cf5ed9d616") : ui("Ui.text_0ea95e09f3281d")}</p><Link href={`/dashboard?tab=listings&editListing=${job.id}`} className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm text-gold">{t("edit")}</Link></div>
            : !isLoaded ? <p role="status" className="text-sm text-text-secondary">{ui("common.loading")}</p>
            : !userId ? <div><h2 className="text-lg font-semibold">{t("apply")}</h2><p className="mt-2 text-sm text-text-secondary">{ui("Ui.text_30b81ea8840c95")}</p><Link href={`/sign-in?redirect_url=${encodeURIComponent(`/jobs/${job.id}#job-application`)}`} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary">{ui("nav.signIn")}</Link></div>
            : <JobApplication key={`${userId}:${job.id}`} job={job} userId={userId} />}
        </div></aside>
      </div>
    </div>
  </main>;
}
