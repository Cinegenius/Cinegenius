import { clerkClient } from "@clerk/nextjs/server";
import { getLocale, getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { finishAdminAudit, startAdminAudit } from "@/lib/admin-audit";
import { sendNewsletterTestEmail } from "@/lib/email";

export async function POST() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const limit = await rateLimit(`admin-newsletter-test:${admin.userId}`, 1, 60);
  if (!limit.allowed) return NextResponse.json({ error: await (await getTranslations("AdminNewsletter"))("rateLimited") }, { status: 429 });

  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "AdminNewsletter" });
  let email: string;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(admin.userId);
    const primary = user.emailAddresses.find(address => address.id === user.primaryEmailAddressId);
    if (!primary || primary.verification?.status !== "verified") {
      return NextResponse.json({ error: t("verifiedEmailRequired") }, { status: 409 });
    }
    email = primary.emailAddress;
  } catch {
    return NextResponse.json({ error: t("sendError") }, { status: 503 });
  }

  const audit = await startAdminAudit({
    actorUserId: admin.userId,
    action: "newsletter_test_send",
    entityType: "newsletter_test",
    entityId: admin.userId,
    reason: "Testmail ausschließlich an die eigene bestätigte Adminadresse",
    metadata: { locale },
  });
  if (!audit) return NextResponse.json({ error: t("auditUnavailable") }, { status: 503 });

  const result = await sendNewsletterTestEmail(email, {
    subject: t("subject"),
    greeting: t("greeting"),
    community: t("community"),
    offers: t("offers"),
    feedback: t("feedback"),
    visitCta: t("visitCta"),
    recommend: t("recommend"),
    instagramCta: t("instagramCta"),
    closing: t("closing"),
    signature: t("signature"),
    footer: t("emailFooter"),
  });
  if (!result.ok) {
    await finishAdminAudit(audit, "failed");
    const key = result.reason === "not_configured" ? "emailNotConfigured" : "sendError";
    return NextResponse.json({ error: t(key) }, { status: result.reason === "not_configured" ? 503 : 502 });
  }

  const auditLogged = await finishAdminAudit(audit, "succeeded");
  return NextResponse.json({ success: true, email, auditLogged }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
