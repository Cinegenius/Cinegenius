import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const NEWSLETTER_CONSENT_VERSION = "2026-11-02";
export const NEWSLETTER_BATCH_SIZE = 100;
export const NEWSLETTER_MAX_CAMPAIGN_SIZE = 500;

export function hashNewsletterToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newsletterUnsubscribeProof(subscriptionId: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Newsletter signing key unavailable");
  return createHmac("sha256", secret).update(`newsletter-unsubscribe:${subscriptionId}`).digest("hex");
}

export function verifyNewsletterUnsubscribeProof(subscriptionId: string, proof: string) {
  if (!/^[a-f0-9-]{36}$/i.test(subscriptionId) || !/^[a-f0-9]{64}$/i.test(proof)) return false;
  const expected = Buffer.from(newsletterUnsubscribeProof(subscriptionId), "hex");
  const received = Buffer.from(proof, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function normalizeNewsletterEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function validateNewsletterCopy(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const copy = value as Record<string, unknown>;
  const fields = ["subject", "heading", "body", "ctaLabel", "ctaUrl", "recommend", "instagramLabel", "instagramUrl", "signature"] as const;
  if (fields.some(key => typeof copy[key] !== "string")) return null;
  const subject = (copy.subject as string).trim();
  const heading = (copy.heading as string).trim();
  const body = (copy.body as string).trim();
  const ctaLabel = (copy.ctaLabel as string).trim();
  const ctaUrl = (copy.ctaUrl as string).trim();
  const recommend = (copy.recommend as string).trim();
  const instagramLabel = (copy.instagramLabel as string).trim();
  const instagramUrl = (copy.instagramUrl as string).trim();
  const signature = (copy.signature as string).trim();
  if (!subject || subject.length > 140 || !heading || heading.length > 180 || !body || body.length > 6000 || !ctaLabel || ctaLabel.length > 80 || !recommend || recommend.length > 300 || !instagramLabel || instagramLabel.length > 120 || !signature || signature.length > 120) return null;
  try {
    const url = new URL(ctaUrl);
    if (url.protocol !== "https:" || url.username || url.password) return null;
  } catch { return null; }
  try {
    const url = new URL(instagramUrl);
    if (url.protocol !== "https:" || url.hostname !== "www.instagram.com" || url.username || url.password) return null;
  } catch { return null; }
  return { subject, heading, body, ctaLabel, ctaUrl, recommend, instagramLabel, instagramUrl, signature };
}

export function hashRateLimitIdentity(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
