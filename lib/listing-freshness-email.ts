import {emailLayout, emailButton} from "@/lib/email-layout";
import "server-only";

import { getTranslations } from "next-intl/server";
import { Resend } from "resend";
import { isAppLocale, type AppLocale } from "@/lib/i18n/locales";

const FROM = "CineGenius <noreply@cinegenius.co>";
const REPLY_TO = "cinegenius.co@gmail.com";
const APP_ORIGIN = "https://cinegenius.co";

/** Store this exact payload before the first attempt; retries must not re-render it. */
export type FrozenListingReminderEmail = {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  locale: AppLocale;
};

function headerText(value: string, limit: number) {
  return Array.from(value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()).slice(0, limit).join("");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function isFrozenListingReminderEmail(value: unknown): value is FrozenListingReminderEmail {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return payload.from === FROM && payload.replyTo === REPLY_TO
    && typeof payload.to === "string" && payload.to.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.to)
    && typeof payload.subject === "string" && payload.subject.length > 0 && payload.subject.length <= 500 && !/[\r\n]/.test(payload.subject)
    && typeof payload.html === "string" && payload.html.length > 0 && payload.html.length <= 100_000
    && typeof payload.text === "string" && payload.text.length > 0 && payload.text.length <= 20_000
    && isAppLocale(payload.locale);
}

export async function buildListingReminderEmail(input: {
  to: string;
  firstName: string | null;
  listingId: string;
  title: string;
  stage: "initial" | "followup";
  graceDays: number;
  locale: AppLocale;
}): Promise<FrozenListingReminderEmail> {
  if (!/^[0-9a-f-]{36}$/i.test(input.listingId) || !isAppLocale(input.locale) || !["initial", "followup"].includes(input.stage)
    || !Number.isInteger(input.graceDays) || input.graceDays < 1 || input.graceDays > 730) {
    throw new Error("invalid_listing_reminder");
  }
  const t = await getTranslations({ locale: input.locale, namespace: "ListingFreshness.email" });
  const title = headerText(input.title, 200);
  const firstName = headerText(input.firstName ?? "", 80);
  const followup = input.stage === "followup";
  const subject = headerText(t(followup ? "followupSubject" : "subject", { title }), 450);
  const heading = t(followup ? "followupHeading" : "heading");
  const lines = [
    firstName ? t("greeting", { name: firstName }) : t("greetingNeutral"),
    t(followup ? "followupBody" : "body", { title }),
    t("deadline", { days: input.graceDays }),
    ...(followup ? [t("followupConsequence")] : []),
  ];
  const href = new URL(`/listing-status/${encodeURIComponent(input.listingId)}`, APP_ORIGIN).toString();
  const button = t("button");
  const note = t("privateLinkNote");
  const signature = t("signature");
  const footer = t("footer");
  const html = emailLayout(`
    <h1 style="margin:0 0 20px;font-size:25px;line-height:1.3;color:#f0f2f5">${escapeHtml(heading)}</h1>
    ${lines.map(line => `<p style="font-size:15px;line-height:1.6;color:#b2bbc8">${escapeHtml(line)}</p>`).join("")}
    ${emailButton(escapeHtml(button), href)}
    <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#8995a8">${escapeHtml(note)}</p>
    <p style="font-size:15px;line-height:1.6;white-space:pre-line">${escapeHtml(signature)}</p>
  `, {locale: input.locale, title: subject, footerHtml: escapeHtml(footer), siteUrl: APP_ORIGIN});
  const payload: FrozenListingReminderEmail = {
    from: FROM, to: input.to, replyTo: REPLY_TO, subject, html,
    text: [heading, ...lines, `${button}: ${href}`, note, signature, footer].join("\n\n"),
    locale: input.locale,
  };
  if (!isFrozenListingReminderEmail(payload)) throw new Error("invalid_listing_reminder_payload");
  return payload;
}

export type ListingReminderSendResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_configured" | "invalid_payload" | "provider_rejected" | "provider_error"; code?: string };

export async function sendListingReminderEmail(payload: FrozenListingReminderEmail, idempotencyKey: string): Promise<ListingReminderSendResult> {
  if (!isFrozenListingReminderEmail(payload) || !idempotencyKey || idempotencyKey.length > 256 || /[\r\n]/.test(idempotencyKey)) {
    return { ok: false, reason: "invalid_payload" };
  }
  if (!process.env.RESEND_API_KEY) return { ok: false, reason: "not_configured" };
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: payload.from, to: payload.to, replyTo: payload.replyTo,
      subject: payload.subject, html: payload.html, text: payload.text,
    }, { idempotencyKey, signal: AbortSignal.timeout(10_000) });
    if (result.error || !result.data?.id) {
      return { ok: false, reason: "provider_rejected", code: result.error?.name };
    }
    return { ok: true, id: result.data.id };
  } catch {
    // The provider may already have accepted the mail. Keep its frozen payload
    // and key; the worker must never infer a successful delivery from a timeout.
    return { ok: false, reason: "provider_error" };
  }
}

export type ListingReminderDeliveryStatus = "pending" | "delivered" | "bounced" | "failed" | "suppressed" | "complained" | "canceled" | "unavailable";

/** Read the current provider outcome immediately before any automatic pause.
 * Acceptance, an unreadable receipt, or a mismatched recipient is never delivery.
 * "Delivered" means accepted by the recipient's mail server, not read by a person.
 */
export async function getListingReminderDeliveryStatus(messageId: string, recipient: string): Promise<ListingReminderDeliveryStatus> {
  if (!process.env.RESEND_API_KEY || !messageId || messageId.length > 200 || /[\r\n]/.test(messageId)
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return "unavailable";
  try {
    const result = await new Resend(process.env.RESEND_API_KEY).emails.get(messageId, { signal: AbortSignal.timeout(8_000) });
    if (result.error || result.data?.id !== messageId || result.data.to.length !== 1
      || result.data.to[0].toLowerCase() !== recipient.toLowerCase()) return "unavailable";
    switch (result.data.last_event) {
      case "delivered": case "opened": case "clicked": return "delivered";
      case "bounced": case "failed": case "suppressed": case "complained": case "canceled": return result.data.last_event;
      case "sent": case "queued": case "scheduled": case "delivery_delayed": return "pending";
      default: return "unavailable";
    }
  } catch {
    return "unavailable";
  }
}
