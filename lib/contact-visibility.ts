export type ContactVisibility = "public" | "members" | "friends" | "hidden";
export type ProfileContactVisibility = { phone: ContactVisibility; contact_email: ContactVisibility };

export function normalizeContactVisibility(value: unknown): ContactVisibility {
  return value === "public" || value === "members" || value === "friends" ? value : "hidden";
}

export function canViewContactValue(visibility: ContactVisibility, viewerId: string | null, friend = false): boolean {
  return visibility === "public" || (visibility === "members" && !!viewerId) || (visibility === "friends" && !!viewerId && friend);
}

/** Database columns to fetch for this request; hidden contact values stay unqueried. */
export function visibleProfileContactFields(
  visibility: ProfileContactVisibility,
  viewerId: string | null,
  isOwner = false,
  friend = false,
): Array<"phone" | "contact_email"> {
  return [
    ...(isOwner || canViewContactValue(visibility.phone, viewerId, friend) ? ["phone" as const] : []),
    ...(isOwner || canViewContactValue(visibility.contact_email, viewerId, friend) ? ["contact_email" as const] : []),
  ];
}

export function projectProfileContacts<T extends { phone?: string | null; contact_email?: string | null }>(
  profile: T,
  visibility: ProfileContactVisibility,
  viewerId: string | null,
  isOwner = false,
  friend = false,
) {
  const phoneVisible = isOwner || canViewContactValue(visibility.phone, viewerId, friend);
  const emailVisible = isOwner || canViewContactValue(visibility.contact_email, viewerId, friend);
  return {
    phone: phoneVisible ? profile.phone ?? null : null,
    contact_email: emailVisible ? profile.contact_email ?? null : null,
    // Keep the prompt independent of whether a hidden value is set so the
    // server never has to fetch private contact fields just to test presence.
    contact_requires_sign_in: Boolean(!viewerId && (
      visibility.phone !== "public" || visibility.contact_email !== "public"
    )),
  };
}
