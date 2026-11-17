import {emailLayout, emailButton} from "@/lib/email-layout";
import {getTranslations} from "next-intl/server";
import {DEFAULT_LOCALE, type AppLocale} from "@/lib/i18n/locales";
import {recipientEmailLocale} from "@/lib/i18n/email-locale";
import type { PublicReport } from "@/lib/public-report";
import { Resend } from "resend";

// Gracefully degrade if RESEND_API_KEY is not set
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = "CineGenius <noreply@cinegenius.co>";
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://cinegenius.co";

// Send an email — silently skips if Resend is not configured
async function send(to: string, subject: string, html: string) {
  if (!resend) return;
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) {
      // Keep provider failures visible in server logs without recording the
      // recipient address or message contents.
      console.error("CineGenius: Transaktions-E-Mail wurde von Resend abgelehnt.", {
        code: error.name,
        statusCode: error.statusCode,
      });
    }
  } catch {
    // Email is best-effort; never let provider/network failures break messaging.
    console.error("CineGenius: Transaktions-E-Mail konnte nicht gesendet werden.");
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

function wrap(content: string, locale: AppLocale, footer: string) {
  return emailLayout(content, {locale, footerHtml: escapeHtml(footer), siteUrl: BASE});
}
function btn(label: string, href: string) { return emailButton(label, href); }

function h1(text: string) {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f0f2f5">${text}</h1>`;
}

function p(text: string) {
  return `<p style="margin:0 0 4px;font-size:14px;color:#b2bbc8;line-height:1.6">${text}</p>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

type EmailTranslator = Awaited<ReturnType<typeof getTranslations>>;
async function transactionalCopy(to: string, selected?: AppLocale) {
  if (!resend) return null;
  try {
    const locale = selected ?? await recipientEmailLocale(to);
    const t = await getTranslations({locale, namespace: "TransactionalEmail"});
    return {locale, t};
  } catch {
    console.error("[transactional-email] recipient language could not be loaded");
    return null;
  }
}

export async function sendFriendRequestEmail(to: string, fromName: string, selected?: AppLocale) {
  const copy = await transactionalCopy(to, selected);
  if (!copy) return;
  const {locale, t} = copy;
  await send(to, t("friendRequestSubject", {name: normalizedEmailText(fromName)}), wrap(`
    ${h1(escapeHtml(t("friendRequestHeading")))}
    ${p(t.markup("friendRequestBody", {name: escapeHtml(fromName), person: chunks => `<strong style="color:#f0f2f5">${chunks}</strong>`}))}
    ${btn(escapeHtml(t("viewRequest")), `${BASE}/messages?requests=1`)}
  `, locale, t("footer")));
}

export async function sendFriendAcceptedEmail(to: string, accepterName: string, selected?: AppLocale) {
  const copy = await transactionalCopy(to, selected);
  if (!copy) return;
  const {locale, t} = copy;
  await send(to, t("friendAcceptedSubject", {name: normalizedEmailText(accepterName)}), wrap(`
    ${h1(escapeHtml(t("friendAcceptedHeading")))}
    ${p(t.markup("friendAcceptedBody", {name: escapeHtml(accepterName), person: chunks => `<strong style="color:#f0f2f5">${chunks}</strong>`}))}
    ${btn(escapeHtml(t("friendAcceptedAction")), `${BASE}/messages?view=friends`)}
  `, locale, t("footer")));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

function normalizedEmailText(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

export type PublicReportReceiptCopy = {
  subject: string;
  heading: string;
  intro: string;
  reference: string;
  next: string;
  footer: string;
};

export async function sendPublicReportEmails(report: PublicReport, receipt: PublicReportReceiptCopy, locale: AppLocale) {
  if (!resend) return { operatorSent: false, receiptSent: false, reason: "not_configured" as const };
  // Keep the operator inbox in the existing default language; the receipt uses
  // the explicitly selected reporting language. Never translate member content.
  const [operator, categories] = await Promise.all([
    getTranslations({locale: DEFAULT_LOCALE, namespace: "PublicReportEmail"}),
    getTranslations({locale: DEFAULT_LOCALE, namespace: "PublicReport"}),
  ]);
  const categoryLabel = categories(`categories.${report.category}`);
  const recipient = process.env.CG_LEGAL_REPORT_TO ?? "cinegenius.co@gmail.com";
  const submittedAt = new Date().toISOString();
  const reference = `CG-MELDUNG-${submittedAt.slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const reporter = [report.reporterName, report.reporterEmail].filter(Boolean).join(" <") + (report.reporterEmail && report.reporterName ? ">" : "");
  const detailHtml = escapeHtml(report.details).replace(/\n/g, "<br />");
  const operatorHtml = wrap(`
    ${h1(escapeHtml(operator("operator.heading")))}
    ${p(escapeHtml(operator("operator.reference", {reference})))}
    ${p(escapeHtml(operator("operator.target", {target: report.target})))}
    ${p(escapeHtml(operator("operator.category", {category: categoryLabel})))}
    ${p(escapeHtml(operator("operator.reporter", {reporter: reporter || operator("operator.anonymous")})))}
    ${p(escapeHtml(operator("operator.received", {date: submittedAt})))}
    <div style="margin-top:16px;padding:12px 16px;background:#1e2330;border:1px solid #2a3248;border-radius:8px;font-size:14px;color:#d0d0d0;line-height:1.6">${detailHtml}</div>
  `, DEFAULT_LOCALE, operator("operator.footer"));

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: recipient,
      replyTo: report.reporterEmail ?? undefined,
      subject: normalizedEmailText(operator("operator.subject", {category: categoryLabel})),
      html: operatorHtml,
    });
    if (error || !data?.id) {
      console.error("CineGenius: Öffentliche Meldung wurde vom E-Mail-Anbieter nicht bestätigt.", { code: error?.name, statusCode: error?.statusCode });
      return { operatorSent: false, receiptSent: false, reason: "provider_rejected" as const };
    }
  } catch {
    console.error("CineGenius: Öffentliche Meldung konnte nicht per E-Mail zugestellt werden.");
    return { operatorSent: false, receiptSent: false, reason: "provider_error" as const };
  }

  if (!report.reporterEmail) return { operatorSent: true, receiptSent: false, reference };

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: report.reporterEmail,
      replyTo: "cinegenius.co@gmail.com",
      subject: normalizedEmailText(receipt.subject),
      html: wrap(`
        ${h1(escapeHtml(receipt.heading))}
        ${p(escapeHtml(receipt.intro))}
        ${p(escapeHtml(receipt.reference.replace("{reference}", reference)))}
        ${p(escapeHtml(receipt.next))}
      `, locale, receipt.footer),
    });
    if (error || !data?.id) {
      console.error("CineGenius: Eingangsbestätigung für öffentliche Meldung wurde nicht bestätigt.", { code: error?.name, statusCode: error?.statusCode });
      return { operatorSent: true, receiptSent: false, reference };
    }
    return { operatorSent: true, receiptSent: true, reference };
  } catch {
    console.error("CineGenius: Eingangsbestätigung für öffentliche Meldung konnte nicht gesendet werden.");
    return { operatorSent: true, receiptSent: false, reference };
  }
}

function messageEmailHtml(senderName: string, preview: string, hasMore: boolean, conversationId: string, locale: AppLocale, t: EmailTranslator) {
  const snippet = escapeHtml(preview);
  const chatUrl = new URL("/messages", BASE);
  chatUrl.searchParams.set("conv", conversationId);

  return emailLayout(`
    <p style="margin:0 0 12px;color:#c2f135;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">${escapeHtml(t("messageLabel"))}</p>
    ${h1(escapeHtml(t("messageHeading", {name: senderName})))}
    ${p(escapeHtml(t("messageIntro")))}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;background:#1e2330;border:1px solid #2a3248;border-radius:12px;table-layout:fixed"><tr><td style="padding:16px;border-left:3px solid #c2f135;color:#f0f2f5;font-size:15px;line-height:1.65;overflow-wrap:anywhere;word-break:break-word">${snippet}${hasMore ? "…" : ""}</td></tr></table>
    ${btn(escapeHtml(t("openChat")), chatUrl.toString())}
    <p style="margin:22px 0 0;color:#8995a8;font-size:12px;line-height:1.6">${escapeHtml(t("messageAuthHint"))}</p>
  `, {locale, footerHtml: escapeHtml(t("messageFooter")), preheader: t("messagePreheader", {name: senderName}), siteUrl: BASE});
}

export async function sendNewMessageEmail(to: string, fromName: string, preview: string, conversationId: string, selected?: AppLocale) {
  const copy = await transactionalCopy(to, selected);
  if (!copy) return;
  const {locale, t} = copy;
  const safeName = Array.from(normalizedEmailText(fromName)).slice(0, 100).join("") || t("unknownSender");
  const previewCharacters = Array.from(normalizedEmailText(preview));
  const safePreview = previewCharacters.slice(0, 200).join("");
  const html = messageEmailHtml(safeName, safePreview, previewCharacters.length > 200, conversationId, locale, t);
  await send(to, t("messageSubject", {name: safeName}), html);
}

export async function sendNewApplicationEmail(to: string, applicantName: string, jobTitle: string, selected?: AppLocale) {
  const copy = await transactionalCopy(to, selected);
  if (!copy) return;
  const {locale, t} = copy;
  await send(to, t("applicationSubject", {title: normalizedEmailText(jobTitle)}), wrap(`
    ${h1(escapeHtml(t("applicationHeading")))}
    ${p(t.markup("applicationBody", {name: escapeHtml(applicantName), person: chunks => `<strong style="color:#f0f2f5">${chunks}</strong>`}))}
    <p style="margin:16px 0;padding:12px 16px;background:#1e2330;border:1px solid #2a3248;border-radius:8px;font-size:14px;color:#c2f135;font-weight:600">${escapeHtml(jobTitle)}</p>
    ${btn(escapeHtml(t("viewApplication")), `${BASE}/dashboard?tab=messages`)}
  `, locale, t("footer")));
}

export async function sendWelcomeEmail(to: string, displayName: string, selected?: AppLocale) {
  const copy = await transactionalCopy(to, selected);
  if (!copy) return;
  const {locale, t} = copy;
  await send(to, t("welcomeSubject"), wrap(`
    ${h1(escapeHtml(t("welcomeGreeting", {name: displayName})))}
    ${p(escapeHtml(t("welcomeIntro")))}
    ${p(escapeHtml(t("nextSteps")))}
    <table style="margin:20px 0;width:100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:12px 16px;background:#1e2330;border:1px solid #2a3248;border-radius:8px;margin-bottom:8px;display:block">
        <span style="font-size:13px;color:#f0f2f5;font-weight:600">1. ${escapeHtml(t("profileStep"))}</span><br/>
        <span style="font-size:12px;color:#8995a8">${escapeHtml(t("profileStepDescription"))}</span>
      </td></tr><tr><td style="height:8px"></td></tr>
      <tr><td style="padding:12px 16px;background:#1e2330;border:1px solid #2a3248;border-radius:8px">
        <span style="font-size:13px;color:#f0f2f5;font-weight:600">2. ${escapeHtml(t("listingStep"))}</span><br/>
        <span style="font-size:12px;color:#8995a8">${escapeHtml(t("listingStepDescription"))}</span>
      </td></tr>
    </table>
    ${btn(escapeHtml(t("dashboard")), `${BASE}/dashboard?welcome=1`)}
    <p style="margin-top:24px;font-size:12px;color:#8995a8">${escapeHtml(t("supportReply"))}</p>
  `, locale, t("footer")));
}

export type NewsletterTestCopy = {
  subject: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  recommend: string;
  instagramLabel: string;
  instagramUrl: string;
  signature: string;
  testFooter: string;
  unsubscribeFooter: string;
  unsubscribeLink: string;
};

export type NewsletterConfirmationCopy = {
  subject: string;
  heading: string;
  body: string;
  button: string;
  ignore: string;
};

function newsletterMarkup(copy: NewsletterTestCopy, unsubscribeUrl: string | null, test = false, locale = "de") {
  const subject = escapeHtml(copy.subject);
  const heading = escapeHtml(copy.heading);
  const body = copy.body.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    .map(line => `<p style="margin:0 0 16px;font-size:15px;color:#a7afbf;line-height:1.7">${escapeHtml(line)}</p>`).join("");
  const ctaLabel = escapeHtml(copy.ctaLabel);
  const recommend = escapeHtml(copy.recommend);
  const instagramLabel = escapeHtml(copy.instagramLabel);
  const instagramUrl = escapeHtml(copy.instagramUrl);
  const signature = escapeHtml(copy.signature);
  const footer = test
    ? escapeHtml(copy.testFooter)
    : `${escapeHtml(copy.unsubscribeFooter)} <a href="${escapeHtml(unsubscribeUrl ?? BASE)}" style="color:#c2f135;text-decoration:underline">${escapeHtml(copy.unsubscribeLink)}</a>`;
  return emailLayout(`
    ${h1(heading || subject)}${body}
    ${btn(ctaLabel, copy.ctaUrl)}
    <p style="margin:24px 0 12px;font-size:14px;color:#b2bbc8;line-height:1.6">${recommend}</p>
    <p style="margin:0 0 20px"><a href="${instagramUrl}" style="color:#c2f135;text-decoration:underline">${instagramLabel}</a></p>
    <p style="margin:0;color:#f0f2f5;font-size:14px;font-weight:600">${signature}</p>
  `, {locale, footerHtml: footer, title: copy.subject, siteUrl: BASE});
}

/** One-off preview test to the authenticated admin's own verified address. */
export async function sendNewsletterTestEmail(to: string, copy: NewsletterTestCopy, locale = "de") {
  if (!resend) return { ok: false as const, reason: "not_configured" as const };
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      replyTo: "support@cinegenius.co",
      subject: normalizedEmailText(copy.subject),
      html: newsletterMarkup(copy, null, true, locale),
    });
    if (error || !data?.id) {
      console.error("CineGenius: Newsletter-Testmail wurde nicht bestätigt.", { code: error?.name, statusCode: error?.statusCode });
      return { ok: false as const, reason: "provider_rejected" as const };
    }
    return { ok: true as const, id: data.id };
  } catch {
    console.error("CineGenius: Newsletter-Testmail konnte nicht gesendet werden.");
    return { ok: false as const, reason: "provider_error" as const };
  }
}

export async function sendNewsletterConfirmationEmail(to: string, confirmationUrl: string, copy: NewsletterConfirmationCopy, locale = "de") {
  if (!resend) {
    console.error("[newsletter-confirmation] email provider unavailable");
    return false;
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject: normalizedEmailText(copy.subject),
      replyTo: "support@cinegenius.co",
      html: emailLayout(`${h1(escapeHtml(copy.heading))}${p(escapeHtml(copy.body))}${btn(escapeHtml(copy.button), confirmationUrl)}`, {locale, footerHtml: escapeHtml(copy.ignore), title: copy.subject, siteUrl: BASE}),
    });
    if (error || !data?.id) {
      console.error("CineGenius: Newsletter-Bestätigung wurde von Resend nicht angenommen.", { code: error?.name, statusCode: error?.statusCode });
      return false;
    }
    return true;
  } catch {
    console.error("CineGenius: Newsletter-Bestätigung konnte nicht gesendet werden.");
    return false;
  }
}

/** Send one immutable, manually launched campaign batch with provider idempotency. */
export async function sendNewsletterCampaignBatch(
  messages: Array<{ to: string; unsubscribeUrl: string; copy: NewsletterTestCopy }>,
  idempotencyKey: string,
  locale = "de",
) {
  if (!resend) return { ok: false as const, reason: "not_configured" as const };
  try {
    const result = await resend.batch.send(messages.map(({ to, unsubscribeUrl, copy }) => ({
      from: FROM,
      to,
      replyTo: "support@cinegenius.co",
      subject: normalizedEmailText(copy.subject),
      html: newsletterMarkup(copy, unsubscribeUrl, false, locale),
    })), { idempotencyKey }) as unknown as { data?: Array<{ id: string }> | null; error?: { name?: string; statusCode?: number } | null };
    if (result.error || !result.data || result.data.length !== messages.length) {
      console.error("CineGenius: Newsletter-Batch wurde nicht vollständig bestätigt.", { code: result.error?.name, statusCode: result.error?.statusCode });
      return { ok: false as const, reason: "provider_rejected" as const };
    }
    return { ok: true as const, ids: result.data.map(item => item.id) };
  } catch {
    console.error("CineGenius: Newsletter-Batch konnte nicht bestätigt werden.");
    return { ok: false as const, reason: "provider_error" as const };
  }
}

export async function sendNewBookingEmail(to: string, listingTitle: string, guestName: string, selected?: AppLocale) {
  const copy = await transactionalCopy(to, selected);
  if (!copy) return;
  const {locale, t: email} = copy;
  const t = await getTranslations({locale, namespace: "BookingRequest"});
  await send(to, t("incomingSubject", {title: normalizedEmailText(listingTitle)}), wrap(`
    ${h1(escapeHtml(t("incomingTitle")))}
    ${p(escapeHtml(t("incomingBody", {name: guestName, title: listingTitle})))}
    ${p(escapeHtml(t("requestOnly")))}
    ${btn(escapeHtml(t("viewRequest")), `${BASE}/dashboard?tab=bookings`)}
  `, locale, email("footer")));
}

/** Provider acceptance confirms the request; it does not assert a processed payment. */
export async function sendBookingAcceptedEmail(to: string, listingTitle: string, bookingRef: string, selected?: AppLocale) {
  const copy = await transactionalCopy(to, selected);
  if (!copy) return;
  const {locale, t} = copy;
  await send(to, t("bookingAcceptedSubject", {title: normalizedEmailText(listingTitle)}), wrap(`
    ${h1(escapeHtml(t("bookingAcceptedHeading")))}
    ${p(escapeHtml(t("bookingAcceptedBody")))}
    <p style="margin:16px 0;padding:12px 16px;background:#1e2330;border:1px solid #2a3248;border-radius:8px;font-size:14px;color:#c2f135;font-weight:600">${escapeHtml(listingTitle)}</p>
    <p style="margin:0 0 16px;font-size:13px;color:#b2bbc8">${escapeHtml(t("bookingReference", {ref: bookingRef}))}</p>
    ${btn(escapeHtml(t("viewBooking")), `${BASE}/dashboard?tab=bookings`)}
    <p style="margin-top:24px;font-size:12px;color:#8995a8">${escapeHtml(t("bookingQuestions"))}</p>
  `, locale, t("footer")));
}

export async function sendBookingConfirmedEmail(to: string, listingTitle: string, bookingRef: string, selected?: AppLocale) {
  const copy = await transactionalCopy(to, selected);
  if (!copy) return;
  const {locale, t} = copy;
  await send(to, t("bookingConfirmedSubject", {title: normalizedEmailText(listingTitle)}), wrap(`
    ${h1(escapeHtml(t("bookingConfirmedHeading")))}
    ${p(escapeHtml(t("bookingPaymentProcessed")))}
    <p style="margin:16px 0;padding:12px 16px;background:#1e2330;border:1px solid #2a3248;border-radius:8px;font-size:14px;color:#c2f135;font-weight:600">${escapeHtml(listingTitle)}</p>
    <p style="margin:0 0 16px;font-size:13px;color:#b2bbc8">${escapeHtml(t("bookingReference", {ref: bookingRef}))}</p>
    ${btn(escapeHtml(t("viewBooking")), `${BASE}/dashboard?tab=bookings`)}
    <p style="margin-top:24px;font-size:12px;color:#8995a8">${escapeHtml(t("bookingQuestions"))}</p>
  `, locale, t("footer")));
}
