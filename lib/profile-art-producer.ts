/** Node-only adapter. The production entrypoint is additionally server-only. */
import { Buffer } from "node:buffer";
import { PROFILE_ART_REFILL_POLICY as POLICY, isArtUUID, isPlatformArtKind, type ArtJob } from "@/lib/profile-art-refill-contract";
import { ArtPipelineError, readArtStream, withArtDeadline } from "@/lib/profile-art-io";

const themes = ["water", "moon", "sun", "earth", "sky", "ice", "heat", "mountains", "valley", "forest", "desert", "polar landscape"];
function promptFor(job: ArtJob): string {
  const index = parseInt(job.id.slice(0, 8), 16);
  const common = "Create one original editorial illustration for CineGenius, a film-production community. Restrained cinematic shapes, charcoal and rich color with a small lime accent. No text, logos, signatures, real people or copied existing artwork. A distinct new composition, not a recoloring of another illustration.";
  return job.kind === "cover"
    ? `${common} Theme: ${themes[index % themes.length]}. Nature cover, generous horizontal composition; important forms inside the central 5:2 crop.`
    : `${common} Abstract ${["masculine-presenting", "feminine-presenting", "androgynous"][index % 3]} silhouette. Friendly, faceless, no identifiable ethnicity; centered square portrait, readable at small sizes. This is a freely chosen illustration, not a statement of its owner's identity.`;
}

export function createProfileArtProducer({ enabled = false, apiKey, fetcher = fetch }: { enabled?: boolean; apiKey?: string; fetcher?: typeof fetch } = {}) {
  return async (job: ArtJob, parent?: AbortSignal): Promise<Uint8Array> => {
    if (!enabled) throw new ArtPipelineError("producer_disabled");
    if (!apiKey || !apiKey.trim()) throw new ArtPipelineError("provider_unavailable");
    if (!isArtUUID(job.id) || !isPlatformArtKind(job.kind)) throw new ArtPipelineError("invalid_job");
    return withArtDeadline(async signal => {
      // One attempt only; unknown outcomes must never trigger an automatic paid retry.
      const response = await fetcher("https://api.openai.com/v1/images/generations", {
        method: "POST", redirect: "error", cache: "no-store", signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: POLICY.model, prompt: promptFor(job), n: 1, quality: "low", size: job.kind === "avatar" ? "1024x1024" : "1536x1024", output_format: "webp", background: "opaque", moderation: "auto" }),
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
