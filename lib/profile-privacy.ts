export const PRIVACY_AUDIENCES = ["public", "members", "friends", "hidden"] as const;
export type PrivacyAudience = typeof PRIVACY_AUDIENCES[number];
export type PrivacySettings = {
  ghost_mode: boolean;
  profile_visibility: "public" | "private";
  location_visibility: PrivacyAudience;
  map_visibility: PrivacyAudience;
  activity_visibility: PrivacyAudience;
  phone_visibility: PrivacyAudience;
  contact_email_visibility: PrivacyAudience;
  message_permission: "everyone" | "friends_only";
  email_new_message: boolean;
};
export const DEFAULT_PRIVACY: PrivacySettings = {
  ghost_mode: false, profile_visibility: "public", location_visibility: "public",
  map_visibility: "public", activity_visibility: "public", phone_visibility: "hidden",
  contact_email_visibility: "hidden", message_permission: "everyone", email_new_message: true,
};
export const PRIVACY_COLUMNS = "ghost_mode,profile_visibility,location_visibility,map_visibility,activity_visibility,phone_visibility,contact_email_visibility,message_permission,email_new_message" as const;
export type ProfileAccess = { profile: boolean; location: boolean; map: boolean; activity: boolean; phone: boolean; email: boolean };
export const HIDDEN_PROFILE_ACCESS: ProfileAccess = { profile: false, location: false, map: false, activity: false, phone: false, email: false };

export function audienceAllows(audience: unknown, viewerId: string | null, friend = false) {
  return audience === "public" || (audience === "members" && !!viewerId) || (audience === "friends" && !!viewerId && friend);
}

/** Legacy private means accepted friends. Ghost overrides every saved choice. */
export function profileAccess(settings: Partial<PrivacySettings> | null, ownerId: string, viewerId: string | null, friend = false, blocked = false): ProfileAccess {
  if (ownerId && ownerId === viewerId) return { profile: true, location: true, map: true, activity: true, phone: true, email: true };
  const s = { ...DEFAULT_PRIVACY, ...settings };
  const profile = !blocked && !s.ghost_mode && (s.profile_visibility === "public" || (s.profile_visibility === "private" && !!viewerId && friend));
  const location = profile && audienceAllows(s.location_visibility, viewerId, friend);
  return { profile, location, map: location && audienceAllows(s.map_visibility, viewerId, friend),
    activity: profile && audienceAllows(s.activity_visibility, viewerId, friend),
    phone: profile && audienceAllows(s.phone_visibility, viewerId, friend), email: profile && audienceAllows(s.contact_email_visibility, viewerId, friend) };
}

/** Strip before serialization, filtering or distance calculation; never just hide CSS. */
export function projectProfilePrivacy<T extends object>(row: T, access: ProfileAccess = HIDDEN_PROFILE_ACCESS): T {
  const result = { ...row } as Record<string, unknown>;
  if (!access.location) {
    for (const key of ["location", "city", "place_city_name", "place_region_name", "place_country_code", "place_region_id", "place_city_id", "address", "postal_code"]) if (key in result) result[key] = null;
    result.place_status = "empty";
  }
  if (!access.map) { result.lat = null; result.lng = null; result.map_visible = false; }
  if (!access.activity) { result.last_seen_at = null; result.last_active_at = null; }
  if (!access.phone && "phone" in result) result.phone = null;
  if (!access.email && "contact_email" in result) result.contact_email = null;
  return result as T;
}
