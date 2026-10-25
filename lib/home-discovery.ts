export type PublicProfilePhoto = {
  profileId: string;
  profileSlug: string;
  author: string;
  imageUrl: string;
  caption: string;
  rating: number;
  count: number;
};

/** Keeps different creators adjacent as rarely as possible without random ordering. */
export function orderPhotosByAuthor(photos: readonly PublicProfilePhoto[]): PublicProfilePhoto[] {
  const remaining = [...photos];
  const ordered: PublicProfilePhoto[] = [];

  while (remaining.length > 0) {
    const previousAuthor = ordered.length > 0 ? ordered[ordered.length - 1].profileId : null;
    const differentAuthorIndex = previousAuthor === null
      ? 0
      : remaining.findIndex((photo) => photo.profileId !== previousAuthor);
    const nextIndex = differentAuthorIndex >= 0 ? differentAuthorIndex : 0;
    ordered.push(remaining.splice(nextIndex, 1)[0]);
  }

  return ordered;
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
