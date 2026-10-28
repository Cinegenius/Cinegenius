import { validateMarketplaceOffer } from "@/lib/marketplace-offer";
import "server-only";
import { db } from "@/lib/db";
import { getListingProvider } from "@/lib/listing-provider";
import { validateListingPublication } from "@/lib/listing-publication";
import { isMarketplaceOffer } from "@/lib/marketplace-publication";
import { getTranslations } from "next-intl/server";

export async function publishMarketplaceOffer(row: Record<string, unknown>, actor: string) {
  if (!isMarketplaceOffer(row.type)) return { outcome: "not_marketplace" as const, row };
  const t = await getTranslations("MarketplacePublishing");
  try {
  const provider = await getListingProvider(row.user_id as string, row.company_id as string, actor, row.responsible_person);
  const validation = validateListingPublication({ type: String(row.type), title: row.title as string, city: row.city as string,
    category: row.category as string, imageUrl: row.image_url as string, providerAssigned: provider.kind !== "unassigned",
    providerContactable: Boolean(provider.contactUserId) });
  if (validation) return { outcome: "incomplete", row, error: t("incomplete") };
  const categoryIssue=validateMarketplaceOffer(row.category,String(row.type),(row.metadata as Record<string,unknown>|null)?.marketplace);
  if(categoryIssue)return {outcome:"incomplete",row,error:(await getTranslations("MarketplaceOffer"))(categoryIssue)};
  const saved = await db.rpc("marketplace_publish_transition", { p_id: row.id, p_expected: row, p_actor: actor });
  if (saved.error) return { outcome: "error", row, error: t("saveError") };
  if (saved.data === "profile_required") return { outcome: "profile_required", row };
  if (!["saved", "unchanged"].includes(saved.data)) return { outcome: saved.data, row, error: t(saved.data === "restricted" ? "restricted" : saved.data === "stale" ? "stale" : "saveError") };
  // The locked transaction confirms this exact snapshot. Avoid a second read
  // that could fail after a successful commit or observe a later concurrent edit.
  return { outcome: "published", row: { ...row, published: true, moderation_status: "owner_published",
    reviewed_revision: null, reviewed_at: null, reviewed_by: null, moderation_reason: null } };
  } catch { return { outcome: "error", row, error: t("saveError") }; }
}
