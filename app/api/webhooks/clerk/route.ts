import {emailLayout, emailButton} from "@/lib/email-layout";
import {getTranslations} from "next-intl/server";
import {recipientEmailLocale} from "@/lib/i18n/email-locale";
import {appLocale, type AppLocale} from "@/lib/i18n/locales";
type EmailTranslator = Awaited<ReturnType<typeof getTranslations>>;
function escapeHtml(text: string) { return text.replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!)); }
function normalizedEmailHeader(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}
function validOtp(value: unknown): string | null {
  return typeof value === "string" && /^\d{6}$/.test(value) ? value : null;
}
import { Webhook } from "svix";
import { headers } from "next/headers";
import { Resend } from "resend";
import { requestErasure } from "@/lib/account-erasure-server";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Missing CLERK_WEBHOOK_SECRET", { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(secret);

  let event: { type: string; data: Record<string, unknown> };
  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof event;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  // A provider-side deletion must be persisted before acknowledging its webhook.
  // Duplicate deliveries reuse the same request; no unsigned event can reach it.
  if (event.type === "user.deleted") {
    if (!event.data || typeof event.data !== "object" || typeof event.data.id !== "string" || !/^[A-Za-z0-9_-]{3,128}$/.test(event.data.id)) {
      return new Response(null, {status: 400, headers: {"Cache-Control":"no-store"}});
    }
    try { await requestErasure(event.data.id, "deleted_webhook"); }
    catch { return new Response(null, {status: 503, headers: {"Cache-Control":"no-store"}}); }
    return new Response("OK", {status: 200, headers: {"Cache-Control":"no-store"}});
  }

  // Clerk verification/invitation emails — fired when "Delivered by Clerk" is OFF
  if (event.type === "email.created") {
    const e = event.data as {
      to_email_address?: string;
      user_id?: string | null;
      locale?: string | null;
      subject?: string;
      body?: string;
      from_email_name?: string;
      slug?: string;
      data?: Record<string, unknown>;
    };

    if (e.to_email_address && e.subject) {
      if (!resend) {
        return new Response("Missing RESEND_API_KEY", { status: 500 });
      }

      let html = e.body ?? "";
      let subject = e.subject;
      const dataUser = e.data?.user && typeof e.data.user === "object" ? e.data.user as Record<string, unknown> : null;
      const hint = appLocale(e.locale) ?? appLocale(e.data?.locale) ?? appLocale(dataUser?.locale);
      const locale = await recipientEmailLocale(e.to_email_address, e.user_id, hint);
      const copy = await getTranslations({locale, namespace: "TransactionalEmail"});

      if (e.slug === "verification_code" || e.slug === "reset_password_code") {
        const otp =
          validOtp(e.data?.otp_code) ??
          validOtp(e.data?.code) ??
          extractOtp(e.body ?? "");
        if (otp) {
          subject = copy(e.slug === "reset_password_code" ? "otpPasswordHeading" : "otpVerificationLabel");
          html =
            e.slug === "reset_password_code"
              ? buildOtpEmail(otp, "password", locale, copy)
              : buildOtpEmail(otp, "verification", locale, copy);
        }
      }

      try {
        const result = await resend.emails.send({
          from: "CineGenius <noreply@cinegenius.co>",
          to: e.to_email_address,
          subject,
          html,
        });
        if (result.error) {
          const failure = await getTranslations({locale, namespace: "System"});
          return new Response(failure("requestFailed"), { status: 500, headers: {"Cache-Control": "no-store"} });
        }
      } catch {
        const failure = await getTranslations({locale, namespace: "System"});
        return new Response(failure("requestFailed"), { status: 500, headers: {"Cache-Control": "no-store"} });
      }
    }
    return new Response("OK", { status: 200 });
  }

  if (event.type === "user.created") {
    const user = event.data as {
      email_addresses?: { email_address: string; id: string }[];
      primary_email_address_id?: string;
      first_name?: string;
      id?: string;
      locale?: string | null;
    };

    const primaryEmail = user.email_addresses?.find(
      (e) => e.id === user.primary_email_address_id
    )?.email_address ?? user.email_addresses?.[0]?.email_address;

    const firstName = user.first_name ?? "";
    const subjectName = normalizedEmailHeader(firstName);

    if (primaryEmail && resend) {
      const locale = await recipientEmailLocale(primaryEmail, user.id, user.locale);
      const copy = await getTranslations({locale, namespace: "TransactionalEmail"});
      await resend.emails.send({
        from: "CineGenius <willkommen@cinegenius.co>",
        to: primaryEmail,
        subject: subjectName ? copy("welcomeAccountNamedSubject", {name: subjectName}) : copy("welcomeAccountSubject"),
        html: buildWelcomeEmail(firstName, locale, copy),
        headers: {
          "X-Entity-Ref-ID": `welcome-${Date.now()}`,
          "Precedence": "bulk",
        },
      });
    }
  }

  return new Response("OK", { status: 200 });
}

function extractOtp(body: string): string | null {
  const match = body.match(/(?<!\d)(\d{6})(?!\d)/);
  return match?.[1] ?? null;
}

function buildOtpEmail(otp: string, type: "verification" | "password", locale: AppLocale, t: EmailTranslator): string {
  const isPassword = type === "password";

  const welcome = escapeHtml(t(isPassword ? "otpPasswordWelcome" : "otpVerificationWelcome"));
  const headline = escapeHtml(t(isPassword ? "otpPasswordHeading" : "otpVerificationHeading"));
  const subline = isPassword
    ? t.markup("otpPasswordBody", {duration: chunks => `<strong style="color:#EFEFEF;">${chunks}</strong>`})
    : escapeHtml(t("otpVerificationBody"));
  const label = escapeHtml(t(isPassword ? "otpPasswordLabel" : "otpVerificationLabel"));

  return emailLayout(`
    <p style="margin:0 0 16px;color:#c2f135;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">${label}</p>
    <p style="margin:0 0 8px;color:#b2bbc8;font-size:15px;line-height:1.6">${welcome}</p>
    <h1 style="margin:0 0 16px;color:#f0f2f5;font-size:25px;line-height:1.3">${headline}</h1>
    <p style="margin:0 0 22px;color:#b2bbc8;font-size:15px;line-height:1.7">${subline}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;background:#1e2330;border:1px solid #c2f135;border-radius:12px"><tr><td style="padding:22px 8px;text-align:center"><span style="color:#c2f135;font-size:32px;line-height:40px;font-weight:700;letter-spacing:4px;font-family:'Courier New',monospace">${escapeHtml(otp)}</span></td></tr></table>
    <p style="margin:22px 0 0;color:#8995a8;font-size:13px;line-height:1.65">${escapeHtml(t("otpIgnore"))}</p>
  `, {locale, title: t(isPassword ? "otpPasswordHeading" : "otpVerificationHeading"), footerHtml: escapeHtml(t("brandFooter"))});
}

function buildWelcomeEmail(firstName: string, locale: AppLocale, t: EmailTranslator): string {
  const name = firstName || t("anonymousGreeting");
  const steps = [["profileStep", "portfolioStepDescription"], ["firstListing", "firstListingDescription"], ["discoverStep", "discoverStepDescription"]];
  return emailLayout(`
    <p style="margin:0 0 16px;color:#c2f135;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">${escapeHtml(t("welcomeLabel"))}</p>
    <h1 style="margin:0 0 16px;color:#f0f2f5;font-size:25px;line-height:1.3">${escapeHtml(t("welcomeGreetingShort", {name}))}</h1>
    <p style="margin:0 0 22px;color:#b2bbc8;font-size:15px;line-height:1.65">${escapeHtml(t("welcomeDachIntro"))}</p>
    ${steps.map(([heading, description], index) => `<p style="margin:18px 0 4px;color:#f0f2f5;font-size:15px;font-weight:600"><span style="color:#c2f135">${index+1}.</span> ${escapeHtml(t(heading))}</p><p style="margin:0;color:#b2bbc8;font-size:14px;line-height:1.6">${escapeHtml(t(description))}</p>`).join("")}
    ${emailButton(escapeHtml(t("dashboard")), "https://cinegenius.co/dashboard")}
  `, {locale, title: t("welcomeTitle"), footerHtml: escapeHtml(t("brandFooter"))});
}
