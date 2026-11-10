import { timingSafeEqual } from "node:crypto";

export const LISTING_FRESHNESS_CRON_PATH = "/api/cron/listing-freshness";

export function authorizedListingFreshnessCron(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function listingFreshnessSchedulerEnabled(environment: Record<string, string | undefined> = process.env): boolean {
  return environment.VERCEL_ENV === "production" && environment.LISTING_FRESHNESS_ENABLED === "true";
}
