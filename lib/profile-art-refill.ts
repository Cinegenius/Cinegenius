import { prepareProfileArtImage, validateProfileArtComparisons, type ProfileArtComparisonSet, type ProfileArtFingerprint } from "@/lib/profile-art-image-preparation";
import { PROFILE_ART_REFILL_POLICY as POLICY, isArtUUID, isPlatformArtKind, type ArtJob } from "@/lib/profile-art-refill-contract";
import { ArtPipelineError, withArtDeadline } from "@/lib/profile-art-io";
import { artBytesSHA256 } from "@/lib/profile-art-storage";
import type { ProfileArtReview } from "@/lib/profile-art-reviewer";

export type ArtCatalogSnapshot = { revision: number; comparisons: ProfileArtComparisonSet };
export type ArtCandidate = { sourceSHA256: string; byteSHA256: string; verifiedSHA256: string; byteLength: number; fingerprint: ProfileArtFingerprint };
export type ArtQueue = {
  claim(signal: AbortSignal): Promise<unknown>;
  snapshot(signal: AbortSignal): Promise<ArtCatalogSnapshot>;
  stage(job: ArtJob, revision: number, candidate: ArtCandidate, signal: AbortSignal): Promise<unknown>;
  fail(job: ArtJob, code: string): Promise<void>;
};
export type ArtRefillDependencies = {
  queue: ArtQueue;
  produce(job: ArtJob, signal: AbortSignal): Promise<Uint8Array>;
  putVerified(kind: ArtJob["kind"], mediaKey: string, bytes: Uint8Array, signal: AbortSignal): Promise<{sha256: string; byteLength: number}>;
  review?(job: ArtJob, bytes: Uint8Array, signal: AbortSignal): Promise<ProfileArtReview>;
  release?(job: ArtJob, review: ProfileArtReview, verifiedSHA: string, signal: AbortSignal): Promise<unknown>;
};
export async function runProfileArtRefill(deps: ArtRefillDependencies, {enabled = false, signal}: {enabled?: boolean; signal?: AbortSignal} = {}) {
  if (!enabled) return {status: "disabled" as const, inventoryReady: false as const};
  let job: ArtJob | null = null;
  let staging = false;
  try {
    return await withArtDeadline(async bounded => {
      const claimed = await deps.queue.claim(bounded) as ArtJob | null;
      if (!claimed) return {status: "idle" as const, inventoryReady: false as const};
      if (!isArtUUID(claimed.id) || !isArtUUID(claimed.mediaKey) || !isArtUUID(claimed.token) || !isPlatformArtKind(claimed.kind)
        || typeof claimed.expiresAt !== "string" || !Number.isFinite(Date.parse(claimed.expiresAt)) || Date.parse(claimed.expiresAt) <= Date.now()) throw new ArtPipelineError("invalid_job");
      job = claimed;
      const snapshot = await deps.queue.snapshot(bounded);
      if (!Number.isSafeInteger(snapshot?.revision) || snapshot.revision < 0 || snapshot.comparisons?.complete !== true || snapshot.comparisons.scope !== "all-catalog-art" || snapshot.comparisons.snapshotID !== `r_${snapshot.revision}` || !Array.isArray(snapshot.comparisons.entries) || snapshot.comparisons.entries.length > POLICY.maxCatalogReferences) throw new ArtPipelineError("catalog_incomplete");
      if (validateProfileArtComparisons(snapshot.comparisons)) throw new ArtPipelineError("catalog_incomplete");
      const bytes = await deps.produce(claimed, bounded);
      if (bounded.aborted) throw new ArtPipelineError("interrupted");
      const prepared = await prepareProfileArtImage({kind: claimed.kind, bytes}, snapshot.comparisons, {signal: bounded});
      if (!prepared.ok) throw new ArtPipelineError(prepared.code);
      const review = deps.review ? await deps.review(claimed, prepared.image.bytes, bounded) : null;
      const verified = await deps.putVerified(claimed.kind, claimed.mediaKey, prepared.image.bytes, bounded);
      if (bounded.aborted) throw new ArtPipelineError("interrupted");
      if (verified.sha256 !== prepared.image.byteSHA256 || verified.byteLength !== prepared.image.bytes.byteLength) throw new ArtPipelineError("storage_mismatch");
      staging = true;
      const receipt = await deps.queue.stage(claimed, snapshot.revision, {sourceSHA256: artBytesSHA256(bytes), byteSHA256: prepared.image.byteSHA256, verifiedSHA256: verified.sha256, byteLength: verified.byteLength, fingerprint: prepared.image.fingerprint}, bounded) as {jobId?: unknown; state?: unknown; inventoryReady?: unknown} | null;
      if (receipt?.jobId !== claimed.id || receipt.state !== "review" || receipt.inventoryReady !== false) throw new ArtPipelineError("invalid_receipt");
      if (review && deps.release) {
        const release = await deps.release(claimed, review, verified.sha256, bounded) as {status?: string; inventoryReady?: boolean; jobId?: string};
        if (release?.status === "ready" && release.inventoryReady === true && release.jobId === claimed.id) return {status: "ready" as const, jobId: claimed.id, inventoryReady: true as const};
        if (release?.status === "rejected" && release.inventoryReady === false) return {status: "rejected" as const, jobId: claimed.id, inventoryReady: false as const};
        if (release?.status !== "review" || release.inventoryReady !== false) throw new ArtPipelineError("invalid_receipt");
      }
      return {status: "review" as const, jobId: claimed.id, inventoryReady: false as const};
    }, signal, POLICY.workerTimeoutMs);
  } catch (error) {
    const code = error instanceof ArtPipelineError && /^[a-z_]{1,48}$/.test(error.code) ? error.code : "refill_failed";
    if (job) {
      try { await withArtDeadline(() => deps.queue.fail(job!, code), undefined, 5000); }
      catch { return {status: "unconfirmed" as const, code, inventoryReady: false as const}; }
    }
    return {status: staging ? "unconfirmed" as const : "failed" as const, code, inventoryReady: false as const};
  }
}
