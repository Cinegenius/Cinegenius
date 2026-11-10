"use client";

import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { Clock3 } from "lucide-react";

export type ListingFreshnessPreview = { status: string; due_at?: string | null; response_deadline_at?: string | null };

export default function ListingFreshnessSummary({ listingId, state, showLink = true, onNavigate }: {
  listingId: string;
  state?: ListingFreshnessPreview | null;
  showLink?: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations("ListingFreshness");
  const format = useFormatter();
  const deadline = state?.response_deadline_at ? new Date(state.response_deadline_at) : null;
  const status = state && t.has(`statuses.${state.status}`) ? t(`statuses.${state.status}`) : null;
  return <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
    {status && <span className={`inline-flex items-center gap-1.5 ${state?.status === "paused" ? "text-gold" : "text-text-muted"}`}><Clock3 size={13} aria-hidden="true" />{status}</span>}
    {deadline && Number.isFinite(deadline.getTime()) && <span className="text-gold">{t("deadlineShort", { date: format.dateTime(deadline, { dateStyle: "medium" }) })}</span>}
    {showLink && <Link href={`/listing-status/${encodeURIComponent(listingId)}`} prefetch={false} onClick={event => {
      if (onNavigate && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onNavigate(); }
    }} className="inline-flex min-h-11 items-center font-medium text-gold hover:underline">{t("dashboardLink")}</Link>}
  </div>;
}
