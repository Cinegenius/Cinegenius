import "server-only";
import { db } from "@/lib/db";
import { canViewProfile } from "@/lib/trust";

export type ListingProvider = {
  kind: "person" | "company" | "unassigned";
  name: string;
  href: string | null;
  imageUrl: string | null;
  logoBackground?: string | null;
  contactUserId: string | null;
};

const UNASSIGNED_PROVIDER: ListingProvider = {
  kind: "unassigned",
  name: "Anbieter wird geprüft",
  href: null,
  imageUrl: null,
  contactUserId: null,
};

/** Resolve the public provider. A company listing never falls back to its technical user_id. */
export async function getListingProvider(
  userId: string | null | undefined,
  companyId: string | null | undefined,
  viewerId: string | null = null,
): Promise<ListingProvider> {
  if (companyId) {
    const { data: company, error } = await db
      .from("companies")
      .select("id, slug, name, logo_url, logo_background, owner_user_id, published")
      .eq("id", companyId)
      .maybeSingle();
    if (error || !company || company.published !== true || !company.slug || !company.name) return UNASSIGNED_PROVIDER;

    const { data: owner } = await db
      .from("profiles")
      .select("user_id")
      .eq("user_id", company.owner_user_id)
      .maybeSingle();
    return {
      kind: "company",
      name: company.name,
      href: `/companies/${company.slug}`,
      imageUrl: company.logo_url ?? null,
      logoBackground: company.logo_background ?? "auto",
      contactUserId: owner ? company.owner_user_id : null,
    };
  }

  if (!userId) return UNASSIGNED_PROVIDER;
  const { data: profile, error } = await db
    .from("profiles")
    .select("user_id, display_name, slug, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !profile || !profile.display_name?.trim()) return UNASSIGNED_PROVIDER;

  const canOpenProfile = await canViewProfile(userId, viewerId);
  return {
    kind: "person",
    name: profile.display_name.trim(),
    href: canOpenProfile ? `/profile/${profile.slug || profile.user_id}` : null,
    imageUrl: profile.avatar_url ?? null,
    contactUserId: userId,
  };
}

export async function getListingProviders(
  listings: Array<{ user_id?: string | null; company_id?: string | null }>,
  viewerId: string | null = null,
): Promise<ListingProvider[]> {
  return Promise.all(listings.map((listing) => getListingProvider(listing.user_id, listing.company_id, viewerId)));
}
