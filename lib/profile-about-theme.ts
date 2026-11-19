import type { CrewData } from "./profile-types";

/** Curated by stable taxonomy ID. Light is yellow; make-up is soft pink. */
export const PROFILE_ABOUT_HUES: Readonly<Record<string, number>> = Object.freeze({
  produktion: 157, regie: 265, kamera: 211, licht: 48, grip: 187,
  ton: 174, art: 25, kostuem: 291, maske: 341, post: 232,
  musik: 320, "set-logistik": 82, cast: 11, sfx: 34, broadcast: 199,
  virtual: 252, redaktion: 132, social: 305, foto: 219, ki: 274,
  drehbuch: 103, "public-relations": 356, "sicherheit-sanitaetsdienst": 3,
  "catering-setverpflegung": 65, "filmtiere-tiertraining": 146,
  "vor-der-kamera": 17, szenenbild: 29, vfx: 243, "animation-3d": 259,
  besetzung: 331, filmgeschaeftsfuehrung: 162, producer: 168,
  "sende-veranstaltung": 205, spezialeffekte: 39, stunts: 7, "ton-post": 180,
  "tv-web-content": 121, "virtual-production": 282, "public-relation": 349,
  "weitere-crew": 91, "content-creation": 313, "social-video": 298,
  fotografie: 226, "foto-post": 237,
});

/** Consumes only the already visible occupation data; never infers from names or copy. */
export function profileAboutTheme(crew?: Pick<CrewData, "primaryOccupation" | "occupations" | "department"> | null) {
  const department = crew?.primaryOccupation?.departmentId || crew?.occupations?.[0]?.departmentId || crew?.department || "";
  const known = Object.hasOwn(PROFILE_ABOUT_HUES, department);
  return { department: known ? department : "neutral", hue: known ? PROFILE_ABOUT_HUES[department] : 210, saturation: known ? "60%" : "0%" };
}
