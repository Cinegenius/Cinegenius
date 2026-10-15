export type ProfileCompletionInput = {
  name?: string | null;
  avatarUrl?: string | null;
  location?: string | null;
  bio?: string | null;
  profileType?: string | null;
  images?: Array<string | null | undefined> | null;
  videoLinks?: Array<string | null | undefined> | null;
  languages?: Array<string | null | undefined> | null;
  heightCm?: string | number | null;
  hairColor?: string | null;
  playingAgeMin?: string | number | null;
  positions?: Array<string | null | undefined> | null;
  filmography?: unknown[] | null;
};

export type ProfileCompletionKey =
  | "name" | "avatar" | "city" | "bio" | "type" | "photos" | "video" | "languages"
  | "height" | "hair" | "age" | "role" | "credits";

export function calculateProfileCompletion(input: ProfileCompletionInput) {
  const nonEmpty = (value: unknown) => typeof value === "string" ? value.trim().length > 0 : value != null;
  const images = (input.images ?? []).filter(nonEmpty);
  const videoLinks = (input.videoLinks ?? []).filter(nonEmpty);
  const languages = (input.languages ?? []).filter(nonEmpty);
  const positions = (input.positions ?? []).filter(nonEmpty);
  const filmography = input.filmography ?? [];
  const type = input.profileType?.trim() ?? "";

  const checks: Array<[ProfileCompletionKey, boolean]> = [
    ["name", nonEmpty(input.name)],
    ["avatar", nonEmpty(input.avatarUrl)],
    ["city", nonEmpty(input.location)],
    ["bio", nonEmpty(input.bio)],
    ["type", nonEmpty(type)],
    ["photos", images.length >= 2],
    ["video", videoLinks.length > 0],
    ["languages", languages.length > 0],
  ];

  const talentTypes = new Set(["actor", "model", "extra", "host", "dancer", "stunt", "voiceover", "creator"]);
  const providerTypes = new Set(["location", "equipment", "vehicle", "studio", "props"]);
  const isTalent = talentTypes.has(type);
  const isCrew = !isTalent && !!type && !providerTypes.has(type);

  if (isTalent) {
    checks.push(["height", nonEmpty(input.heightCm)]);
    checks.push(["hair", nonEmpty(input.hairColor)]);
    if (type === "actor") checks.push(["age", nonEmpty(input.playingAgeMin)]);
  }
  if (isCrew) {
    checks.push(["role", positions.length > 0]);
    checks.push(["credits", filmography.length > 0]);
  }

  const passed = checks.filter(([, complete]) => complete).length;
  return {
    score: Math.round((passed / checks.length) * 100),
    missing: checks.filter(([, complete]) => !complete).map(([key]) => key),
    checks: checks.map(([key, complete]) => ({ key, complete })),
    total: checks.length,
  };
}
