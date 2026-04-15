import { Resend } from "resend";

// Gracefully degrade if RESEND_API_KEY is not set
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = "CineGenius <noreply@cinegenius.com>";
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://cinegenius.com";

// Send an email — silently skips if Resend is not configured
async function send(to: string, subject: string, html: string) {
  if (!resend) return;
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch {
    // Never let email failures bubble up to the caller
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
          <p style="margin:0;font-size:11px;color:#555">Du erhältst diese E-Mail, weil du Mitglied auf CineGenius bist. <a href="${BASE}" style="color:#d4a843;text-decoration:none">cinegenius.com</a></p>
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

export async function sendNewMessageEmail(to: string, fromName: string, preview: string, conversationId: string) {
  await send(
    to,
    `Neue Nachricht von ${fromName}`,
    wrap(`
      ${h1("Neue Nachricht")}
      ${p(`<strong style="color:#f0f0f0">${fromName}</strong> hat dir geschrieben:`)}
      <blockquote style="margin:16px 0;padding:12px 16px;background:#1a1a1a;border-left:3px solid #d4a843;border-radius:4px;font-size:14px;color:#ccc;line-height:1.5">
        ${preview.slice(0, 200)}${preview.length > 200 ? "…" : ""}
      </blockquote>
      ${btn("Antworten", `${BASE}/messages`)}
    `)
  );
}

export async function sendNewBookingEmail(to: string, listingTitle: string, guestName: string) {
  await send(
    to,
    `Neue Buchungsanfrage für „${listingTitle}"`,
    wrap(`
      ${h1("Neue Buchungsanfrage")}
      ${p(`<strong style="color:#f0f0f0">${guestName}</strong> hat eine Buchungsanfrage für dein Inserat gesendet:`)}
      <p style="margin:16px 0;padding:12px 16px;background:#1a1a1a;border:1px solid #222;border-radius:8px;font-size:14px;color:#d4a843;font-weight:600">${listingTitle}</p>
      ${btn("Anfrage ansehen", `${BASE}/dashboard?tab=bookings`)}
    `)
  );
}
