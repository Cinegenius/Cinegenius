export function photoLikeKey(profileId: string, imageUrl: string): string {
  return `${profileId}:${imageUrl}`;
}

/** Applies a desired state; retrying the same state never changes the count twice. */
export function optimisticPhotoLikeCount(count: number, wasLiked: boolean, nextLiked: boolean): number {
  if (wasLiked === nextLiked) return Math.max(0, count);
  return Math.max(0, count + (nextLiked ? 1 : -1));
}
