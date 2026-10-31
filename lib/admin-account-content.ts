import "server-only";
import { db } from "@/lib/db";
import { loadStartedOffers, type DraftAccount } from "@/lib/admin-started-offers-server";
import { offerStatus } from "@/lib/offer-moderation";

type CompanyRow = { id: string; owner_user_id: string; name: string; published: boolean };
type ListingRow = { id: string; user_id: string; title: string; type: string; published: boolean; moderation_status?: string };
export type AccountContent = {
  companies: { id: string; title: string; published: boolean }[];
  listings: { id: string; title: string; type: string; published: boolean; status: ReturnType<typeof offerStatus> }[];
  drafts: { id: string; title: string; kind: string }[];
};

/** Read only the current Clerk page. Follow PostgREST pages rather than silently dropping rows at its row limit. */
async function contentRows<T>(table: string, columns: string, ownerKey: string, ids: string[]): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < 10; page++) {
    const { data, error } = await db.from(table).select(columns).in(ownerKey, ids)
      .order("id", { ascending: true }).range(page * 1000, (page + 1) * 1000 - 1);
    if (error) throw new Error("account_content_read_failed");
    rows.push(...(data ?? []) as T[]);
    if ((data ?? []).length < 1000) return rows;
  }
  // An exceptionally large page must fail explicitly, never appear complete with missing content.
  throw new Error("account_content_page_too_large");
}

export async function loadAccountContent(users: DraftAccount[]): Promise<Map<string, AccountContent>> {
  if (users.length > 50) throw new Error("account_content_batch_too_large");
  const result = new Map<string, AccountContent>(users.map(user => [user.id, { companies: [], listings: [], drafts: [] }]));
  if (!users.length) return result;
  const ids = users.map(user => user.id);
  const [companies, listings, drafts] = await Promise.all([
    contentRows<CompanyRow>("companies", "id,owner_user_id,name,published", "owner_user_id", ids),
    contentRows<ListingRow>("listings", "id,user_id,title,type,published,moderation_status", "user_id", ids),
    loadStartedOffers(users),
  ]);
  for (const company of companies) result.get(company.owner_user_id)?.companies.push({ id: company.id, title: company.name, published: company.published === true });
  // user_id is the technical creator, not necessarily the provider. The UI names this relationship explicitly;
  // review and SupportMessageAction resolve the real provider through the existing protected flows.
  for (const listing of listings) result.get(listing.user_id)?.listings.push({ id: listing.id, title: listing.title, type: listing.type, published: listing.published === true, status: offerStatus(listing) });
  for (const draft of drafts) result.get(draft.userId)?.drafts.push({ id: draft.id, title: draft.title, kind: draft.kind });
  return result;
}
