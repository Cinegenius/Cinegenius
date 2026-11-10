import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { Resend } from "resend";

export const RESEND_MESSAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type ListingFreshnessReadCheck = "readable" | "not_configured" | "verified_email_required" | "permission_denied" | "not_found" | "unavailable";

/** Read one existing test message; never return provider data or send anything. */
export async function checkListingFreshnessReadAccess(adminUserId: string, messageId: string): Promise<ListingFreshnessReadCheck> {
  if (!adminUserId || !RESEND_MESSAGE_ID.test(messageId)) return "not_found";
  messageId = messageId.toLowerCase();
  const key = process.env.RESEND_API_KEY;
  if (!key) return "not_configured";
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(adminUserId);
    const primary = user.emailAddresses.find(address => address.id === user.primaryEmailAddressId);
    if (!primary || primary.verification?.status !== "verified") return "verified_email_required";
    const result = await new Resend(key).emails.get(messageId, { signal: AbortSignal.timeout(8_000) });
    if (result.error) {
      if ([401, 403].includes(result.error.statusCode ?? 0)) return "permission_denied";
      return result.error.statusCode === 404 ? "not_found" : "unavailable";
    }
    const message = result.data;
    // A foreign/nonexistent message deliberately has the same result. Multiple
    // recipients are unsuitable test evidence and are never disclosed either.
    if (!message || message.id !== messageId || !Array.isArray(message.to) || message.to.length !== 1
      || typeof message.to[0] !== "string" || message.to[0].trim().toLowerCase() !== primary.emailAddress.trim().toLowerCase()
      || (message.cc != null && (!Array.isArray(message.cc) || message.cc.length > 0))
      || (message.bcc != null && (!Array.isArray(message.bcc) || message.bcc.length > 0))) return "not_found";
    return "readable";
  } catch {
    return "unavailable";
  }
}
