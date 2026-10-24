export type ContactVisibility = "public" | "members" | "hidden";
export type ProfileContactVisibility = { phone: ContactVisibility; contact_email: ContactVisibility };

export function normalizeContactVisibility(value: unknown): ContactVisibility {
  return value === "public" || value === "members" ? value : "hidden";
}

export function canViewContactValue(visibility: ContactVisibility, viewerId: string | null): boolean {
  return visibility === "public" || (visibility === "members" && !!viewerId);
}

/** Database columns to fetch for this request; hidden contact values stay unqueried. */
export function visibleProfileContactFields(
  visibility: ProfileContactVisibility,
  viewerId: string | null,
  isOwner = false,
): Array<"phone" | "contact_email"> {
  return [
    ...(isOwner || canViewContactValue(visibility.phone, viewerId) ? ["phone" as const] : []),
    ...(isOwner || canViewContactValue(visibility.contact_email, viewerId) ? ["contact_email" as const] : []),
  ];
}

export function projectProfileContacts<T extends { phone?: string | null; contact_email?: string | null }>(
  profile: T,
  visibility: ProfileContactVisibility,
  viewerId: string | null,
  isOwner = false,
) {
  const phoneVisible = isOwner || canViewContactValue(visibility.phone, viewerId);
  const emailVisible = isOwner || canViewContactValue(visibility.contact_email, viewerId);
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
