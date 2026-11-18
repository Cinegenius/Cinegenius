/** Node-only adapter. The production entrypoint is additionally server-only. */
import { Buffer } from "node:buffer";
import { PROFILE_ART_REFILL_POLICY as POLICY, isArtUUID, isPlatformArtKind, isArtPresentation, type ArtJob } from "@/lib/profile-art-refill-contract";
import { ArtPipelineError, readArtStream, withArtDeadline } from "@/lib/profile-art-io";

const themes = ["water", "moon", "sun", "earth", "sky", "ice", "heat", "mountains", "valley", "forest", "desert", "polar landscape"];
const outlines = {
  feminine: ["soft shoulder-length waves", "a clean chin-length bob", "hair loosely gathered at the back", "a short layered crop"],
  masculine: ["a short textured crop", "soft short curls", "neatly side-swept hair", "a close-cropped rounded hair outline"],
  neutral: ["a softly rounded short haircut", "an asymmetric ear-length bob", "short loose waves", "a simple medium-length hair outline"],
};
const palettes = ["muted petrol and sage", "slate blue and soft lavender", "warm terracotta and deep burgundy", "forest green and soft amber", "dusty turquoise and warm gray", "deep plum and muted coral"];
export function profileArtPrompt(job: ArtJob): string {
  const index = parseInt(job.id.slice(0, 8), 16);
  const common = "Create one original CineGenius illustration in the established CLASSIC FLAT GRAPHIC style: clean two-dimensional silhouettes, a few broad matte color fields, crisp gently curved edges and restrained editorial poster composition. Muted sage, blue-gray, dusty rose, warm sand or plum, with a very small optional lime accent. Generous negative space; legible as a small thumbnail. Absolutely no photorealism, 3D rendering, sculpted busts, clay, plastic, glossy materials, realistic hair, volumetric lighting or photographic scenery. No text, logos, signatures, wireframes, line drawings, technical patterns or harsh neon background. No real people or copied existing artwork. A genuinely different outline and composition, not merely a recoloring of an existing motif.";
  return job.kind === "cover"
    ? `${common} Theme: ${themes[index % themes.length]}. Peaceful natural landscape interpreted as a simple flat graphic: three to five broad landscape layers and a small number of distinct natural silhouettes; no animals or people, no fantasy adventure painting. Natural forms may be simplified into angular mountains or gently curved hills. No photo textures, realistic foliage, mist or detailed painted scenery. Wide panoramic composition, all important forms inside the central 5:2 crop. Choose an off-center focal point; avoid a generic central triangular mountain and oversized sun.`
    : `${common} One ${job.presentation === "feminine" ? "feminine-presenting" : job.presentation === "masculine" ? "masculine-presenting" : "gender-neutral"} human head-and-shoulders silhouette with ${outlines[job.presentation ?? "neutral"][index % 4]} drawn as one simple cut-paper shape, not hair strands. ${index % 2 ? "A slight three-quarter shoulder turn" : "Relaxed front-facing shoulders"}, head kept centered. Flat dark navy head with no eyes, mouth, nose detail or skin tones; a second muted flat shape may describe the hair or collar. Clearly readable silhouette, friendly and understated, not a realistic mannequin. No rim lighting or modeled facial volume. No hats, cameras, props or studio scenery. Quiet flat background in ${palettes[Math.floor(index / 4) % palettes.length]}, optionally one offset circle or broad curved color field. Centered square portrait, no cropped head. The presentation is freely selectable by everyone and does not describe a real user's identity.`;
}

export function createProfileArtProducer({ enabled = false, apiKey, fetcher = fetch }: { enabled?: boolean; apiKey?: string; fetcher?: typeof fetch } = {}) {
  return async (job: ArtJob, parent?: AbortSignal): Promise<Uint8Array> => {
    if (!enabled) throw new ArtPipelineError("producer_disabled");
    if (!apiKey || !apiKey.trim()) throw new ArtPipelineError("provider_unavailable");
    if (!isArtUUID(job.id) || !isPlatformArtKind(job.kind)) throw new ArtPipelineError("invalid_job");
    if (job.kind === "avatar" && !isArtPresentation(job.presentation)) throw new ArtPipelineError("invalid_presentation");
    return withArtDeadline(async signal => {
      // One attempt only; unknown outcomes must never trigger an automatic paid retry.
      const response = await fetcher("https://api.openai.com/v1/images/generations", {
        method: "POST", redirect: "error", cache: "no-store", signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: POLICY.model, prompt: profileArtPrompt(job), n: 1, quality: "low", size: job.kind === "avatar" ? "1024x1024" : "1536x1024", output_format: "webp", background: "opaque", moderation: "auto" }),
      });
      if (!response.ok) { void response.body?.cancel().catch(() => undefined); throw new ArtPipelineError("provider_failed"); }
      if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) { void response.body?.cancel().catch(() => undefined); throw new ArtPipelineError("provider_invalid"); }
      const declared = Number(response.headers.get("content-length") ?? 0);
      if (declared > POLICY.maxResponseBytes) { void response.body?.cancel().catch(() => undefined); throw new ArtPipelineError("body_too_large"); }
      const bytes = await readArtStream(response.body, POLICY.maxResponseBytes, signal);
      let payload: unknown;
      try { payload = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ArtPipelineError("provider_invalid"); }
      const data = (payload as {data?: {b64_json?: unknown; url?: unknown}[]})?.data;
      if (!Array.isArray(data) || data.length !== 1 || typeof data[0]?.b64_json !== "string" || data[0].url != null) throw new ArtPipelineError("provider_invalid");
      const base64 = data[0].b64_json;
      if (!base64.length || base64.length > Math.ceil(POLICY.maxInputBytes / 3) * 4 || base64.length % 4 || /[^A-Za-z0-9+/=]/.test(base64)) throw new ArtPipelineError("provider_invalid");
      const image = Buffer.from(base64, "base64");
      if (!image.length || image.byteLength > POLICY.maxInputBytes || image.toString("base64") !== base64) throw new ArtPipelineError("provider_invalid");
      return image; // Raster/container/dimension/content checks belong to preparation.
    }, parent, POLICY.providerTimeoutMs);
  };
}
