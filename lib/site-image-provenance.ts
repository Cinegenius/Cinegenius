/** Only repository-owned assets with confirmed AI provenance. Owner confirmation: 30 October 2026. */
const AI_GENERATED_SITE_IMAGES: ReadonlySet<string> = new Set(["/hero-bg.jpg"]);

export function isAiGeneratedSiteImage(source: unknown): boolean {
  return typeof source === "string" && AI_GENERATED_SITE_IMAGES.has(source);
}
