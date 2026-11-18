import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { prepareProfileArtCommand, profileArtDatabaseFailure, PROFILE_ART_RESERVATIONS_ENABLED } from "@/lib/profile-art-reservations";

/** Not a Server Action or route. Deliberately disabled independently of the database switch. */
export async function runProfileArtReservation(input: unknown) {
  const session = await getCurrentUser();
  const command = prepareProfileArtCommand(session?.userId ?? null, input);
  if (!command.ok) return command;
  if (!PROFILE_ART_RESERVATIONS_ENABLED) return { ok: false as const, status: 503, code: "ART_UNAVAILABLE" };
  try {
    const { data, error } = await db.rpc(command.rpc, command.args);
    if (error || data == null) return profileArtDatabaseFailure(error);
    return { ok: true as const, data };
  } catch {
    return profileArtDatabaseFailure(null);
  }
}
