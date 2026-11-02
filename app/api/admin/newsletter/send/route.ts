import { NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { db } from "@/lib/db";
import { finishAdminAudit, startAdminAudit } from "@/lib/admin-audit";
import { sendNewsletterCampaignBatch } from "@/lib/email";
import { NEWSLETTER_BATCH_SIZE, NEWSLETTER_MAX_CAMPAIGN_SIZE, newsletterUnsubscribeProof, validateNewsletterCopy } from "@/lib/newsletter";
import { rateLimit } from "@/lib/rateLimit";

type Subscription = { id: string; email: string };
type Delivery = { subscription_id: string; chunk_index: number; status: "pending" | "sent" | "skipped" };
type Campaign = { id: string; created_by: string; status: string; locale: string; recipient_count: number; subject: string; heading: string; body: string; cta_label: string; cta_url: string; recommend: string; instagram_label: string; instagram_url: string; signature: string };

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const limit = await rateLimit(`admin-newsletter-send:${admin.userId}`, 1, 60);
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "AdminNewsletter" });
  if (!limit.allowed) return NextResponse.json({ error: t("rateLimited") }, { status: 429 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: t("invalidCopy") }, { status: 400 }); }
  const values = payload as { campaignId?: unknown; copy?: unknown } | null;
  if (typeof values?.campaignId !== "string" || !/^[0-9a-f-]{36}$/i.test(values.campaignId)) return NextResponse.json({ error: t("invalidCopy") }, { status: 400 });
  const copy = validateNewsletterCopy(values.copy);
  if (!copy) return NextResponse.json({ error: t("invalidCopy") }, { status: 400 });

  const audit = await startAdminAudit({ actorUserId: admin.userId, action: "newsletter_campaign_send", entityType: "newsletter_campaign", entityId: values.campaignId, reason: "Manuell bestätigter Versand an bestätigte Newsletter-Abonnements", metadata: { locale } });
  if (!audit) return NextResponse.json({ error: t("auditUnavailable") }, { status: 503 });

  let campaign: Campaign | null = null;
  const campaignFields = "id,created_by,status,locale,recipient_count,subject,heading,body,cta_label,cta_url,recommend,instagram_label,instagram_url,signature";
  const found = await db.from("newsletter_campaigns").select(campaignFields).eq("id", values.campaignId).maybeSingle();
  if (found.error) {
    await finishAdminAudit(audit, "failed");
    return NextResponse.json({ error: t("campaignError") }, { status: 503 });
  }
  campaign = found.data as unknown as Campaign | null;
  if (campaign && campaign.created_by !== admin.userId) {
    await finishAdminAudit(audit, "failed");
    return NextResponse.json({ error: t("campaignError") }, { status: 404 });
  }
  if (campaign && campaign.status === "sent") {
    await finishAdminAudit(audit, "succeeded");
    return NextResponse.json({ success: true, sentCount: 0, alreadySent: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  if (!campaign) {
    const audience = await db.from("newsletter_subscriptions").select("id,email").eq("status", "confirmed").order("created_at", { ascending: true }).order("id", { ascending: true });
    if (audience.error) {
      await finishAdminAudit(audit, "failed");
      return NextResponse.json({ error: t("campaignError") }, { status: 503 });
    }
    const subscribers = (audience.data ?? []) as Subscription[];
    if (subscribers.length === 0) {
      await finishAdminAudit(audit, "failed");
      return NextResponse.json({ error: t("noConfirmedAudience") }, { status: 409 });
    }
    if (subscribers.length > NEWSLETTER_MAX_CAMPAIGN_SIZE) {
      await finishAdminAudit(audit, "failed");
      return NextResponse.json({ error: t("audienceTooLarge", { count: NEWSLETTER_MAX_CAMPAIGN_SIZE }) }, { status: 413 });
    }
    const created = await db.from("newsletter_campaigns").insert({
      id: values.campaignId, subject: copy.subject, heading: copy.heading, body: copy.body, cta_label: copy.ctaLabel,
      cta_url: copy.ctaUrl, recommend: copy.recommend, instagram_label: copy.instagramLabel, instagram_url: copy.instagramUrl, signature: copy.signature,
      created_by: admin.userId, status: "sending", recipient_count: subscribers.length, sent_count: 0, locale,
    }).select(campaignFields).single();
    if (created.error || !created.data) {
      await finishAdminAudit(audit, "failed");
      return NextResponse.json({ error: t("campaignError") }, { status: 503 });
    }
    campaign = created.data as unknown as Campaign;
    if (subscribers.length) {
      const deliveries = subscribers.map((subscriber, index) => ({ campaign_id: values.campaignId as string, subscription_id: subscriber.id, chunk_index: Math.floor(index / NEWSLETTER_BATCH_SIZE), status: "pending" }));
      const inserted = await db.from("newsletter_campaign_deliveries").insert(deliveries);
      if (inserted.error) {
        await db.from("newsletter_campaigns").update({ status: "failed", finished_at: new Date().toISOString() }).eq("id", values.campaignId);
        await finishAdminAudit(audit, "failed");
        return NextResponse.json({ error: t("campaignError") }, { status: 503 });
      }
    }
  } else if (campaign.subject !== copy.subject || campaign.heading !== copy.heading || campaign.body !== copy.body || campaign.cta_label !== copy.ctaLabel || campaign.cta_url !== copy.ctaUrl || campaign.recommend !== copy.recommend || campaign.instagram_label !== copy.instagramLabel || campaign.instagram_url !== copy.instagramUrl || campaign.signature !== copy.signature) {
    await finishAdminAudit(audit, "failed");
    return NextResponse.json({ error: t("campaignImmutable") }, { status: 409 });
  }

  const { data: deliveryRows, error: deliveryError } = await db.from("newsletter_campaign_deliveries")
    .select("subscription_id,chunk_index,status").eq("campaign_id", values.campaignId).eq("status", "pending")
    .order("chunk_index", { ascending: true }).order("subscription_id", { ascending: true });
  if (deliveryError) {
    await finishAdminAudit(audit, "failed");
    return NextResponse.json({ error: t("campaignError") }, { status: 503 });
  }
  const pending = (deliveryRows ?? []) as Delivery[];
  if (pending.length === 0 && campaign.recipient_count > 0) {
    const existingDeliveries = await db.from("newsletter_campaign_deliveries").select("status").eq("campaign_id", values.campaignId);
    if (existingDeliveries.error || !existingDeliveries.data?.length) {
      await finishAdminAudit(audit, "failed");
      return NextResponse.json({ error: t("campaignError") }, { status: 503 });
    }
  }
  const chunkGroups = new Map<number, Delivery[]>();
  for (const delivery of pending) chunkGroups.set(delivery.chunk_index, [...(chunkGroups.get(delivery.chunk_index) ?? []), delivery]);
  let sentThisRequest = 0;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.cinegenius.co";

  for (const [chunkIndex, chunk] of chunkGroups) {
    const ids = chunk.map(item => item.subscription_id);
    const current = await db.from("newsletter_subscriptions").select("id,email").in("id", ids).eq("status", "confirmed");
    if (current.error) break;
    const confirmed = (current.data ?? []) as Subscription[];
    const activeIds = new Set(confirmed.map(item => item.id));
    const skippedIds = ids.filter(id => !activeIds.has(id));
    if (skippedIds.length) await db.from("newsletter_campaign_deliveries").update({ status: "skipped" }).eq("campaign_id", values.campaignId).in("subscription_id", skippedIds).eq("status", "pending");
    if (!confirmed.length) continue;
    const messages = confirmed.map(subscriber => {
      const proof = newsletterUnsubscribeProof(subscriber.id);
      const unsubscribe = new URL("/newsletter/unsubscribe", base);
      unsubscribe.searchParams.set("id", subscriber.id);
      unsubscribe.searchParams.set("proof", proof);
      return { to: subscriber.email, unsubscribeUrl: unsubscribe.toString(), copy };
    });
    const campaignT = await getTranslations({ locale: campaign.locale as typeof locale, namespace: "AdminNewsletter" });
    const localizedCopy = {
      ...copy,
      testFooter: campaignT("testEmailFooter"),
      unsubscribeFooter: campaignT("campaignEmailFooter"),
      unsubscribeLink: campaignT("unsubscribeLink"),
    };
    const result = await sendNewsletterCampaignBatch(messages.map(message => ({ ...message, copy: localizedCopy })), `newsletter:${values.campaignId}:${chunkIndex}`, campaign.locale);
    if (!result.ok) break;
    const sentAt = new Date().toISOString();
    const updates = confirmed.map((subscriber, index) => ({ campaign_id: values.campaignId as string, subscription_id: subscriber.id, chunk_index: chunkIndex, status: "sent", resend_id: result.ids[index], sent_at: sentAt }));
    const persisted = await db.from("newsletter_campaign_deliveries").upsert(updates, { onConflict: "campaign_id,subscription_id" });
    if (persisted.error) break;
    sentThisRequest += confirmed.length;
  }

  const refreshed = await db.from("newsletter_campaign_deliveries").select("status").eq("campaign_id", values.campaignId);
  const rows = (refreshed.data ?? []) as Array<{ status: string }>;
  const isComplete = !refreshed.error && rows.every(row => row.status === "sent" || row.status === "skipped");
  const actualSentCount = rows.filter(row => row.status === "sent").length;
  await db.from("newsletter_campaigns").update({ status: isComplete ? "sent" : "partial", sent_count: actualSentCount, finished_at: isComplete ? new Date().toISOString() : null }).eq("id", values.campaignId);
  const auditLogged = await finishAdminAudit(audit, sentThisRequest || isComplete ? "succeeded" : "failed");
  if (!isComplete && sentThisRequest === 0) return NextResponse.json({ error: t("campaignPartial"), campaignId: values.campaignId, auditLogged }, { status: 502 });
  return NextResponse.json({ success: true, sentCount: sentThisRequest, totalSent: actualSentCount, complete: isComplete, campaignId: values.campaignId, auditLogged }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
