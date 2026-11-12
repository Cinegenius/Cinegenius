import { NextRequest, NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { verifyNewsletterUnsubscribeProof } from "@/lib/newsletter";

export async function POST(request: NextRequest) {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "NewsletterSignup" });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: t("unsubscribeInvalid") }, { status: 400 }); }
  const values = payload as { id?: unknown; proof?: unknown } | null;
  if (typeof values?.id !== "string" || typeof values.proof !== "string") {
    return NextResponse.json({ error: t("unsubscribeInvalid") }, { status: 400 });
  }
  try {
    if (!verifyNewsletterUnsubscribeProof(values.id, values.proof)) {
      return NextResponse.json({ error: t("unsubscribeInvalid") }, { status: 400 });
    }
    const { error } = await db.from("newsletter_subscriptions").update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
      .eq("id", values.id).eq("status", "confirmed");
    if (error !== null) return NextResponse.json({ error: t("actionError") }, { status: 503, headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("[newsletter-unsubscribe] unsubscribe request unavailable");
    return NextResponse.json({ error: t("actionError") }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ message: t("unsubscribed") }, { headers: { "Cache-Control": "no-store" } });
}
