import { Webhook } from "svix";
import { headers } from "next/headers";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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

  if (event.type === "user.created") {
    const user = event.data as {
      email_addresses?: { email_address: string; id: string }[];
      primary_email_address_id?: string;
      first_name?: string;
    };

    const primaryEmail = user.email_addresses?.find(
      (e) => e.id === user.primary_email_address_id
    )?.email_address ?? user.email_addresses?.[0]?.email_address;

    const firstName = user.first_name ?? "";

    if (primaryEmail) {
      await resend.emails.send({
        from: "CineGenius <willkommen@cinegenius.co>",
        to: primaryEmail,
        subject: "Willkommen bei CineGenius",
        html: buildWelcomeEmail(firstName),
      });
    }
  }

  return new Response("OK", { status: 200 });
}

function buildWelcomeEmail(firstName: string): string {
  const name = firstName || "Hey";
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Willkommen bei CineGenius</title>
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
                    <p style="margin:0 0 20px;font-size:11px;font-weight:700;color:#C2F135;text-transform:uppercase;letter-spacing:3px;">Willkommen</p>

                    <!-- Headline -->
                    <h1 style="margin:0 0 16px;font-size:36px;font-weight:800;color:#FFFFFF;line-height:1.15;letter-spacing:-0.8px;">
                      ${name},<br/>schön dass du dabei bist.
                    </h1>

                    <!-- Subline -->
                    <p style="margin:0 0 40px;font-size:16px;color:#888888;line-height:1.65;">
                      Der Marktplatz für Film, Social Media und Fotografie im DACH-Raum. Locations, Crew, Equipment, Jobs — alles an einem Ort.
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
                                <p style="margin:0;font-size:15px;font-weight:600;color:#FFFFFF;">Profil vervollständigen</p>
                                <p style="margin:3px 0 0;font-size:13px;color:#555555;line-height:1.5;">Lade dein Portfolio hoch und werde von Produktionen gefunden.</p>
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
                                <p style="margin:0;font-size:15px;font-weight:600;color:#FFFFFF;">Erstes Inserat erstellen</p>
                                <p style="margin:3px 0 0;font-size:13px;color:#555555;line-height:1.5;">Location, Equipment, Job oder Requisite — kostenlos inserieren.</p>
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
                                <p style="margin:0;font-size:15px;font-weight:600;color:#FFFFFF;">Crew &amp; Locations entdecken</p>
                                <p style="margin:3px 0 0;font-size:13px;color:#555555;line-height:1.5;">Durchsuche Profile, Locations und Equipment für dein nächstes Projekt.</p>
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
                            Zum Dashboard &rarr;
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
                CineGenius &middot; Marktplatz für Film &amp; Medien<br/>
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
