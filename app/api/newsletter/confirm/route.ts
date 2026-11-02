import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { hashNewsletterToken } from "@/lib/newsletter";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "NewsletterSignup" });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const identity = createHash("sha256").update(ip).digest("hex").slice(0, 24);
  const limit = await rateLimit(`newsletter-confirm:${identity}`, 10, 600);
  if (!limit.allowed) return NextResponse.json({ error: t("confirmInvalid") }, { status: 429 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: t("confirmInvalid") }, { status: 400 }); }
  const token = (payload as { token?: unknown } | null)?.token;
  if (typeof token !== "string" || token.length < 32 || token.length > 128) return NextResponse.json({ error: t("confirmInvalid") }, { status: 400 });
  const { data, error } = await db.from("newsletter_subscriptions").update({
    status: "confirmed", confirmation_token_hash: null, confirmation_expires_at: null, confirmed_at: new Date().toISOString(),
  }).eq("status", "pending").eq("confirmation_token_hash", hashNewsletterToken(token))
    .gt("confirmation_expires_at", new Date().toISOString()).select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: t("confirmInvalid") }, { status: 400 });
  return NextResponse.json({ message: t("confirmed") }, { headers: { "Cache-Control": "no-store" } });
}
