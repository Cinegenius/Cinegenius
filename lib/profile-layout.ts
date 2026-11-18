export const PROFILE_LAYOUTS = ["compact", "large-photo"] as const;
export type ProfileLayout = typeof PROFILE_LAYOUTS[number];

export function isProfileLayout(value: unknown): value is ProfileLayout {
  return value === "compact" || value === "large-photo";
}

/** Null preserves the historical presentation until the owner explicitly chooses. */
export function profileLayout(value: unknown): ProfileLayout | null {
  return isProfileLayout(value) ? value : null;
}
