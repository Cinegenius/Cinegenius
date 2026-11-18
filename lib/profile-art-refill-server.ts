import "server-only";
import { db } from "@/lib/db";
import { PROFILE_ART_REFILL_ENABLED, PROFILE_ART_READER_ENABLED, isArtUUID, isPlatformArtKind, type PlatformArtKind } from "@/lib/profile-art-refill-contract";
import { ArtPipelineError, withArtDeadline } from "@/lib/profile-art-io";
import { createProfileArtProducer } from "@/lib/profile-art-producer";
import { createProfileArtStorage } from "@/lib/profile-art-storage";
import { runProfileArtRefill, type ArtQueue, type ArtCatalogSnapshot } from "@/lib/profile-art-refill";
import { readProfileArtResponse } from "@/lib/profile-art-reader";

async function rpc(name: string, args: Record<string, unknown>, parent?: AbortSignal): Promise<unknown> {
  return withArtDeadline(async signal => {
    const {data, error} = await db.rpc(name, args).abortSignal(signal);
    if (error) {
      if (error.message === "ART_CATALOG_CHANGED") throw new ArtPipelineError("catalog_changed");
      throw new ArtPipelineError("database_failed");
    }
    return data;
  }, parent, 5000);
}
const queue: ArtQueue = {
  claim: signal => rpc("profile_art_claim_refill", {}, signal),
  snapshot: async signal => await rpc("profile_art_catalog_snapshot", {}, signal) as ArtCatalogSnapshot,
  stage: (job, revision, candidate, signal) => rpc("profile_art_stage_candidate", {p_job: job.id, p_token: job.token, p_revision: revision, p_candidate: candidate}, signal),
  fail: async (job, code) => { await rpc("profile_art_fail_refill", {p_job: job.id, p_token: job.token, p_code: code}); },
};

/** Internal worker only. No public route, Server Action, scheduler or user input. */
export async function runServerProfileArtRefill(signal?: AbortSignal) {
  if (!PROFILE_ART_REFILL_ENABLED) return {status: "disabled" as const, inventoryReady: false as const};
  const storage = createProfileArtStorage(db.storage);
  return runProfileArtRefill({queue, produce: createProfileArtProducer({enabled: true, apiKey: process.env.OPENAI_API_KEY}), putVerified: storage.putVerified}, {enabled: true, signal});
}
export async function enqueueServerProfileArtRefill(kind: PlatformArtKind, requestKey: string) {
  if (!PROFILE_ART_REFILL_ENABLED) return {status: "disabled" as const};
  if (!isPlatformArtKind(kind) || !isArtUUID(requestKey)) throw new ArtPipelineError("invalid_job");
  return rpc("profile_art_enqueue_refill", {p_kind: kind, p_request: requestKey});
}
export async function readServerProfileArt(request: Request) {
  if (!PROFILE_ART_READER_ENABLED) return readProfileArtResponse(request, null, false);
  const storage = createProfileArtStorage(db.storage);
  return readProfileArtResponse(request, {descriptor: (kind, mediaKey, signal) => rpc("profile_art_read_descriptor", {p_kind: kind, p_media: mediaKey}, signal), read: storage.read}, true);
}
