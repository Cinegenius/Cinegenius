import "server-only";
import { db } from "@/lib/db";
import { editableCompanyIdsForUser } from "@/lib/listing-access";

const ACCOUNT_ID = /^user_[a-zA-Z0-9]{1,128}$/;
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const LOCATION_LIMIT = 200;

export type NativeWorkspaceAccount = {
  accountID: string;
  locations: { id: string; title: string; city: string }[];
  limited: boolean;
};

/** Account ID must come from this request's verified session, never a parameter.
 * Match the existing owner listing rules, including current company access,
 * without loading profile names, offer metadata, media or freshness state. */
export async function nativeWorkspaceAccount(accountID: string, signal: AbortSignal): Promise<NativeWorkspaceAccount> {
  if (!ACCOUNT_ID.test(accountID)) throw new Error("unavailable");
  signal.throwIfAborted();
  const { data, error } = await db.from("listings")
    .select("id,title,city,company_id")
    .eq("user_id", accountID).eq("type", "location")
    .order("created_at", { ascending: false }).order("id")
    .limit(LOCATION_LIMIT + 1).abortSignal(signal);
  if (error || !Array.isArray(data) || data.length > LOCATION_LIMIT + 1) throw new Error("unavailable");
  // Personal locations need no company reads. An old creator ID alone cannot
  // retain access after that account loses its company offer-editing role.
  const companyIds = data.some(row => row.company_id)
    ? await editableCompanyIdsForUser(accountID) : [];
  signal.throwIfAborted();
  const locations = data.filter(row => !row.company_id || companyIds.includes(row.company_id))
    .slice(0, LOCATION_LIMIT).map(row => {
      if (typeof row.id !== "string" || !UUID.test(row.id) || typeof row.title !== "string"
          || !row.title.length || row.title.length > 200
          || (row.city !== null && typeof row.city !== "string") || (row.city?.length ?? 0) > 320) {
        throw new Error("unavailable");
      }
      return { id: row.id, title: row.title, city: row.city ?? "" };
    });
  return { accountID, locations, limited: data.length > LOCATION_LIMIT };
}
