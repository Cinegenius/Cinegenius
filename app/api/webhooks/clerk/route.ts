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
          return new Response(`Resend error: ${JSON.stringify(result.error)}`, { status: 500 });
        }
      } catch (err) {
        return new Response(`Resend exception: ${String(err)}`, { status: 500 });
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

  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${headline}</title>
</head>
<body style="margin:0;padding:0;background-color:#0D0D0D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0D0D0D;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:40px;text-align:center;">
              <table cellpadding="0" cellspacing="0" border="0" style="display:inline-table;">
                <tr>
                  <td style="background:#C2F135;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;font-size:18px;line-height:36px;">
                    &#9654;
                  </td>
                  <td style="padding-left:10px;font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;vertical-align:middle;">
                    Cine<span style="color:#C2F135;">Genius</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background-color:#141414;border-radius:20px;border:1px solid #222222;overflow:hidden;">

              <!-- Top accent bar -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="height:3px;background:linear-gradient(90deg,#C2F135 0%,#8fbf00 100%);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Body -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:44px 44px 40px;">

                    <!-- Label -->
                    <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#C2F135;text-transform:uppercase;letter-spacing:3px;">${label}</p>

                    <!-- Welcome -->
                    <p style="margin:0 0 8px;font-size:15px;color:#888888;line-height:1.5;">${welcome}</p>

                    <!-- Headline -->
                    <h1 style="margin:0 0 20px;font-size:34px;font-weight:800;color:#FFFFFF;line-height:1.15;letter-spacing:-0.8px;">
                      ${headline}
                    </h1>

                    <!-- Subline -->
                    <p style="margin:0 0 36px;font-size:15px;color:#777777;line-height:1.7;">
                      ${subline}
                    </p>

                    <!-- OTP Box -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                      <tr>
                        <td style="background:#0D0D0D;border:1.5px solid #C2F135;border-radius:14px;padding:30px 20px;text-align:center;">
                          <span style="font-size:48px;font-weight:800;color:#C2F135;letter-spacing:14px;font-family:'Courier New',Courier,monospace;display:inline-block;padding-left:14px;">${escapeHtml(otp)}</span>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                      <tr><td style="height:1px;background:#1E1E1E;font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>

                    <!-- Security note -->
                    <p style="margin:0;font-size:13px;color:#444444;line-height:1.65;">
                      ${escapeHtml(t("otpIgnore"))}
                    </p>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#333333;line-height:1.7;">
                ${escapeHtml(t("brandFooter"))}<br/>
                <a href="https://cinegenius.co" style="color:#444444;text-decoration:none;">cinegenius.co</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildWelcomeEmail(firstName: string, locale: AppLocale, t: EmailTranslator): string {
  const name = firstName || t("anonymousGreeting");
  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(t("welcomeTitle"))}</title>
</head>
<body style="margin:0;padding:0;background-color:#0D0D0D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0D0D0D;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:40px;text-align:center;">
              <table cellpadding="0" cellspacing="0" border="0" style="display:inline-table;">
                <tr>
                  <td style="background:#C2F135;border-radius:8px;width:32px;height:32px;text-align:center;vertical-align:middle;font-size:16px;line-height:32px;">
                    &#9654;
                  </td>
                  <td style="padding-left:10px;font-size:20px;font-weight:700;color:#FFFFFF;letter-spacing:-0.3px;vertical-align:middle;">
                    Cine<span style="color:#C2F135;">Genius</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background-color:#141414;border-radius:20px;border:1px solid #222222;overflow:hidden;">

              <!-- Top accent bar -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="height:3px;background:linear-gradient(90deg,#C2F135 0%,#8fbf00 100%);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Body -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:44px 44px 0;">

                    <!-- Label -->
                    <p style="margin:0 0 20px;font-size:11px;font-weight:700;color:#C2F135;text-transform:uppercase;letter-spacing:3px;">${escapeHtml(t("welcomeLabel"))}</p>

                    <!-- Headline -->
                    <h1 style="margin:0 0 16px;font-size:36px;font-weight:800;color:#FFFFFF;line-height:1.15;letter-spacing:-0.8px;">
                      ${escapeHtml(t("welcomeGreetingShort", {name}))}
                    </h1>

                    <!-- Subline -->
                    <p style="margin:0 0 40px;font-size:16px;color:#888888;line-height:1.65;">
                      ${escapeHtml(t("welcomeDachIntro"))}
                    </p>

                    <!-- Divider -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                      <tr><td style="height:1px;background:#222222;font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>

                    <!-- Steps -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                      <tr>
                        <td style="padding-bottom:16px;">
                          <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="width:28px;vertical-align:top;padding-top:1px;">
                                <span style="display:inline-block;width:20px;height:20px;background:#C2F135;border-radius:50%;text-align:center;line-height:20px;font-size:11px;font-weight:800;color:#0D0D0D;">1</span>
                              </td>
                              <td style="padding-left:12px;">
                                <p style="margin:0;font-size:15px;font-weight:600;color:#FFFFFF;">${escapeHtml(t("profileStep"))}</p>
                                <p style="margin:3px 0 0;font-size:13px;color:#555555;line-height:1.5;">${escapeHtml(t("portfolioStepDescription"))}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:16px;">
                          <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="width:28px;vertical-align:top;padding-top:1px;">
                                <span style="display:inline-block;width:20px;height:20px;background:#C2F135;border-radius:50%;text-align:center;line-height:20px;font-size:11px;font-weight:800;color:#0D0D0D;">2</span>
                              </td>
                              <td style="padding-left:12px;">
                                <p style="margin:0;font-size:15px;font-weight:600;color:#FFFFFF;">${escapeHtml(t("firstListing"))}</p>
                                <p style="margin:3px 0 0;font-size:13px;color:#555555;line-height:1.5;">${escapeHtml(t("firstListingDescription"))}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="width:28px;vertical-align:top;padding-top:1px;">
                                <span style="display:inline-block;width:20px;height:20px;background:#C2F135;border-radius:50%;text-align:center;line-height:20px;font-size:11px;font-weight:800;color:#0D0D0D;">3</span>
                              </td>
                              <td style="padding-left:12px;">
                                <p style="margin:0;font-size:15px;font-weight:600;color:#FFFFFF;">${escapeHtml(t("discoverStep"))}</p>
                                <p style="margin:3px 0 0;font-size:13px;color:#555555;line-height:1.5;">${escapeHtml(t("discoverStepDescription"))}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <!-- CTA -->
                <tr>
                  <td style="padding:40px 44px 44px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background:#C2F135;border-radius:10px;">
                          <a href="https://cinegenius.co/dashboard" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#0D0D0D;text-decoration:none;letter-spacing:-0.2px;">
                            ${escapeHtml(t("dashboard"))} &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#333333;line-height:1.7;">
                ${escapeHtml(t("brandFooter"))}<br/>
                <a href="https://cinegenius.co" style="color:#444444;text-decoration:none;">cinegenius.co</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
