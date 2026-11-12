import {getTranslations} from "next-intl/server";
import {type AppLocale} from "@/lib/i18n/locales";
import {recipientEmailLocale} from "@/lib/i18n/email-locale";
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
  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #222;border-radius:12px;overflow:hidden">
        <tr><td style="padding:24px 32px;border-bottom:1px solid #222">
          <span style="font-size:20px;font-weight:700;color:#d4a843;letter-spacing:-0.5px">CineGenius</span>
        </td></tr>
        <tr><td style="padding:32px">${content}</td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #222">
          <p style="margin:0;font-size:11px;color:#555">${escapeHtml(footer)} <a href="${BASE}" style="color:#d4a843;text-decoration:none">cinegenius.co</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(label: string, href: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#d4a843;color:#0a0a0a;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none">${label}</a>`;
}

function h1(text: string) {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f0f0f0">${text}</h1>`;
}

function p(text: string) {
  return `<p style="margin:0 0 4px;font-size:14px;color:#888;line-height:1.6">${text}</p>`;
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
    ${p(t.markup("friendRequestBody", {name: escapeHtml(fromName), person: chunks => `<strong style="color:#f0f0f0">${chunks}</strong>`}))}
    ${btn(escapeHtml(t("viewRequest")), `${BASE}/messages?requests=1`)}
  `, locale, t("footer")));
}

export async function sendFriendAcceptedEmail(to: string, accepterName: string, selected?: AppLocale) {
  const copy = await transactionalCopy(to, selected);
  if (!copy) return;
  const {locale, t} = copy;
  await send(to, t("friendAcceptedSubject", {name: normalizedEmailText(accepterName)}), wrap(`
    ${h1(escapeHtml(t("friendAcceptedHeading")))}
    ${p(t.markup("friendAcceptedBody", {name: escapeHtml(accepterName), person: chunks => `<strong style="color:#f0f0f0">${chunks}</strong>`}))}
    ${btn(escapeHtml(t("friendAcceptedAction")), `${BASE}/dashboard?tab=friends`)}
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

function messageEmailHtml(senderName: string, preview: string, hasMore: boolean, conversationId: string, locale: AppLocale, t: EmailTranslator) {
  const snippet = escapeHtml(preview);
  const siteUrl = escapeHtml(BASE);
  const chatUrl = new URL("/messages", BASE);
  chatUrl.searchParams.set("conv", conversationId);
  const chatHref = escapeHtml(chatUrl.toString());
  const preheader = escapeHtml(t("messagePreheader", {name: senderName}));

  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
</head>
<body style="margin:0;padding:0;background-color:#0e1016;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#f4f5f7">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0e1016" style="width:100%;background-color:#0e1016">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#171b24" style="width:100%;max-width:600px;background-color:#171b24;border:1px solid #29344a;border-radius:16px;overflow:hidden">
        <tr><td style="padding:22px 26px;border-bottom:1px solid #29344a">
          <a href="${siteUrl}" style="color:#ffffff;font-size:21px;font-weight:700;letter-spacing:-0.6px;text-decoration:none">
            <span style="color:#c2f135;font-size:25px;vertical-align:-1px">›</span> Cine<span style="color:#c2f135">Genius</span>
          </a>
        </td></tr>
        <tr><td style="padding:32px 26px 28px">
          <p style="margin:0 0 12px;color:#c2f135;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">${escapeHtml(t("messageLabel"))}</p>
          <h1 style="margin:0 0 10px;color:#f4f5f7;font-size:25px;line-height:1.25;font-weight:700">${escapeHtml(t("messageHeading", {name: senderName}))}</h1>
          <p style="margin:0 0 22px;color:#a7afbf;font-size:15px;line-height:1.6">${escapeHtml(t("messageIntro"))}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#10131b" style="width:100%;background-color:#10131b;border:1px solid #29344a;border-radius:12px">
            <tr><td style="padding:16px 18px;border-left:3px solid #c2f135;color:#d5d9e2;font-size:15px;line-height:1.65;word-break:break-word">
              ${snippet}${hasMore ? "…" : ""}
            </td></tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px">
            <tr><td align="center" bgcolor="#c2f135" style="background-color:#c2f135;border-radius:10px">
              <a href="${chatHref}" style="display:inline-block;padding:14px 22px;color:#10131b;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px">${escapeHtml(t("openChat"))}&nbsp;&nbsp;→</a>
            </td></tr>
          </table>
          <p style="margin:22px 0 0;color:#7e899d;font-size:12px;line-height:1.6">${escapeHtml(t("messageAuthHint"))}</p>
        </td></tr>
        <tr><td style="padding:18px 26px;border-top:1px solid #29344a">
          <p style="margin:0;color:#7e899d;font-size:12px;line-height:1.6">${escapeHtml(t("messageFooter"))} <a href="${siteUrl}" style="color:#c2f135;text-decoration:none">cinegenius.co</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
    ${p(t.markup("applicationBody", {name: escapeHtml(applicantName), person: chunks => `<strong style="color:#f0f0f0">${chunks}</strong>`}))}
    <p style="margin:16px 0;padding:12px 16px;background:#1a1a1a;border:1px solid #222;border-radius:8px;font-size:14px;color:#d4a843;font-weight:600">${escapeHtml(jobTitle)}</p>
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
      <tr><td style="padding:12px 16px;background:#1a1a1a;border:1px solid #222;border-radius:8px;margin-bottom:8px;display:block">
        <span style="font-size:13px;color:#f0f0f0;font-weight:600">1. ${escapeHtml(t("profileStep"))}</span><br/>
        <span style="font-size:12px;color:#666">${escapeHtml(t("profileStepDescription"))}</span>
      </td></tr><tr><td style="height:8px"></td></tr>
      <tr><td style="padding:12px 16px;background:#1a1a1a;border:1px solid #222;border-radius:8px">
        <span style="font-size:13px;color:#f0f0f0;font-weight:600">2. ${escapeHtml(t("listingStep"))}</span><br/>
        <span style="font-size:12px;color:#666">${escapeHtml(t("listingStepDescription"))}</span>
      </td></tr>
    </table>
    ${btn(escapeHtml(t("dashboard")), `${BASE}/dashboard?welcome=1`)}
    <p style="margin-top:24px;font-size:12px;color:#555">${escapeHtml(t("supportReply"))}</p>
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
  const ctaUrl = escapeHtml(copy.ctaUrl);
  const recommend = escapeHtml(copy.recommend);
  const instagramLabel = escapeHtml(copy.instagramLabel);
  const instagramUrl = escapeHtml(copy.instagramUrl);
  const signature = escapeHtml(copy.signature);
  const siteUrl = escapeHtml(BASE);
  const footer = test
    ? escapeHtml(copy.testFooter)
    : `${escapeHtml(copy.unsubscribeFooter)} <a href="${escapeHtml(unsubscribeUrl ?? BASE)}" style="color:#c2f135;text-decoration:underline">${escapeHtml(copy.unsubscribeLink)}</a>`;
  return `<!DOCTYPE html><html lang="${escapeHtml(locale)}"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="dark"/><meta name="supported-color-schemes" content="dark"/></head>
  <body style="margin:0;padding:0;background:#0e1016;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#f4f5f7">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e1016;padding:28px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#171b24;border:1px solid #29344a;border-radius:16px;overflow:hidden">
      <tr><td style="padding:22px 26px;border-bottom:1px solid #29344a"><a href="${siteUrl}" style="color:#f4f5f7;font-size:21px;font-weight:700;text-decoration:none"><span style="color:#c2f135;font-size:25px">›</span> Cine<span style="color:#c2f135">Genius</span></a></td></tr>
      <tr><td style="padding:30px 26px"><h1 style="margin:0 0 20px;color:#f4f5f7;font-size:25px;line-height:1.3">${heading || subject}</h1>${body}
        <a href="${ctaUrl}" style="display:inline-block;margin-top:8px;padding:13px 22px;background:#c2f135;color:#10131b;font-size:15px;font-weight:700;border-radius:10px;text-decoration:none">${ctaLabel}</a>
        <p style="margin:24px 0 12px;font-size:14px;color:#a7afbf;line-height:1.6">${recommend}</p><p style="margin:0 0 20px"><a href="${instagramUrl}" style="color:#c2f135;text-decoration:underline">${instagramLabel}</a></p><p style="margin:0;color:#f4f5f7;font-size:14px;font-weight:600">${signature}</p>
      </td></tr><tr><td style="padding:17px 26px;border-top:1px solid #29344a"><p style="margin:0;color:#7e899d;font-size:12px;line-height:1.6">${footer}</p></td></tr>
    </table></td></tr></table></body></html>`;
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
  if (!resend) return false;
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject: normalizedEmailText(copy.subject),
      replyTo: "support@cinegenius.co",
      html: `<!doctype html><html lang="${escapeHtml(locale)}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><body style="margin:0;background:#0e1016;color:#f4f5f7;font-family:Arial,sans-serif;padding:28px 12px"><table role="presentation" width="100%" style="max-width:580px;margin:auto;background:#171b24;border:1px solid #29344a;border-radius:14px"><tr><td style="padding:28px"><p style="color:#c2f135;font-weight:700">› CineGenius</p><h1 style="font-size:23px">${escapeHtml(copy.heading)}</h1><p style="color:#a7afbf;line-height:1.6">${escapeHtml(copy.body)}</p><a href="${escapeHtml(confirmationUrl)}" style="display:inline-block;padding:13px 20px;background:#c2f135;color:#10131b;border-radius:9px;font-weight:700;text-decoration:none">${escapeHtml(copy.button)}</a><p style="margin-top:24px;color:#7e899d;font-size:12px">${escapeHtml(copy.ignore)}</p></td></tr></table></body></html>`,
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
    <p style="margin:16px 0;padding:12px 16px;background:#1a1a1a;border:1px solid #222;border-radius:8px;font-size:14px;color:#d4a843;font-weight:600">${escapeHtml(listingTitle)}</p>
    <p style="margin:0 0 16px;font-size:13px;color:#888">${escapeHtml(t("bookingReference", {ref: bookingRef}))}</p>
    ${btn(escapeHtml(t("viewBooking")), `${BASE}/dashboard?tab=bookings`)}
    <p style="margin-top:24px;font-size:12px;color:#555">${escapeHtml(t("bookingQuestions"))}</p>
  `, locale, t("footer")));
}

export async function sendBookingConfirmedEmail(to: string, listingTitle: string, bookingRef: string, selected?: AppLocale) {
  const copy = await transactionalCopy(to, selected);
  if (!copy) return;
  const {locale, t} = copy;
  await send(to, t("bookingConfirmedSubject", {title: normalizedEmailText(listingTitle)}), wrap(`
    ${h1(escapeHtml(t("bookingConfirmedHeading")))}
    ${p(escapeHtml(t("bookingPaymentProcessed")))}
    <p style="margin:16px 0;padding:12px 16px;background:#1a1a1a;border:1px solid #222;border-radius:8px;font-size:14px;color:#d4a843;font-weight:600">${escapeHtml(listingTitle)}</p>
    <p style="margin:0 0 16px;font-size:13px;color:#888">${escapeHtml(t("bookingReference", {ref: bookingRef}))}</p>
    ${btn(escapeHtml(t("viewBooking")), `${BASE}/dashboard?tab=bookings`)}
    <p style="margin-top:24px;font-size:12px;color:#555">${escapeHtml(t("bookingQuestions"))}</p>
  `, locale, t("footer")));
}
