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
      last_name?: string;
    };

    const primaryEmail = user.email_addresses?.find(
      (e) => e.id === user.primary_email_address_id
    )?.email_address ?? user.email_addresses?.[0]?.email_address;

    const firstName = user.first_name ?? "";

    if (primaryEmail) {
      await resend.emails.send({
        from: "CineGenius <willkommen@cinegenius.co>",
        to: primaryEmail,
        subject: "Willkommen bei CineGenius 🎬",
        html: buildWelcomeEmail(firstName),
      });
    }
  }

  return new Response("OK", { status: 200 });
}

function buildWelcomeEmail(firstName: string): string {
  const name = firstName ? firstName : "Hey";
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Willkommen bei CineGenius</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#C2F135;border-radius:10px;width:40px;height:40px;text-align:center;vertical-align:middle;font-size:22px;">
                    ▶
                  </td>
                  <td style="padding-left:12px;font-size:24px;font-weight:700;color:#FFFFFF;">
                    Cine<span style="color:#C2F135;">Genius</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="background:#141414;border-radius:16px;padding:40px 36px;border:1px solid #222;">
              <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#C2F135;text-transform:uppercase;letter-spacing:2px;">Willkommen</p>
              <h1 style="margin:0 0 16px;font-size:32px;font-weight:700;color:#FFFFFF;line-height:1.2;">
                ${name}, schön dass du dabei bist!
              </h1>
              <p style="margin:0 0 28px;font-size:16px;color:rgba(255,255,255,0.6);line-height:1.6;">
                CineGenius ist der Marktplatz für Film, Social Media und Fotografie im DACH-Raum. Hier findest du alles was du für deine Produktion brauchst — oder wirst selbst gefunden.
              </p>

              <!-- Steps -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:16px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1A1A1A;border-radius:10px;padding:16px;border:1px solid #2A2A2A;">
                      <tr>
                        <td style="width:36px;vertical-align:top;">
                          <div style="background:#C2F135;border-radius:8px;width:28px;height:28px;text-align:center;line-height:28px;font-size:14px;font-weight:700;color:#0A0A0A;">1</div>
                        </td>
                        <td style="padding-left:12px;">
                          <p style="margin:0;font-size:15px;font-weight:600;color:#FFFFFF;">Profil vervollständigen</p>
                          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">Lade dein Portfolio hoch und werde gefunden.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:16px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1A1A1A;border-radius:10px;padding:16px;border:1px solid #2A2A2A;">
                      <tr>
                        <td style="width:36px;vertical-align:top;">
                          <div style="background:#C2F135;border-radius:8px;width:28px;height:28px;text-align:center;line-height:28px;font-size:14px;font-weight:700;color:#0A0A0A;">2</div>
                        </td>
                        <td style="padding-left:12px;">
                          <p style="margin:0;font-size:15px;font-weight:600;color:#FFFFFF;">Inserat erstellen</p>
                          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">Location, Equipment, Job oder Requisite anbieten.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1A1A1A;border-radius:10px;padding:16px;border:1px solid #2A2A2A;">
                      <tr>
                        <td style="width:36px;vertical-align:top;">
                          <div style="background:#C2F135;border-radius:8px;width:28px;height:28px;text-align:center;line-height:28px;font-size:14px;font-weight:700;color:#0A0A0A;">3</div>
                        </td>
                        <td style="padding-left:12px;">
                          <p style="margin:0;font-size:15px;font-weight:600;color:#FFFFFF;">Crew & Locations finden</p>
                          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">Durchsuche Tausende Profile und Inserate.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td align="center">
                    <a href="https://cinegenius.co/dashboard" style="display:inline-block;background:#C2F135;color:#0A0A0A;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;">
                      Zum Dashboard →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);">
                CineGenius · Der Marktplatz für Film & Medien im DACH-Raum<br/>
                <a href="https://cinegenius.co" style="color:rgba(255,255,255,0.25);text-decoration:underline;">cinegenius.co</a>
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
