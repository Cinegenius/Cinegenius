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
  if (typeof values?.id !== "string" || typeof values.proof !== "string" || !verifyNewsletterUnsubscribeProof(values.id, values.proof)) {
    return NextResponse.json({ error: t("unsubscribeInvalid") }, { status: 400 });
  }
  const { error } = await db.from("newsletter_subscriptions").update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("id", values.id).eq("status", "confirmed");
  if (error) return NextResponse.json({ error: t("unsubscribeInvalid") }, { status: 503 });
  return NextResponse.json({ message: t("unsubscribed") }, { headers: { "Cache-Control": "no-store" } });
}
