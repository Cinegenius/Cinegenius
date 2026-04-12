"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowLeft, MapPin, Clock, Briefcase, CheckCircle, Users, Calendar, Shield, AlertTriangle, DollarSign } from "lucide-react";
import InquiryForm from "@/components/InquiryForm";
import FavoriteButton from "@/components/FavoriteButton";

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

export default function JobDetail({ job }: { job: Job }) {
  const { userId } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [message, setMessage] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [dayRate, setDayRate] = useState("");

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
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
      if (!res.ok) throw new Error(data.error ?? "Fehler");
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Fehler beim Absenden");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/jobs" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-gold transition-colors mb-6">
          <ArrowLeft size={14} /> Zurück zu Jobs
        </Link>

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
                    <span className="px-2 py-0.5 bg-crimson/20 border border-crimson/40 text-crimson-light text-xs rounded font-semibold">
                      Dringend
                    </span>
                  )}
                </div>
                <p className="text-text-secondary">{job.company} &middot; {job.projectType}</p>
              </div>
              <FavoriteButton
                listingId={job.id}
                listingType="job"
                listingTitle={job.title}
                listingCity={job.location}
                className="shrink-0"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { icon: MapPin, label: "Ort", value: job.location },
                { icon: Calendar, label: "Drehtage", value: job.shootDates },
                { icon: Clock, label: "Eingestellt", value: job.posted },
                { icon: Users, label: "Gewerkschaft", value: job.union },
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
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-gold" />
                <span className="text-sm text-text-secondary">Gage</span>
              </div>
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
                      {job.payType}
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
                  <p className="text-sm font-semibold text-text-primary mb-1">Inhaltshinweise</p>
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
              <h2 className="font-display text-xl font-bold text-text-primary mb-3">Über diese Stelle</h2>
              {job.description ? (
                <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line">{job.description}</p>
              ) : (
                <p className="text-text-secondary text-sm leading-relaxed">
                  <strong className="text-text-primary">{job.company}</strong> sucht eine/n {job.title} für {job.projectType.toLowerCase()} in {job.location}.
                </p>
              )}
            </div>
          </div>

          {/* Bewerbungs-Sidebar */}
          <div className="lg:w-[340px] shrink-0">
            <div className="sticky top-20">
              <div className="bg-bg-secondary border border-border rounded-xl p-6">
                {job.ownerId ? (
                  <InquiryForm
                    listingId={job.id}
                    listingTitle={job.title}
                    listingType="job"
                    ownerId={job.ownerId}
                    ownerName={job.ownerName ?? job.company}
                  />
                ) : (
                  <>
                <h2 className="font-display text-xl font-bold text-text-primary mb-1">Auf diese Stelle bewerben</h2>
                <p className="text-xs text-success flex items-center gap-1 mb-4">
                  <CheckCircle size={11} /> Kostenlos bewerben — keine Gebühren für Bewerbungen
                </p>

                {submitted ? (
                  <div className="text-center py-6">
                    <div className="w-14 h-14 bg-success/10 border border-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle size={28} className="text-success" />
                    </div>
                    <h3 className="font-display text-lg font-bold text-text-primary mb-2">Bewerbung abgesendet!</h3>
                    <p className="text-text-muted text-sm leading-relaxed mb-4">
                      Deine Bewerbung wurde an {job.company} übermittelt. Du hörst innerhalb von 48 Stunden zurück.
                    </p>
                    <Link href="/jobs" className="text-xs text-gold hover:text-gold-light transition-colors">
                      Weitere Jobs durchsuchen →
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={handleApply} className="space-y-4">
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                        Anschreiben
                      </label>
                      <textarea
                        rows={5}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={`Erkläre ${job.company}, warum du die/der richtige ${job.title} für dieses Projekt bist...`}
                        className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold transition-colors resize-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                        Portfolio / Showreel URL
                      </label>
                      <input
                        type="url"
                        value={portfolio}
                        onChange={(e) => setPortfolio(e.target.value)}
                        placeholder="https://vimeo.com/deinshowreel"
                        className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                        Tagesgage (optional)
                      </label>
                      <input
                        type="text"
                        value={dayRate}
                        onChange={(e) => setDayRate(e.target.value)}
                        placeholder="z. B. 750 €/Tag"
                        className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                      />
                    </div>
                    {submitError && (
                      <p className="text-xs text-crimson-light">{submitError}</p>
                    )}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <><div className="w-4 h-4 border-2 border-bg-primary/40 border-t-bg-primary rounded-full animate-spin" /> Wird gesendet...</>
                      ) : (
                        "Bewerbung absenden"
                      )}
                    </button>
                    <p className="text-center text-xs text-text-muted flex items-center justify-center gap-1">
                      <Shield size={11} /> Deine Kontaktdaten bleiben privat
                    </p>
                  </form>
                )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
