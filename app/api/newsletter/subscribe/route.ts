import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { sendNewsletterConfirmationEmail } from "@/lib/email";
import { hashNewsletterToken, normalizeNewsletterEmail } from "@/lib/newsletter";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "NewsletterSignup" });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const identity = createHash("sha256").update(ip).digest("hex").slice(0, 24);
  const limit = await rateLimit(`newsletter-signup:${identity}`, 5, 3600);
  if (!limit.allowed) return NextResponse.json({ error: t("rateLimited") }, { status: 429, headers: { "Cache-Control": "no-store" } });

  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: t("invalidRequest") }, { status: 400 }); }
  const data = payload as { email?: unknown; consent?: unknown } | null;
  const email = normalizeNewsletterEmail(data?.email);
  if (!email || data?.consent !== true) return NextResponse.json({ error: t("invalidRequest") }, { status: 400 });

  // Never look up or import Clerk users here. Only the address explicitly typed into this form is used.
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { data: requestStatus, error } = await db.rpc("newsletter_request_confirmation", {
    p_email: email,
    p_confirmation_token_hash: hashNewsletterToken(token),
    p_confirmation_expires_at: expiresAt,
    p_consent_version: "2026-11-02",
    p_consent_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: t("submitError") }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (requestStatus === "confirmed") return NextResponse.json({ message: t("genericResponse") }, { headers: { "Cache-Control": "no-store" } });
  {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.cinegenius.co";
    const confirmationUrl = new URL("/newsletter/confirm", base);
    confirmationUrl.searchParams.set("token", token);
    const sent = await sendNewsletterConfirmationEmail(email, confirmationUrl.toString(), {
      subject: t("confirmSubject"), heading: t("confirmHeading"), body: t("confirmBody"),
      button: t("confirmButton"), ignore: t("confirmIgnore"),
    }, locale);
    if (!sent) return NextResponse.json({ error: t("submitError") }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  // Same answer whether the address exists in the newsletter list or not.
  return NextResponse.json({ message: t("genericResponse") }, { headers: { "Cache-Control": "no-store" } });
}
