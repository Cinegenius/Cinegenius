import "server-only";
import { db } from "@/lib/db";
import { validProfileArtSave } from "@/lib/profile-art-save";
import { PROFILE_ART_RESERVATIONS_ENABLED } from "@/lib/profile-art-reservations";

/** Called only after the ordinary profile route's complete validation. */
export async function saveProfileWithArt(userId: string, payload: Record<string, unknown>, choice: unknown, create: boolean) {
  if (!PROFILE_ART_RESERVATIONS_ENABLED) return {data: null, error: {code: "PT503", message: "ART_UNAVAILABLE"}};
  if (!validProfileArtSave(choice)) return {data: null, error: {code: "PT400", message: "ART_INVALID"}};
  const result = await db.rpc("profile_art_save_profile", {
    p_user: userId, p_payload: payload, p_choices: choice.choices, p_expected: choice.expectedUpdatedAt,
    p_request: choice.requestKey, p_create: create,
  }).abortSignal(AbortSignal.timeout(12_000));
  return {data: result.data as Record<string, unknown> | null, error: result.error};
}
