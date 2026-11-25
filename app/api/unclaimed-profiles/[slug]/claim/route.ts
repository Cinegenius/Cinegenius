import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

// A session does not establish ownership of an unclaimed identity. Keep this
// endpoint closed until a verified, atomic credit-transfer workflow exists.
export async function POST() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const t = await getTranslations("PrivacyReview");
  return NextResponse.json({ error: t("claimReview") }, {
    status: 403,
    headers: { "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" },
  });
}
