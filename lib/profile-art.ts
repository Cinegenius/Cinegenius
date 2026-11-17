/** Versioned, repository-owned artwork. Keep existing URLs available when the picker changes. */
export const PROFILE_AVATARS = [
  {
    "id": "avatar-01",
    "presentation": "masculine",
    "src": "/profile-art/v1/avatar-01.webp"
  },
  {
    "id": "avatar-04",
    "presentation": "masculine",
    "src": "/profile-art/v1/avatar-04.webp"
  },
  {
    "id": "avatar-05",
    "presentation": "masculine",
    "src": "/profile-art/v1/avatar-05.webp"
  },
  {
    "id": "avatar-19",
    "presentation": "masculine",
    "src": "/profile-art/v1/avatar-19.webp"
  },
  {
    "id": "avatar-03",
    "presentation": "feminine",
    "src": "/profile-art/v1/avatar-03.webp"
  },
  {
    "id": "avatar-06",
    "presentation": "feminine",
    "src": "/profile-art/v1/avatar-06.webp"
  },
  {
    "id": "avatar-12",
    "presentation": "feminine",
    "src": "/profile-art/v1/avatar-12.webp"
  },
  {
    "id": "avatar-15",
    "presentation": "feminine",
    "src": "/profile-art/v1/avatar-15.webp"
  },
  {
    "id": "avatar-13",
    "presentation": "neutral",
    "src": "/profile-art/v1/avatar-13.webp"
  },
  {
    "id": "avatar-14",
    "presentation": "neutral",
    "src": "/profile-art/v1/avatar-14.webp"
  },
  {
    "id": "avatar-16",
    "presentation": "neutral",
    "src": "/profile-art/v1/avatar-16.webp"
  },
  {
    "id": "avatar-20",
    "presentation": "neutral",
    "src": "/profile-art/v1/avatar-20.webp"
  }
] as const;
export const PROFILE_COVERS = [
  {
    "id": "cover-water",
    "theme": "water",
    "src": "/profile-art/v1/cover-water.webp"
  },
  {
    "id": "cover-moon",
    "theme": "moon",
    "src": "/profile-art/v1/cover-moon.webp"
  },
  {
    "id": "cover-sun",
    "theme": "sun",
    "src": "/profile-art/v1/cover-sun.webp"
  },
  {
    "id": "cover-earth",
    "theme": "earth",
    "src": "/profile-art/v1/cover-earth.webp"
  },
  {
    "id": "cover-sky",
    "theme": "sky",
    "src": "/profile-art/v1/cover-sky.webp"
  },
  {
    "id": "cover-cold",
    "theme": "cold",
    "src": "/profile-art/v1/cover-cold.webp"
  },
  {
    "id": "cover-heat",
    "theme": "heat",
    "src": "/profile-art/v1/cover-heat.webp"
  },
  {
    "id": "cover-mountains",
    "theme": "mountains",
    "src": "/profile-art/v1/cover-mountains.webp"
  },
  {
    "id": "cover-valley",
    "theme": "valley",
    "src": "/profile-art/v1/cover-valley.webp"
  },
  {
    "id": "cover-forest",
    "theme": "forest",
    "src": "/profile-art/v1/cover-forest.webp"
  },
  {
    "id": "cover-desert",
    "theme": "desert",
    "src": "/profile-art/v1/cover-desert.webp"
  },
  {
    "id": "cover-polar",
    "theme": "polar",
    "src": "/profile-art/v1/cover-polar.webp"
  }
] as const;

/** Random-looking distribution from the random account ID, stable through retries and reloads.
 * No name, gender, location or pronouns influence the suggestion. */
export function defaultProfileAvatar(accountId: string): string {
  let hash = 2166136261;
  for (const character of accountId) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return PROFILE_AVATARS[(hash >>> 0) % PROFILE_AVATARS.length].src;
}
