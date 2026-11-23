import { createHash } from "node:crypto";
import type { ArtJob } from "./profile-art-refill-contract";

/** Operator selections from the 23 November collages; repeated human #11 is one choice. */
export const AVATAR_STYLE_VERSION = "cg-selected-avatars-20261123";
export const HUMAN_AVATAR_STYLES = [
  { number: 11, id: "duotone", title: "Duoton", direction: "Duotone print in lime and deep navy: bold irregular silhouette, expressive flat face planes and limited two-color contrast" },
  { number: 13, id: "engraving", title: "Gravur", direction: "Hand engraving: fine etched hatching, imperfect carved contours, limited ink palette and lively illustrated facial features" },
  { number: 15, id: "retro", title: "Retro", direction: "Warm retro poster: playful bold shapes, warm ochre and coral, visible print grain and offbeat proportions" },
  { number: 17, id: "pop-glasses", title: "Pop mit Brille", direction: "Pop portrait with distinctive graphic glasses: lime and coral accents, playful asymmetric face shapes and confident imperfect outlines" },
  { number: 19, id: "prism", title: "Prisma", direction: "Graphic prism: shimmering flat color facets, unexpected color transitions and broken asymmetric planes, not glossy three-dimensional material" },
  { number: 31, id: "riso", title: "Riso", direction: "Risograph print: offset ink layers, tactile grain, slightly misregistered contours and expressive simple facial details" },
  { number: 32, id: "woodcut", title: "Holzschnitt", direction: "Rough woodcut: bold carved cuts, uneven ink edges, strong light-dark contrast and a distinctive expressive face" },
  { number: 36, id: "watercolor", title: "Aquarell", direction: "Loose abstract watercolor: translucent clouds of pigment, open unfinished edges, paper showing through and a few lively facial strokes" },
  { number: 37, id: "oil-pastel", title: "Ölkreide", direction: "Oil pastel illustration: wild crayon strokes, dense rich color, visible grain and scratch marks, playful imperfect proportions" },
  { number: 38, id: "comic-noir", title: "Comic-Noir", direction: "Comic noir: deep graphic black, halftone dots, sharp angular shadows and a restrained vivid ink accent; expressive rather than a realistic face" },
  { number: 39, id: "doodle", title: "Doodle", direction: "Loose cheeky doodle: spontaneous wobbly lines, asymmetric eyes, scribbles and playful color patches, intentionally hand-drawn" },
] as const;
export const ANIMAL_AVATAR_STYLES = [
  { number: 1, id: "fox-riso", title: "Fuchs · Riso", subject: "fox", direction: "Warm cheeky risograph, offset ink and grain, pointed ears and an original angular muzzle" },
  { number: 2, id: "cat-ink", title: "Katze · Tusche", subject: "cat", direction: "Dark expressive brush ink, independent curious expression, loose whisker marks and uneven contours" },
  { number: 4, id: "wolf-woodcut", title: "Wolf · Holzschnitt", subject: "wolf", direction: "Rough woodcut, bold carved fur shapes, strong contrast and a wild but friendly expression" },
  { number: 5, id: "lion-screenprint", title: "Löwe · Siebdruck", subject: "lion", direction: "Warm bold screenprint, playful mane silhouette, imperfect ink coverage and strong color blocks" },
  { number: 6, id: "tiger-retro", title: "Tiger · Retro", subject: "tiger", direction: "Warm retro print, striking irregular stripes, playful graphic proportions and grain" },
  { number: 8, id: "panda-minimal", title: "Panda · Minimal", subject: "panda", direction: "Minimal black and cream graphic, distinctive eye patches and rounded shapes, lively asymmetry" },
  { number: 10, id: "raccoon-sticker", title: "Waschbär · Sticker", subject: "raccoon", direction: "Cheeky high-contrast sticker illustration, bold imperfect contour and a distinctive eye mask" },
  { number: 11, id: "owl-night", title: "Eule · Nachtlicht", subject: "owl", direction: "Graphic night light, deep blue with luminous warm accents, alert round eyes and mysterious soft shapes" },
  { number: 14, id: "penguin-bauhaus", title: "Pinguin · Bauhaus", subject: "penguin", direction: "Clear reduced Bauhaus geometry, purposeful circles and blocks, playful asymmetry, black and cream with a primary-color accent" },
  { number: 15, id: "flamingo-line", title: "Flamingo · Linienkunst", subject: "flamingo", direction: "Elegant loose line art, curved long neck, few expressive coral and pink patches, full beak and head inside crop" },
  { number: 17, id: "deer-mosaic", title: "Hirsch · Mosaik", subject: "deer", direction: "Distinctive matte mosaic illustration, irregular colored tiles, branching antlers entirely inside crop and expressive eyes" },
  { number: 19, id: "chameleon-surreal", title: "Chamäleon · Surreal", subject: "chameleon", direction: "Playful surreal graphic, unexpected colorful flat patches, lively eye and curved silhouette suggesting movement" },
  { number: 20, id: "frog-doodle", title: "Frosch · Doodle", subject: "frog", direction: "Loose witty doodle, spontaneous wobbly lines, wide curious eyes and fresh green ink patches" },
] as const;

// The random queued job ID provides variety. Domain-separated hashes keep style,
// palette and pose independent, while retries and the reviewer get the same brief.
export function avatarChoiceIndex(job: ArtJob, domain: string, length: number): number {
  return createHash("sha256").update(`${AVATAR_STYLE_VERSION}:${job.id}:${domain}`).digest().readUInt32BE(0) % length;
}
export function selectedAvatarStyle(job: ArtJob) {
  const choices = job.presentation === "neutral" ? [...HUMAN_AVATAR_STYLES, ...ANIMAL_AVATAR_STYLES] : HUMAN_AVATAR_STYLES;
  return choices[avatarChoiceIndex(job, "style", choices.length)];
}
export function selectedAvatarPrompt(job: ArtJob): string {
  const style = selectedAvatarStyle(job);
  const palettes = ["petrol, cream and coral", "cobalt, ochre and cream", "deep navy with lime", "plum, apricot and turquoise", "forest green and warm pink", "burgundy, terracotta and pale blue"];
  const pose = ["front-facing with an asymmetric expression", "a slight three-quarter turn", "a playful head tilt"];
  const common = `Create one original CineGenius avatar. Approved style ${AVATAR_STYLE_VERSION}/${style.id}: ${style.direction}. Keep the selected craft visible: texture, hand-made marks and playful imperfections where appropriate; avoid a generic smooth vector portrait. Color suggestion: ${palettes[avatarChoiceIndex(job, "palette", palettes.length)]}; the selected style's explicit palette takes precedence. Pose: ${pose[avatarChoiceIndex(job, "pose", pose.length)]}. Vary silhouette, proportions, expression, outline and composition, not merely colors. One character on a quiet background, legible at thumbnail size. Centered square composition; keep the whole head and important ears/antlers/beak within a circular crop. Two-dimensional original illustration only: no photograph, copied character, identifiable real person, 3D, plastic, clay or glossy rendering. No text, logos, signatures, technical diagrams, violent or sexual imagery. This decorative avatar makes no claim about its owner's identity.`;
  if ("subject" in style) return `${common} Subject: one illustrated ${style.subject}, head and upper body or distinctive head-and-neck silhouette. Keep the animal recognizable, with character and wit. No human portrait or human-animal hybrid. It belongs to the freely selectable neutral collection; do not assign human gender to the animal.`;
  const hair = ["short tousled curls", "an angular bob", "cropped asymmetric hair", "loose medium-length waves", "closely cropped hair", "hair tied loosely back"];
  const presentation = job.presentation === "feminine" ? "feminine-presenting" : job.presentation === "masculine" ? "masculine-presenting" : "gender-neutral";
  return `${common} Subject: one invented ${presentation} human head-and-shoulders portrait with ${hair[avatarChoiceIndex(job, "hair", hair.length)]} expressed in this style's marks, not realistic strands. Include distinctive abstract facial features. Glasses are required for the pop-glasses direction and optional otherwise. No camera, studio scene or mascot costume. Every presentation is freely selectable by everyone and says nothing about the member's gender or pronouns.`;
}
