export const PROFILE_UPDATED_EVENT = "cinegenius:profile-updated";
const PROFILE_UPDATED_STORAGE_KEY = "cg-profile-updated-event";

export type ProfileUpdatedDetail = {
  userId?: string;
  displayName?: string;
  avatarUrl?: string | null;
  previousAvatarUrl?: string | null;
};

function isProfileUpdatedDetail(value: unknown): value is ProfileUpdatedDetail {
  if (!value || typeof value !== "object") return false;
  const detail = value as ProfileUpdatedDetail;
  return typeof detail.userId === "string"
    && (detail.avatarUrl === undefined || detail.avatarUrl === null || typeof detail.avatarUrl === "string")
    && (detail.displayName === undefined || typeof detail.displayName === "string");
}

export function publishProfileUpdated(detail: ProfileUpdatedDetail): void {
  if (typeof window === "undefined" || !detail.userId) return;
  window.dispatchEvent(new CustomEvent<ProfileUpdatedDetail>(PROFILE_UPDATED_EVENT, { detail }));

  // Notify other CineGenius tabs without storing credentials or relying on a
  // user-agnostic avatar cache. Storage events only reach the other tabs.
  try {
    localStorage.setItem(PROFILE_UPDATED_STORAGE_KEY, JSON.stringify({ ...detail, nonce: crypto.randomUUID() }));
  } catch {
    // Private browsing or disabled storage only affects cross-tab immediacy.
  }
}

export function subscribeToProfileUpdated(listener: (detail: ProfileUpdatedDetail) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onLocalUpdate = (event: Event) => {
    const detail = (event as CustomEvent<ProfileUpdatedDetail>).detail;
    if (isProfileUpdatedDetail(detail)) listener(detail);
  };
  const onCrossTabUpdate = (event: StorageEvent) => {
    if (event.key !== PROFILE_UPDATED_STORAGE_KEY || !event.newValue) return;
    try {
      const value: unknown = JSON.parse(event.newValue);
      if (isProfileUpdatedDetail(value)) listener(value);
    } catch {
      // Ignore malformed or stale storage events.
    }
  };

  window.addEventListener(PROFILE_UPDATED_EVENT, onLocalUpdate);
  window.addEventListener("storage", onCrossTabUpdate);
  return () => {
    window.removeEventListener(PROFILE_UPDATED_EVENT, onLocalUpdate);
    window.removeEventListener("storage", onCrossTabUpdate);
  };
}
