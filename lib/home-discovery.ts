export type PublicProfilePhoto = {
  profileId: string;
  profileSlug: string;
  author: string;
  imageUrl: string;
  caption: string;
  rating: number;
  count: number;
};

/** One image per contributor per pass, preserving newest-first order within each contributor. */
export function orderPhotosByAuthor<T extends PublicProfilePhoto>(photos: readonly T[]): T[] {
  const contributors = new Map<string, T[]>();
  for (const photo of photos) {
    const group = contributors.get(photo.profileId) ?? [];
    group.push(photo);
    contributors.set(photo.profileId, group);
  }
  const ordered: T[] = [];
  while (contributors.size > 0) {
    for (const [id, group] of contributors) {
      ordered.push(group.shift()!);
      if (group.length === 0) contributors.delete(id);
    }
  }
  return ordered;
}

/** Bounded metadata/preview pool; loop copies reuse URLs and never fetch original files. */
export const HOME_DISCOVERY_PHOTO_LIMIT = 24;
export function selectHomeDiscoveryPhotos<T extends PublicProfilePhoto>(photos: readonly T[]): T[] {
  const seen = new Set<string>();
  const unique = photos.filter(photo => {
    if (seen.has(photo.imageUrl)) return false;
    seen.add(photo.imageUrl);
    return true;
  });
  return orderPhotosByAuthor(unique).slice(0, HOME_DISCOVERY_PHOTO_LIMIT);
}

/** Repeats a stable sequence for a seamless visual loop; UI clones stay decorative. */
export function repeatForSeamlessLoop<T>(items: readonly T[]): T[] {
  return [...items, ...items];
}

/** Adds whole repeated passes so a continuous photo row always fills its viewport. */
export function getPhotoBandFillerCount(viewportWidth: number, cardWidth: number, photosPerPass: number): number {
  if (![viewportWidth, cardWidth, photosPerPass].every(Number.isFinite) || viewportWidth <= 0 || cardWidth <= 0 || photosPerPass <= 0) return 0;
  const passWidth = cardWidth * photosPerPass;
  const passCount = Math.max(1, Math.ceil(viewportWidth / passWidth));
  return (passCount - 1) * photosPerPass;
}

export function shouldAnimatePhotoBand(photoCount: number, prefersReducedMotion: boolean): boolean {
  return photoCount > 1 && !prefersReducedMotion;
}
