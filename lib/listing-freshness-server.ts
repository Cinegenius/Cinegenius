import "server-only";

import { randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { appLocale, DEFAULT_LOCALE, isAppLocale, type AppLocale } from "@/lib/i18n/locales";
import { listingDetailPath } from "@/lib/listing-routes";
import { listingFreshnessSchedulerEnabled } from "@/lib/listing-freshness-cron-auth";
import { buildListingReminderEmail, getListingReminderDeliveryStatus, isFrozenListingReminderEmail, sendListingReminderEmail } from "@/lib/listing-freshness-email";

type JsonObject = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Resend retains idempotency keys for 24 hours. Stop earlier rather than risk
// a second delivery after a timeout whose first outcome cannot be established.
const RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;
const WORK_BUDGET_MS = 45_000;

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

export class ListingFreshnessError extends Error {
  constructor(public code: "missing" | "stale" | "restricted" | "invalid" | "unavailable", public status: number) {
    super(code);
  }
}

function checkResult(data: unknown, error: { code?: string } | null): JsonObject {
  if (error) {
    if (error.code === "PT409") throw new ListingFreshnessError("stale", 409);
    if (error.code === "42501" || error.code === "PT404") throw new ListingFreshnessError("missing", 404);
    throw new ListingFreshnessError("unavailable", 503);
  }
  const result = object(data);
  if (!result) throw new ListingFreshnessError("unavailable", 503);
  if (result.status === "missing" || result.status === "forbidden") throw new ListingFreshnessError("missing", 404);
  if (result.status === "stale") throw new ListingFreshnessError("stale", 409);
  if (result.status === "restricted") throw new ListingFreshnessError("restricted", 409);
  if (result.status === "invalid") throw new ListingFreshnessError("invalid", 400);
  return result;
}

function invalidateListings() {
  revalidateTag("listings", { expire: 0 });
  revalidatePath("/", "layout");
}

/** The service-only RPC checks personal ownership or accepted company edit rights. */
export async function getListingFreshness(id: string, userId: string) {
  if (!UUID.test(id) || !userId) throw new ListingFreshnessError("missing", 404);
  const response = await db.rpc("get_listing_freshness", { p_listing_id: id, p_actor: userId });
  const result = checkResult(response.data, response.error);
  const listing = object(result.listing);
  if (!listing || typeof listing.id !== "string" || typeof listing.type !== "string") throw new ListingFreshnessError("unavailable", 503);
  const state = object(result.state);
  const published = listing.published === true;
  const approved = listing.moderation_status === "approved" || listing.moderation_status === "owner_published";
  return {
    listing: {
      id: listing.id, title: typeof listing.title === "string" ? listing.title : "", type: listing.type, published,
      href: listingDetailPath(listing.type, listing.id, typeof listing.company_slug === "string" ? listing.company_slug : null)
        ?? `/dashboard?tab=listings&editListing=${encodeURIComponent(listing.id)}`,
    },
    state,
    canRenew: state !== null && result.canRenew === true && published && approved,
    canEnd: state !== null && result.canEnd === true,
  };
}

/** Renew never publishes or restores a moderation hold. The locked RPC enforces it. */
export async function actOnListingFreshness(input: {
  id: string; userId: string; action: "renew" | "end"; version: number; cycle: number; requestId: string; locale?: AppLocale;
}) {
  if (!UUID.test(input.id) || !input.userId || !["renew", "end"].includes(input.action)
    || !Number.isSafeInteger(input.version) || input.version < 0 || !Number.isSafeInteger(input.cycle) || input.cycle < 0
    || !UUID.test(input.requestId) || (input.locale !== undefined && !isAppLocale(input.locale))) {
    throw new ListingFreshnessError("invalid", 400);
  }
  const response = await db.rpc("listing_freshness_transition", {
    p_listing_id: input.id, p_actor: input.userId, p_action: input.action,
    p_expected_version: input.version, p_expected_cycle: input.cycle, p_request_id: input.requestId,
    p_locale: input.locale ?? null,
  });
  const result = checkResult(response.data, response.error);
  if (!object(result.state)) throw new ListingFreshnessError("unavailable", 503);
  invalidateListings();
  return { ok: true as const, state: result.state };
}

type ReminderClaim = {
  outbox_id: string; listing_id: string; title: string; type: string; cycle: number;
  stage: "initial" | "followup"; claim_token: string; lease_until: string;
  provider_user_id: string; provider_company_id: string | null; content_revision: number;
  frozen_payload: unknown; idempotency_key: string; first_attempt_at: string | null;
  grace_days: number; provider_locale: unknown;
};

type Outcome = "sent" | "retry" | "skipped" | "unknown";
type WorkerStats = { status: "disabled" | "not_configured" | "completed"; claimed: number; sent: number; retry: number; skipped: number; unknown: number; errors: number };

function retryExpired(firstAttempt: string | null, now: number) {
  if (firstAttempt === null) return false;
  const time = Date.parse(firstAttempt);
  return !Number.isFinite(time) || time > now + 60_000 || now - time >= RETRY_WINDOW_MS;
}

/** Bounded, service-only worker. No operation is performed unless both deployment gates are enabled. */
export async function runListingFreshnessWorker(options: { limit?: number } = {}): Promise<WorkerStats> {
  const stats: WorkerStats = { status: "completed", claimed: 0, sent: 0, retry: 0, skipped: 0, unknown: 0, errors: 0 };
  if (!listingFreshnessSchedulerEnabled()) return { ...stats, status: "disabled" };
  if (!process.env.RESEND_API_KEY) return { ...stats, status: "not_configured" };
  const started = Date.now();
  const limit = Math.max(1, Math.min(10, Math.trunc(options.limit ?? 10) || 10));
  const claimed = await db.rpc("claim_listing_freshness_reminders", { p_limit: limit, p_worker_id: randomUUID() });
  if (claimed.error || !Array.isArray(claimed.data)) throw new ListingFreshnessError("unavailable", 503);
  // Claim reconciles publication changes; it never pauses on send acceptance alone.
  // Invalidate even when it returns no email rows.
  invalidateListings();
  const claims = claimed.data as ReminderClaim[];
  stats.claimed = claims.length;

  async function finish(claim: ReminderClaim, outcome: Outcome, code: string | null = null, messageId: string | null = null) {
    try {
      const saved = await db.rpc("finish_listing_freshness_delivery", {
        p_outbox_id: claim.outbox_id, p_claim_token: claim.claim_token, p_outcome: outcome,
        p_provider_message_id: messageId, p_error_code: code,
      });
      if (saved.error || object(saved.data)?.status !== outcome) { stats.errors += 1; return; }
      stats[outcome] += 1;
    } catch { stats.errors += 1; }
  }

  for (const claim of claims) {
    if (Date.now() - started >= WORK_BUDGET_MS) break; // Unused claims recover after their lease.
    if (retryExpired(claim.first_attempt_at, Date.now())) { await finish(claim, "unknown", "idempotency_window_elapsed"); continue; }
    if (!Number.isFinite(Date.parse(claim.lease_until)) || Date.parse(claim.lease_until) <= Date.now() + 12_000) {
      await finish(claim, "retry", "lease_expiring"); continue;
    }
    try {
      const current = await db.from("listings").select("id,user_id,company_id,published,moderation_status,content_revision").eq("id", claim.listing_id).maybeSingle();
      if (current.error) { await finish(claim, "retry", "listing_unavailable"); continue; }
      const listing = current.data;
      if (!listing || listing.published !== true || !["approved", "owner_published"].includes(listing.moderation_status)
        || Number(listing.content_revision) !== Number(claim.content_revision) || listing.company_id !== claim.provider_company_id) {
        await finish(claim, "skipped", "listing_changed"); continue;
      }
      let providerId: string | null = listing.user_id;
      if (listing.company_id) {
        const company = await db.from("companies").select("owner_user_id").eq("id", listing.company_id).maybeSingle();
        if (company.error) { await finish(claim, "retry", "company_unavailable"); continue; }
        providerId = company.data?.owner_user_id ?? null;
      }
      // A missing company owner must never fall back to the technical listing creator.
      if (!providerId || providerId !== claim.provider_user_id) { await finish(claim, "skipped", "provider_changed"); continue; }
      const member = await (await clerkClient()).users.getUser(providerId);
      const primary = member.emailAddresses.find(address => address.id === member.primaryEmailAddressId);
      if (!primary || primary.verification?.status !== "verified") { await finish(claim, "skipped", "verified_email_missing"); continue; }
      const payload = claim.frozen_payload === null ? await buildListingReminderEmail({
        to: primary.emailAddress, firstName: member.firstName, listingId: claim.listing_id,
        title: claim.title, stage: claim.stage, graceDays: claim.grace_days,
        locale: isAppLocale(claim.provider_locale) ? claim.provider_locale
          : appLocale(member.locale) ?? appLocale(member.privateMetadata?.cinegeniusLocale)
            ?? appLocale(member.unsafeMetadata?.cinegeniusLocale) ?? DEFAULT_LOCALE,
      }) : claim.frozen_payload;
      if (!isFrozenListingReminderEmail(payload) || payload.to !== primary.emailAddress) {
        await finish(claim, claim.first_attempt_at ? "unknown" : "skipped", "recipient_or_payload_changed"); continue;
      }
      // Revalidate the locked listing/provider/revision immediately before every attempt.
      // The RPC stores the first payload atomically and returns it unchanged on retry.
      const bound = await db.rpc("bind_listing_freshness_delivery", {
        p_outbox_id: claim.outbox_id, p_claim_token: claim.claim_token, p_recipient_user_id: providerId, p_payload: payload,
      });
      if (bound.error) { await finish(claim, "retry", "bind_unavailable"); continue; }
      const binding = object(bound.data);
      if (!binding || !["bound", "existing"].includes(String(binding.status))) { stats.skipped += 1; continue; }
      const frozen = binding.frozen_payload;
      const key = binding.idempotency_key;
      if (!isFrozenListingReminderEmail(frozen) || frozen.to !== primary.emailAddress || typeof key !== "string" || key !== claim.idempotency_key
        || typeof binding.first_attempt_at !== "string" || retryExpired(binding.first_attempt_at, Date.now())) {
        await finish(claim, "unknown", "invalid_frozen_delivery"); continue;
      }
      const sent = await sendListingReminderEmail(frozen, key);
      if (sent.ok) await finish(claim, "sent", null, sent.id);
      else await finish(claim, sent.reason === "invalid_payload" ? "unknown" : "retry", sent.reason);
    } catch {
      // No recipient addresses, names, message content or provider exception bodies in logs.
      await finish(claim, "retry", "provider_lookup_or_delivery_unavailable");
    }
  }
  // An accepted send is not proof of delivery. Recheck the provider's current
  // delivery outcome and the current verified recipient before starting a grace
  // period or allowing an elapsed period to pause a listing. No webhook setup is
  // needed; missing read permission or a provider failure safely leaves it live.
  if (Date.now() - started < WORK_BUDGET_MS) {
    try {
      const checks = await db.rpc("get_listing_freshness_delivery_checks", { p_limit: limit });
      if (checks.error || !Array.isArray(checks.data)) stats.errors += 1;
      else for (const value of checks.data) {
        if (Date.now() - started >= WORK_BUDGET_MS) break;
        const check = object(value);
        if (!check || typeof check.outbox_id !== "string" || typeof check.provider_message_id !== "string"
          || typeof check.provider_user_id !== "string" || typeof check.recipient !== "string"
          || !(check.delivery_checked_at === null || typeof check.delivery_checked_at === "string")) {
          stats.errors += 1; continue;
        }
        let outcome: Awaited<ReturnType<typeof getListingReminderDeliveryStatus>> | "recipient_changed" = "unavailable";
        try {
          const member = await (await clerkClient()).users.getUser(check.provider_user_id);
          const primary = member.emailAddresses.find(address => address.id === member.primaryEmailAddressId);
          outcome = !primary || primary.verification?.status !== "verified"
            || primary.emailAddress.toLowerCase() !== check.recipient.toLowerCase()
            ? "recipient_changed"
            : await getListingReminderDeliveryStatus(check.provider_message_id, check.recipient);
        } catch { /* A lookup failure is unknown, never evidence of delivery. */ }
        const recorded = await db.rpc("record_listing_freshness_delivery_check", {
          p_outbox_id: check.outbox_id, p_provider_message_id: check.provider_message_id,
          p_expected_checked_at: check.delivery_checked_at, p_delivery_status: outcome,
        });
        if (recorded.error) stats.errors += 1;
        else if (object(recorded.data)?.status === "paused") invalidateListings();
      }
    } catch { stats.errors += 1; }
  }
  return stats;
}
