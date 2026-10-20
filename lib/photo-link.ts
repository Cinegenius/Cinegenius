export function photoHref(profileId: string, imageUrl: string, action?: "like"): string {
  const query = new URLSearchParams({ profile_id: profileId, image_url: imageUrl });
  if (action) query.set("action", action);
  return `/photo?${query.toString()}`;
}

export function markPhotoNavigation(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem("cinegenius-photo-return", "1");
  } catch { /* A blocked session store must not prevent opening a photo. */ }
}

export function markPhotoNavigationWithAnimation(animationTime?: number): void {
  markPhotoNavigation();
  if (typeof window === "undefined") return;
  try {
    if (typeof animationTime === "number" && Number.isFinite(animationTime)) {
      window.sessionStorage.setItem("cinegenius-photo-band-time", String(animationTime));
    }
  } catch { /* A blocked session store must not prevent opening a photo. */ }
}
