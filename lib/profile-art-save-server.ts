import "server-only";
import { db } from "@/lib/db";
import { validProfileArtSave } from "@/lib/profile-art-save";
import { PROFILE_ART_RESERVATIONS_ENABLED } from "@/lib/profile-art-reservations";
import { after } from "next/server";

/** Called only after the ordinary profile route's complete validation. */
export async function saveProfileWithArt(userId: string, payload: Record<string, unknown>, choice: unknown, create: boolean) {
  if (!PROFILE_ART_RESERVATIONS_ENABLED) return {data: null, error: {code: "PT503", message: "ART_UNAVAILABLE"}};
  if (!validProfileArtSave(choice)) return {data: null, error: {code: "PT400", message: "ART_INVALID"}};
  const result = await db.rpc(choice.deletions?.length ? "profile_art_save_profile_v2" : "profile_art_save_profile", {
    p_user: userId, p_payload: payload, p_choices: choice.choices, p_expected: choice.expectedUpdatedAt,
    p_request: choice.requestKey, p_create: create,
    ...(choice.deletions?.length ? {p_deletions: choice.deletions} : {}),
  }).abortSignal(AbortSignal.timeout(12_000));
  if (!result.error && result.data && choice.choices.length && process.env.VERCEL_ENV === "production" && process.env.PROFILE_ART_WORKER_ENABLED === "true") {
    // The claim has durably queued its replacement. Serving the response never
    // waits for an image provider, and retrying Save cannot create another job.
    after(async () => {
      try {const {runServerProfileArtRefill} = await import("@/lib/profile-art-refill-server"); await runServerProfileArtRefill();} catch { /* scheduled worker picks up the durable queue */ }
    });
  }
  return {data: result.data as Record<string, unknown> | null, error: result.error};
}
