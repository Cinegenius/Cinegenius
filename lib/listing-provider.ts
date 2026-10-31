import { publicResponsiblePerson, responsibleForCompany, type PublicResponsiblePerson } from "@/lib/responsible-person-server";
import "server-only";
import { db } from "@/lib/db";
import { canViewProfile } from "@/lib/trust";

export type ListingProvider = {
  responsible?: PublicResponsiblePerson | null;
  kind: "person" | "company" | "unassigned";
  name: string;
  href: string | null;
  imageUrl: string | null;
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
  responsibleSnapshot?: unknown,
): Promise<ListingProvider> {
  if (companyId) {
    const { data: company, error } = await db
      .from("companies")
      .select("id, slug, name, logo_url, owner_user_id, published")
      .eq("id", companyId)
      .maybeSingle();
    if (error || !company || company.published !== true || !company.slug || !company.name) return UNASSIGNED_PROVIDER;

    const responsible = await publicResponsiblePerson(await responsibleForCompany(responsibleSnapshot, companyId, company.owner_user_id), viewerId);
    return {
      kind: "company",
      name: company.name,
      href: `/companies/${company.slug}`,
      imageUrl: company.logo_url ?? null,
      contactUserId: company.owner_user_id,
      responsible,
    };
  }

  if (!userId) return UNASSIGNED_PROVIDER;
  const { data: profile, error } = await db
    .from("profiles")
    .select("user_id, display_name, slug, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Provider could not be loaded");
  const snapshot = responsibleSnapshot as { userId?: string } | null;
  const responsible = snapshot?.userId === userId ? await publicResponsiblePerson(snapshot, viewerId) : null;
  if (!profile || !profile.display_name?.trim()) {
    if (!snapshot || snapshot.userId !== userId) return UNASSIGNED_PROVIDER;
    const { getTranslations } = await import("next-intl/server");
    const t = await getTranslations("responsiblePerson");
    return { kind: "person", name: responsible?.name || t("contact"), href: null, imageUrl: null, contactUserId: userId, responsible };
  }

  const canOpenProfile = await canViewProfile(userId, viewerId);
  return {
    kind: "person",
    name: profile.display_name.trim(),
    href: canOpenProfile ? `/profile/${profile.slug || profile.user_id}` : null,
    imageUrl: profile.avatar_url ?? null,
    responsible,
    contactUserId: userId,
  };
}

export async function getListingProviders(
  listings: Array<{ user_id?: string | null; company_id?: string | null; responsible_person?: unknown }>,
  viewerId: string | null = null,
): Promise<ListingProvider[]> {
  // Resolve an identical provider/contact only once within this list request.
  // Include the complete responsibility snapshot: private/delegated contacts
  // must not inherit another offer's public name or company function.
  const pending = new Map<string, Promise<ListingProvider>>();
  return Promise.all(listings.map(listing => {
    const key = JSON.stringify([listing.user_id ?? null, listing.company_id ?? null, listing.responsible_person ?? null]);
    let provider = pending.get(key);
    if (!provider) {
      provider = getListingProvider(listing.user_id, listing.company_id, viewerId, listing.responsible_person);
      pending.set(key, provider);
    }
    return provider;
  }));
}
