"use client";
import { projectTypeLabel } from "@/lib/project-type-labels";
import { jobPayLabel } from "@/lib/job-metadata";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ContextBackLink from "@/components/ContextBackLink";
import { ArrowLeft, MapPin, Clock, Briefcase, CheckCircle, Users, Calendar, Shield, AlertTriangle, DollarSign } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";
import ReportButton from "@/components/ReportButton";
import { useTranslations } from "next-intl";
import { uiErrorMessage } from "@/lib/ui-error-message";


type Job = {
  id: string;
  title: string;
  company: string;
  projectType: string;
  location: string;
  rate: string;
  union: string;
  shootDates: string;
  urgent: boolean;
  tags: string[];
  posted: string;
  description?: string;
  payType?: string;
  contentWarnings?: string[];
  ownerId?: string;
  ownerName?: string;
};

export default function JobDetail({ job, preview = false }: { job: Job; preview?: boolean }) {
  const uiText = useTranslations();

  const { userId } = useAuth();
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [message, setMessage] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [dayRate, setDayRate] = useState("");

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || preview) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          jobTitle: job.title,
          ownerId: job.ownerId ?? "static",
          message,
          portfolioUrl: portfolio,
          dayRate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? uiText("Ui.text_f6cc01cb7edbf0"));
      setSubmitted(true);
    } catch (err) {
      setSubmitError(uiErrorMessage(err, uiText("Ui.text_33339d52add710")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ContextBackLink href="/jobs" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-gold transition-colors mb-6">{uiText.rich("Ui.text_244f5e666b2b6d", { part1: () => (<ArrowLeft size={14} />) })}</ContextBackLink>

        {preview && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gold">{uiText("Ui.text_905c2a0a517109")}</p>
              <p className="text-xs text-text-muted mt-0.5">{uiText("Ui.text_7b1849380ac701")}</p>
            </div>
            <Link href="/dashboard?tab=jobs" className="min-h-11 inline-flex items-center justify-center rounded-lg border border-gold/30 px-4 py-2 text-sm font-medium text-gold hover:bg-gold/10">{uiText("home.ctaDashboard")}</Link>
          </div>
        )}

        <div className="flex gap-8 flex-col lg:flex-row">
          {/* Job Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                <Briefcase size={24} className="text-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-text-primary">{job.title}</h1>
                  {job.urgent && (
                    <span className="px-2 py-0.5 bg-crimson/20 border border-crimson/40 text-crimson-light text-xs rounded font-semibold">{uiText("jobs.filterUrgentLabel")}</span>
                  )}
                </div>
                <p className="text-text-secondary">{uiText.rich("Ui.text_8a6f5a8eec9213", { value1: () => (job.company), value2: () => (projectTypeLabel(job.projectType, uiText)) })}</p>
              </div>
              {!preview && (
                <div className="flex items-center gap-1 shrink-0">
                  <FavoriteButton listingId={job.id} listingType="job" listingTitle={job.title} listingCity={job.location} />
                  <ReportButton listingId={job.id} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { icon: MapPin, label: uiText("AdminReview.fields.city"), value: job.location },
                { icon: Calendar, label: uiText("Ui.text_03b7919b5c9612"), value: job.shootDates },
                { icon: Clock, label: uiText("Ui.text_4e0023e9dba1f0"), value: job.posted },
                { icon: Users, label: uiText("Ui.text_71cbec70b3b5f2"), value: job.union },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="p-3 bg-bg-secondary border border-border rounded-lg">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon size={12} className="text-gold" />
                    <span className="text-xs text-text-muted uppercase tracking-widest">{label}</span>
                  </div>
                  <span className="text-sm font-medium text-text-primary">{value}</span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-gold-subtle border border-gold/20 rounded-xl mb-8 flex items-center justify-between">
              <div className="flex items-center gap-2">{uiText.rich("Ui.text_4e7e6a6e81a78e", { part1: () => (<DollarSign size={16} className="text-gold" />), part2: chunks => (<span className="text-sm text-text-secondary">{chunks}</span>) })}</div>
              <div className="flex items-center gap-3">
                {job.payType && (() => {
                  const payColors: Record<string, string> = {
                    "Paid": "bg-success/10 border-success/30 text-success",
                    "Deferred": "bg-amber-500/10 border-amber-500/30 text-amber-400",
                    "Ehrenamtlich": "bg-bg-elevated border-border text-text-muted",
                    "Expenses Only": "bg-bg-elevated border-border text-text-muted",
                  };
                  const cls = payColors[job.payType] ?? "bg-bg-elevated border-border text-text-muted";
                  return (
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${cls}`}>
                      {jobPayLabel(job.payType, uiText)}
                    </span>
                  );
                })()}
                <span className="font-display text-2xl font-bold text-gold">{job.rate}</span>
              </div>
            </div>

            {job.contentWarnings && job.contentWarnings.length > 0 && (
              <div className="mb-8 p-4 bg-crimson/5 border border-crimson/20 rounded-xl flex items-start gap-3">
                <AlertTriangle size={16} className="text-crimson-light mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-text-primary mb-1">{uiText("Ui.text_2fe8436ee7e437")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {job.contentWarnings.map((w) => (
                      <span key={w} className="text-xs px-2 py-0.5 bg-crimson/10 border border-crimson/30 text-crimson-light rounded">
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {job.tags.length > 0 && (
              <div className="mb-8">
                <div className="flex flex-wrap gap-2">
                  {job.tags.map((t) => (
                    <span key={t} className="px-3 py-1.5 bg-bg-secondary border border-border text-text-secondary text-sm rounded-lg">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-8">
              <h2 className="font-display text-xl font-bold text-text-primary mb-3">{uiText("Ui.text_19b271fac2256e")}</h2>
              {job.description ? (
                <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line">{job.description}</p>
              ) : (
                <p className="text-text-secondary text-sm leading-relaxed">{uiText.rich("Ui.text_8b26dfa544c4e4", { value2: () => (job.company), part1: chunks => (<strong className="text-text-primary">{chunks}</strong>), value3: () => (job.title), value4: () => (projectTypeLabel(job.projectType, uiText)), value5: () => (job.location) })}</p>
              )}
            </div>
          </div>

          {/* Bewerbungs-Sidebar */}
          <div className="lg:w-[340px] shrink-0">
            <div className="sticky top-20">
              <div className="bg-bg-secondary border border-border rounded-xl p-6">
                {preview ? (
                  <div className="text-center py-4 space-y-3">
                    <Briefcase size={24} className="mx-auto text-gold" />
                    <p className="text-sm font-semibold text-text-primary">{uiText("Ui.text_1724d686e958b5")}</p>
                    <p className="text-xs text-text-muted">{uiText("Ui.text_b789cf5ed9d616")}</p>
                  </div>
                ) : (
                !userId ? (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-sm text-text-muted">{uiText("Ui.text_30b81ea8840c95")}</p>
                    <button onClick={() => {
                      const destination = `${window.location.pathname}${window.location.search}`;
                      router.push(`/sign-in?redirect_url=${encodeURIComponent(destination)}`);
                    }} className="block w-full py-2.5 bg-gold text-bg-primary font-semibold rounded-lg text-sm text-center hover:bg-gold-light transition-colors">{uiText("nav.signIn")}</button>
                  </div>
                ) : userId === job.ownerId ? (
                  <div className="text-center py-4 space-y-2">
                    <Briefcase size={24} className="mx-auto text-text-muted opacity-30" />
                    <p className="text-sm text-text-muted">{uiText("Ui.text_0ea95e09f3281d")}</p>
                  </div>
                ) : submitted ? (
                  <div className="text-center py-6">
                    <div className="w-14 h-14 bg-success/10 border border-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle size={28} className="text-success" />
                    </div>
                    <h3 className="font-display text-lg font-bold text-text-primary mb-2">{uiText("Ui.text_a9b52d46fb42d8")}</h3>
                    <p className="text-text-muted text-sm leading-relaxed mb-4">{uiText.rich("Ui.text_0c5a7a1fb90d20", { value1: () => (job.company) })}</p>
                    <Link href="/jobs" className="text-xs text-gold hover:text-gold-light transition-colors">{uiText("Ui.text_e233a237cb4040")}</Link>
                  </div>
                ) : (
                  <>
                    <h2 className="font-display text-xl font-bold text-text-primary mb-1">{uiText("Ui.text_94fd2dbc3404b4")}</h2>
                    <p className="text-xs text-success flex items-center gap-1 mb-4">{uiText.rich("Ui.text_8bc14d2e4ecbb1", { part1: () => (<CheckCircle size={11} />) })}</p>
                    <form onSubmit={handleApply} className="space-y-4">
                      <div>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{uiText("Ui.text_cc108e93420d0d")}</label>
                        <textarea
                          rows={5}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder={uiText("Ui.text_eaa5030aa4caa0", { value1: String(job.company), value2: String(job.title) })}
                          className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold transition-colors resize-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{uiText("Ui.text_8d7b6aaa002591")}</label>
                        <input
                          type="url"
                          value={portfolio}
                          onChange={(e) => setPortfolio(e.target.value)}
                          placeholder={uiText("Ui.text_1981d29fbbd386")}
                          className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{uiText("Ui.text_35d10be835695b")}</label>
                        <input
                          type="text"
                          value={dayRate}
                          onChange={(e) => setDayRate(e.target.value)}
                          placeholder={uiText("Ui.text_ecb62a479e9238")}
                          className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                        />
                      </div>
                      {submitError && (
                        <p className="text-xs text-crimson-light">{submitError}</p>
                      )}
                      <button
                        type="submit"
                        disabled={submitting || !message.trim()}
                        className="w-full py-3 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <>{uiText.rich("Ui.text_45085d36409cfd", { part1: () => (<div className="w-4 h-4 border-2 border-bg-primary/40 border-t-bg-primary rounded-full animate-spin" />) })}</>
                        ) : (
                          uiText("Ui.text_329d7a850baa31")
                        )}
                      </button>
                      <p className="text-center text-xs text-text-muted flex items-center justify-center gap-1">{uiText.rich("Ui.text_612067ab804892", { part1: () => (<Shield size={11} />) })}</p>
                    </form>
                  </>
                )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
