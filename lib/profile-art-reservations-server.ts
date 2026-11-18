import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { prepareProfileArtCommand, profileArtDatabaseFailure, PROFILE_ART_RESERVATIONS_ENABLED } from "@/lib/profile-art-reservations";

/** Authenticated commands; the private database switch remains a second gate. */
export async function runProfileArtReservation(input: unknown, expectedAccount?: string) {
  const session = await getCurrentUser();
  if (expectedAccount && session?.userId !== expectedAccount) return { ok: false as const, status: 409, code: "ART_ACCOUNT_CHANGED" };
  const command = prepareProfileArtCommand(session?.userId ?? null, input);
  if (!command.ok) return command;
  if (!PROFILE_ART_RESERVATIONS_ENABLED) return { ok: false as const, status: 503, code: "ART_UNAVAILABLE" };
  try {
    const { data, error } = await db.rpc(command.rpc, command.args).abortSignal(AbortSignal.timeout(8000));
    if (error || data == null) return profileArtDatabaseFailure(error);
    return { ok: true as const, data };
  } catch {
    return profileArtDatabaseFailure(null);
  }
}
