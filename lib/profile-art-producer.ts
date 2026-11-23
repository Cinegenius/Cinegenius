/** Node-only adapter. The production entrypoint is additionally server-only. */
import { selectedAvatarPrompt } from "@/lib/profile-art-selected-styles";
import { Buffer } from "node:buffer";
import { PROFILE_ART_REFILL_POLICY as POLICY, isArtUUID, isPlatformArtKind, isArtPresentation, type ArtJob } from "@/lib/profile-art-refill-contract";
import { ArtPipelineError, readArtStream, withArtDeadline } from "@/lib/profile-art-io";

const themes = ["water", "moon", "sun", "earth", "sky", "ice", "heat", "mountains", "valley", "forest", "desert", "polar landscape"];
const palettes = ["petrol and sage", "slate blue and lavender", "terracotta and burgundy", "forest green and amber", "turquoise and warm gray", "plum and coral", "cobalt and warm ochre", "apricot and muted lime"];
const styles = [
  "Evening light: matte two-dimensional editorial shapes with a soft dusk gradient, a restrained face and generous negative space",
  "Color fields: expressive broad color blocks, a distinctive graphic head outline, simplified facial planes and one confident contrasting color",
  "Paper collage: overlapping cut-paper shapes with an original asymmetric silhouette and a few angular facial details; no paper texture simulation",
  "Soft forms: rounded matte silhouettes, gentle flat gradients and understated friendly facial features; no cartoon grin",
  "Facets: an original angular graphic portrait or natural landscape, a small number of large facets, clean negative space and no wireframe",
  "Color flow: broad flowing ribbons of color contained within a distinct abstract silhouette or natural landscape; no technical pattern",
];
export function profileArtPrompt(job: ArtJob): string {
  if (job.kind === "avatar") return selectedAvatarPrompt(job);
  const index = parseInt(job.id.slice(0, 8), 16);
  const common = `Create one original CineGenius illustration in the approved mixed ABSTRACT GRAPHIC family. Selected direction: ${styles[index % styles.length]}. Palette: ${palettes[Math.floor(index / styles.length) % palettes.length]}. Some motifs may use stronger colors, balanced by a very small optional lime accent. Keep the artwork matte, two-dimensional, friendly and legible as a small thumbnail. Absolutely no photorealism, 3D rendering, sculpted busts, clay, plastic, glossy materials, realistic hair or photographic scenery. No text, logos, signatures or technical diagrams. No real people or copied existing artwork. Vary the silhouette, pose, hairstyle, proportions and composition, not merely the colors of an existing motif.`;
  return `${common} Theme: ${themes[Math.floor(index / 7) % themes.length]}. Peaceful natural landscape interpreted through broad graphic layers: no animals or people, no fantasy adventure painting. Natural forms may be angular mountains, curved hills, flowing water, forests, sky or dunes. No realistic foliage or detailed painted scenery. Wide panoramic composition, important forms inside the central 5:2 crop. Use an off-center focal point; avoid repeating a central triangular mountain and oversized sun.`;
}

export function profileArtGenerationRequest(job: ArtJob) {
  if (!isArtUUID(job.id) || !isPlatformArtKind(job.kind)) throw new ArtPipelineError("invalid_job");
  if (job.kind === "avatar" && !isArtPresentation(job.presentation)) throw new ArtPipelineError("invalid_presentation");
  return { model: POLICY.model, prompt: profileArtPrompt(job), n: 1, quality: "low", size: job.kind === "avatar" ? "1024x1024" : "1536x1024", output_format: "webp", background: "opaque", moderation: "auto" };
}

export function decodeProfileArtImage(payload: unknown): Uint8Array {
  const data = (payload as {data?: {b64_json?: unknown; url?: unknown}[]})?.data;
  if (!Array.isArray(data) || data.length !== 1 || typeof data[0]?.b64_json !== "string" || data[0].url != null) throw new ArtPipelineError("provider_invalid");
  const base64 = data[0].b64_json;
  if (!base64.length || base64.length > Math.ceil(POLICY.maxInputBytes / 3) * 4 || base64.length % 4 || /[^A-Za-z0-9+/=]/.test(base64)) throw new ArtPipelineError("provider_invalid");
  const image = Buffer.from(base64, "base64");
  if (!image.length || image.byteLength > POLICY.maxInputBytes || image.toString("base64") !== base64) throw new ArtPipelineError("provider_invalid");
  return image;
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
        body: JSON.stringify(profileArtGenerationRequest(job)),
      });
      if (!response.ok) { void response.body?.cancel().catch(() => undefined); throw new ArtPipelineError("provider_failed"); }
      if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) { void response.body?.cancel().catch(() => undefined); throw new ArtPipelineError("provider_invalid"); }
      const declared = Number(response.headers.get("content-length") ?? 0);
      if (declared > POLICY.maxResponseBytes) { void response.body?.cancel().catch(() => undefined); throw new ArtPipelineError("body_too_large"); }
      const bytes = await readArtStream(response.body, POLICY.maxResponseBytes, signal);
      let payload: unknown;
      try { payload = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ArtPipelineError("provider_invalid"); }
      return decodeProfileArtImage(payload);
    }, parent, POLICY.providerTimeoutMs);
  };
}
