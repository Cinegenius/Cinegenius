"use client";
import { useTranslations } from "next-intl";
import { offerStatus } from "@/lib/offer-moderation";

export default function OfferModerationStatus({ item, explain = false }: { item: { moderation_status?: unknown; published?: boolean | null; moderation_reason?: string | null }; explain?: boolean }) {
  const t = useTranslations("OfferModeration");
  const status = offerStatus(item);
  return <div className="min-w-0 text-xs leading-5">
    <span className={`inline-flex max-w-full rounded-full border px-2 py-0.5 font-medium ${status === "approved" ? "border-success/30 text-success" : status === "pending" || status === "legacy_review_required" ? "border-gold/30 text-gold" : "border-border text-text-muted"}`}>{t("statuses." + status)}</span>
    {explain && <p className="mt-2 text-text-muted">{t(status === "pending" ? "submitted" : status === "legacy_review_required" ? "legacyNotice" : status === "approved" ? "editNotice" : "privateNotice")}</p>}
    {item.moderation_reason && <p className="mt-2 whitespace-pre-wrap break-words text-text-secondary [overflow-wrap:anywhere]">{t("reasonLabel")}: {item.moderation_reason}</p>}
  </div>;
}
