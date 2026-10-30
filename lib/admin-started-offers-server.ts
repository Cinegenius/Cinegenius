import "server-only";
import { db } from "@/lib/db";
import { OFFER_RECOVERY_KEYS, startedOffersForAccount } from "@/lib/admin-started-offers";

export type DraftAccount = { id: string; firstName: string | null; lastName: string | null; privateMetadata: unknown };

/** Bounded, read-only access behind requireAdmin. Saved content stays in the usual admin lists. */
export async function loadStartedOffers(users: DraftAccount[]) {
  if (!users.length) return [];
  if (users.length > 50) throw new Error("started_offer_batch_too_large");
  const ids = users.map(user => user.id);
  const { data: rows, error } = await db.from("private_form_drafts")
    .select("user_id, form_key, draft_data, updated_at").in("user_id", ids).in("form_key", [...OFFER_RECOVERY_KEYS]).limit(200);
  if (error) throw new Error("started_offer_read_failed");
  const candidates = users.flatMap(user => startedOffersForAccount(user.id, user.privateMetadata, rows ?? []));
  if (!candidates.length) return [];
  const titles = [...new Set(candidates.map(offer => offer.title).filter(Boolean))];
  const [{ data: companies, error: companyError }, { data: listings, error: listingError }] = await Promise.all([
    db.from("companies").select("owner_user_id").in("owner_user_id", ids).limit(1000),
    titles.length ? db.from("listings").select("user_id, title, type").in("user_id", ids).in("title", titles).limit(1000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (companyError || listingError) throw new Error("started_offer_state_failed");
  return candidates.filter(offer => {
    // /company-setup resumes the user's existing company; do not send them to an unrelated new snapshot.
    if (offer.kind === "company") return !companies?.some(company => company.owner_user_id === offer.userId);
    return !listings?.some(listing => listing.user_id === offer.userId && listing.title === offer.title
      && (offer.kind === "marketplace" ? ["prop", "vehicle"].includes(listing.type) : listing.type === offer.kind));
  });
}
