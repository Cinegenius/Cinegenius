import { getCurrentUser } from "@/lib/auth";
import { appLocale, DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { getLocale } from "next-intl/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });

/** Current-request identity only; no profile or Workspace data is needed to enter Community. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: "unauthorized" }, 401);
    const locale = appLocale(await getLocale()) ?? DEFAULT_LOCALE;
    return json({ userId: user.userId, locale });
  } catch {
    return json({ error: "unavailable" }, 503);
  }
}
