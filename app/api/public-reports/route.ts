import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { sendPublicReportEmails } from "@/lib/email";
import { isAppLocale, type AppLocale } from "@/lib/i18n/locales";
import { validatePublicReport, type PublicReportCategory } from "@/lib/public-report";
import { rateLimit } from "@/lib/rateLimit";
import { trustedMutationOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = {
  headers: {
    "Cache-Control": "private, no-store, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  },
};

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, ...noStore });
}

function requesterBucket(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function POST(request: NextRequest) {
  const t = await getTranslations("PublicReport");
  if (!trustedMutationOrigin({
    requestUrl: request.url,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    development: process.env.NODE_ENV !== "production",
    deploymentHost: process.env.VERCEL_URL,
  })) return json({ error: t("errors.invalid") }, 403);

  const { allowed } = await rateLimit(`public-report:${requesterBucket(request)}`, 5, 60 * 60);
  if (!allowed) return json({ error: t("errors.rateLimited") }, 429);

  const body = await request.json().catch(() => null);
  const validated = validatePublicReport({
    target: body?.target,
    category: body?.category,
    details: body?.details,
    reporterName: body?.reporterName,
    reporterEmail: body?.reporterEmail,
    goodFaith: body?.goodFaith,
  });
  if (!validated.ok) return json({ error: t(`errors.${validated.error}`) }, 400);

  const locale: AppLocale = isAppLocale(body?.locale) ? body.locale : "de";
  const email = await getTranslations({ locale, namespace: "PublicReportEmail" });
  const categoryLabel = t(`categories.${validated.value.category as PublicReportCategory}`);
  const sent = await sendPublicReportEmails(validated.value, {
    subject: email("subject"),
    heading: email("heading"),
    intro: email("intro"),
    reference: email("reference"),
    next: email("next"),
    footer: email("footer"),
  }, categoryLabel);

  if (!sent.operatorSent) return json({ error: t("errors.send") }, 503);
  return json({ ok: true, reference: sent.reference, receiptSent: sent.receiptSent });
}
