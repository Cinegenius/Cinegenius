"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PUBLIC_REPORT_CATEGORIES, type PublicReportCategory } from "@/lib/public-report";

type Status = "idle" | "sending" | "sent" | "error";

export default function PublicReportForm() {
  const t = useTranslations("PublicReport");
  const locale = useLocale();
  const categories = useMemo(() => PUBLIC_REPORT_CATEGORIES.map((value) => ({
    value,
    label: t(`categories.${value}`),
  })), [t]);
  const [target, setTarget] = useState("");
  const [category, setCategory] = useState<PublicReportCategory>("illegal_content");
  const [details, setDetails] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [goodFaith, setGoodFaith] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    try {
      const response = await fetch("/api/public-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, category, details, reporterName, reporterEmail, goodFaith, locale }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setStatus("error");
        setMessage(body?.error ?? t("errors.send"));
        return;
      }
      setStatus("sent");
      setMessage(body?.receiptSent ? t("successWithReceipt") : t("success"));
      setTarget("");
      setCategory("illegal_content");
      setDetails("");
      setReporterName("");
      setReporterEmail("");
      setGoodFaith(false);
    } catch {
      setStatus("error");
      setMessage(t("errors.network"));
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-lg border border-border bg-bg-secondary p-5 sm:p-6">
      <div>
        <label htmlFor="public-report-target" className="mb-2 block text-sm font-medium text-text-primary">{t("fields.target")}</label>
        <input
          id="public-report-target"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          required
          maxLength={500}
          placeholder={t("placeholders.target")}
          className="min-h-12 w-full rounded-lg border border-border bg-bg-primary px-3 text-sm text-text-primary outline-none focus:border-gold"
        />
        <p className="mt-1 text-xs text-text-muted">{t("hints.target")}</p>
      </div>

      <div>
        <label htmlFor="public-report-category" className="mb-2 block text-sm font-medium text-text-primary">{t("fields.category")}</label>
        <select
          id="public-report-category"
          value={category}
          onChange={(event) => setCategory(event.target.value as PublicReportCategory)}
          className="min-h-12 w-full rounded-lg border border-border bg-bg-primary px-3 text-sm text-text-primary outline-none focus:border-gold"
        >
          {categories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="public-report-details" className="mb-2 block text-sm font-medium text-text-primary">{t("fields.details")}</label>
        <textarea
          id="public-report-details"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          required
          minLength={20}
          maxLength={5000}
          rows={7}
          placeholder={t("placeholders.details")}
          className="w-full rounded-lg border border-border bg-bg-primary p-3 text-sm text-text-primary outline-none focus:border-gold"
        />
        <p className="mt-1 text-xs text-text-muted">{t("hints.details")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="public-report-name" className="mb-2 block text-sm font-medium text-text-primary">{t("fields.name")}</label>
          <input
            id="public-report-name"
            value={reporterName}
            onChange={(event) => setReporterName(event.target.value)}
            maxLength={160}
            autoComplete="name"
            className="min-h-12 w-full rounded-lg border border-border bg-bg-primary px-3 text-sm text-text-primary outline-none focus:border-gold"
          />
        </div>
        <div>
          <label htmlFor="public-report-email" className="mb-2 block text-sm font-medium text-text-primary">{t("fields.email")}</label>
          <input
            id="public-report-email"
            value={reporterEmail}
            onChange={(event) => setReporterEmail(event.target.value)}
            maxLength={254}
            type="email"
            autoComplete="email"
            className="min-h-12 w-full rounded-lg border border-border bg-bg-primary px-3 text-sm text-text-primary outline-none focus:border-gold"
          />
          <p className="mt-1 text-xs text-text-muted">{t("hints.email")}</p>
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-border bg-bg-primary p-3 text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={goodFaith}
          onChange={(event) => setGoodFaith(event.target.checked)}
          required
          className="mt-1 accent-gold"
        />
        <span>{t("goodFaith")}</span>
      </label>

      {message && (
        <p className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${status === "sent" ? "border-success/30 bg-success/10 text-success" : "border-crimson/30 bg-crimson/10 text-crimson-light"}`} role="status">
          {status === "sent" ? <CheckCircle2 className="mt-0.5 shrink-0" size={16} /> : <AlertCircle className="mt-0.5 shrink-0" size={16} />}
          <span>{message}</span>
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-gold px-5 text-sm font-semibold text-bg-primary transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Send size={16} />
        {status === "sending" ? t("sending") : t("submit")}
      </button>
    </form>
  );
}
