import {getTranslations} from "next-intl/server";
import {DEFAULT_LOCALE, type AppLocale} from "@/lib/i18n/locales";
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

function wrap(content: string) {
  return `<!DOCTYPE html>
<html lang="de">
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
          <p style="margin:0;font-size:11px;color:#555">Du erhältst diese E-Mail, weil du Mitglied auf CineGenius bist. <a href="${BASE}" style="color:#d4a843;text-decoration:none">cinegenius.co</a></p>
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

export async function sendFriendRequestEmail(to: string, fromName: string) {
  await send(
    to,
    `${fromName} möchte sich mit dir vernetzen`,
    wrap(`
      ${h1("Neue Freundschaftsanfrage")}
      ${p(`<strong style="color:#f0f0f0">${fromName}</strong> möchte sich mit dir auf CineGenius vernetzen.`)}
      ${btn("Anfrage ansehen", `${BASE}/dashboard?tab=friends`)}
    `)
  );
}

export async function sendFriendAcceptedEmail(to: string, accepterName: string) {
  await send(
    to,
    `${accepterName} hat deine Anfrage angenommen`,
    wrap(`
      ${h1("Freundschaftsanfrage angenommen")}
      ${p(`<strong style="color:#f0f0f0">${accepterName}</strong> hat deine Anfrage angenommen. Ihr seid jetzt verbunden.`)}
      ${btn("Zum Profil", `${BASE}/dashboard?tab=friends`)}
    `)
  );
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

function messageEmailHtml(senderName: string, preview: string, hasMore: boolean, conversationId: string) {
  const sender = escapeHtml(senderName);
  const snippet = escapeHtml(preview);
  const siteUrl = escapeHtml(BASE);
  const chatUrl = new URL("/messages", BASE);
  chatUrl.searchParams.set("conv", conversationId);
  const chatHref = escapeHtml(chatUrl.toString());
  const preheader = escapeHtml(`${senderName} hat dir auf CineGenius geschrieben.`);

  return `<!DOCTYPE html>
<html lang="de">
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
          <p style="margin:0 0 12px;color:#c2f135;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Neue Nachricht</p>
          <h1 style="margin:0 0 10px;color:#f4f5f7;font-size:25px;line-height:1.25;font-weight:700">${sender} hat dir geschrieben</h1>
          <p style="margin:0 0 22px;color:#a7afbf;font-size:15px;line-height:1.6">Du hast eine neue Nachricht in deinem CineGenius-Chat.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#10131b" style="width:100%;background-color:#10131b;border:1px solid #29344a;border-radius:12px">
            <tr><td style="padding:16px 18px;border-left:3px solid #c2f135;color:#d5d9e2;font-size:15px;line-height:1.65;word-break:break-word">
              ${snippet}${hasMore ? "…" : ""}
            </td></tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px">
            <tr><td align="center" bgcolor="#c2f135" style="background-color:#c2f135;border-radius:10px">
              <a href="${chatHref}" style="display:inline-block;padding:14px 22px;color:#10131b;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px">Chat öffnen&nbsp;&nbsp;→</a>
            </td></tr>
          </table>
          <p style="margin:22px 0 0;color:#7e899d;font-size:12px;line-height:1.6">Falls du nicht angemeldet bist, wirst du zuerst zur Anmeldung weitergeleitet und danach zurück zum Chat.</p>
        </td></tr>
        <tr><td style="padding:18px 26px;border-top:1px solid #29344a">
          <p style="margin:0;color:#7e899d;font-size:12px;line-height:1.6">Du erhältst diese E-Mail, weil E-Mail-Benachrichtigungen für neue Nachrichten aktiviert sind. <a href="${siteUrl}" style="color:#c2f135;text-decoration:none">cinegenius.co</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendNewMessageEmail(to: string, fromName: string, preview: string, conversationId: string) {
  const safeName = Array.from(normalizedEmailText(fromName)).slice(0, 100).join("") || "Jemand";
  const previewCharacters = Array.from(normalizedEmailText(preview));
  const safePreview = previewCharacters.slice(0, 200).join("");
  const html = messageEmailHtml(safeName, safePreview, previewCharacters.length > 200, conversationId);

  await send(
    to,
    `Neue Nachricht von ${safeName}`,
    html,
  );
}

export async function sendNewApplicationEmail(to: string, applicantName: string, jobTitle: string) {
  await send(
    to,
    `Neue Bewerbung für „${jobTitle}"`,
    wrap(`
      ${h1("Neue Bewerbung erhalten")}
      ${p(`<strong style="color:#f0f0f0">${applicantName}</strong> hat sich auf dein Inserat beworben:`)}
      <p style="margin:16px 0;padding:12px 16px;background:#1a1a1a;border:1px solid #222;border-radius:8px;font-size:14px;color:#d4a843;font-weight:600">${jobTitle}</p>
      ${btn("Bewerbung ansehen", `${BASE}/dashboard?tab=messages`)}
    `)
  );
}

export async function sendWelcomeEmail(to: string, displayName: string) {
  await send(
    to,
    "Willkommen bei CineGenius 🎬",
    wrap(`
      ${h1(`Hallo ${displayName} — schön, dass du dabei bist!`)}
      ${p("CineGenius ist der Marktplatz für Film, Foto und Content — Locations, Crew, Equipment und Jobs.")}
      ${p("Hier sind deine nächsten Schritte:")}
      <table style="margin:20px 0;width:100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:12px 16px;background:#1a1a1a;border:1px solid #222;border-radius:8px;margin-bottom:8px;display:block">
            <span style="font-size:13px;color:#f0f0f0;font-weight:600">1. Profil vervollständigen</span><br/>
            <span style="font-size:12px;color:#666">Foto, Bio und Fähigkeiten — damit du gefunden wirst.</span>
          </td>
        </tr>
        <tr><td style="height:8px"></td></tr>
        <tr>
          <td style="padding:12px 16px;background:#1a1a1a;border:1px solid #222;border-radius:8px">
            <span style="font-size:13px;color:#f0f0f0;font-weight:600">2. Inserat erstellen oder Crew entdecken</span><br/>
            <span style="font-size:12px;color:#666">Location, Equipment oder Fahrzeug inserieren — oder direkt Crew und Jobs durchsuchen.</span>
          </td>
        </tr>
      </table>
      ${btn("Zum Dashboard", `${BASE}/dashboard?welcome=1`)}
      <p style="margin-top:24px;font-size:12px;color:#555">Fragen? Antworte einfach auf diese E-Mail.</p>
    `)
  );
}

export async function sendNewBookingEmail(to: string, listingTitle: string, guestName: string, locale: AppLocale = DEFAULT_LOCALE) {
  const t = await getTranslations({locale, namespace: "BookingRequest"});
  await send(
    to,
    t("incomingSubject", {title: listingTitle}),
    wrap(`
      ${h1(escapeHtml(t("incomingTitle")))}
      ${p(escapeHtml(t("incomingBody", {name: guestName, title: listingTitle})))}
      ${p(escapeHtml(t("requestOnly")))}
      ${btn(escapeHtml(t("viewRequest")), `${BASE}/dashboard?tab=bookings`)}
    `)
  );
}

export async function sendBookingConfirmedEmail(to: string, listingTitle: string, bookingRef: string) {
  await send(
    to,
    `Buchung bestätigt: „${listingTitle}"`,
    wrap(`
      ${h1("Deine Buchung ist bestätigt!")}
      ${p("Deine Zahlung wurde erfolgreich verarbeitet. Hier sind deine Buchungsdetails:")}
      <p style="margin:16px 0;padding:12px 16px;background:#1a1a1a;border:1px solid #222;border-radius:8px;font-size:14px;color:#d4a843;font-weight:600">${listingTitle}</p>
      <p style="margin:0 0 16px;font-size:13px;color:#888">Buchungsreferenz: <strong style="color:#f0f0f0">${bookingRef}</strong></p>
      ${btn("Buchung ansehen", `${BASE}/dashboard?tab=bookings`)}
      <p style="margin-top:24px;font-size:12px;color:#555">Fragen? Kontaktiere den Anbieter direkt über die Nachrichtenfunktion.</p>
    `)
  );
}
