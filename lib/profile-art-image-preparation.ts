/** Node/server-only raster preparation. No URL fetch, filesystem, provider or storage access. */
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import sharp from "sharp";

export type ProfileArtKind = "avatar" | "cover";
export type RasterFormat = "jpeg" | "png" | "webp";
export const PROFILE_ART_IMAGE_POLICY = Object.freeze({
  maxInputBytes: 8 * 1024 * 1024,
  maxInputPixels: 16_777_216,
  maxInputSide: 8192,
  maxContainerChunks: 4096,
  maxReferences: 20_000,
  maxActiveJobs: 1,
  processingBudgetMs: 12_000,
  fingerprintVersion: "cg-art-dct32-gradient-v1" as const,
  nearPHashBits: 8,
  nearDHashBits: 24,
  nearEdgeBits: 12,
  targets: Object.freeze({
    avatar: Object.freeze({ width: 384, height: 384, maxBytes: 64_000 }),
    cover: Object.freeze({ width: 1500, height: 600, maxBytes: 180_000 }),
  }),
});

export type ProfileArtFingerprint = {
  version: typeof PROFILE_ART_IMAGE_POLICY.fingerprintVersion;
  /** SHA-256 of dimension-tagged canonical RGB pixels, before lossy WebP encoding. */
  canonicalPixelSHA256: string;
  /** SHA-256 of the actual decoded output RGB pixels, not file metadata. */
  pixelSHA256: string;
  /** Low-frequency DCT luminance hash: 63 bits (DC excluded), lowercase hex. */
  pHash: string;
  /** Horizontal + vertical luminance-gradient hash: 128 bits, lowercase hex. */
  dHash: string;
  /** Presence of the same gradients independent of their sign: 128 bits. */
  edgeHash: string;
};
export type ProfileArtComparisonSet = {
  scope: "all-catalog-art";
  /** Trusted worker attestation: includes legacy/shared/retired art, not just visible choices. */
  complete: true;
  snapshotID: string;
  entries: ReadonlyArray<{ artworkID: string; fingerprint: ProfileArtFingerprint }>;
};
export type ProfileArtImageErrorCode =
  | "invalid_input" | "empty_input" | "input_too_large" | "unsupported_format"
  | "invalid_container" | "animation_not_allowed" | "input_pixel_limit"
  | "decode_failed" | "output_too_large" | "processing_timeout" | "aborted"
  | "busy" | "invalid_comparison_set" | "comparison_set_incomplete"
  | "comparison_set_too_large" | "low_information" | "duplicate_pixels" | "similar_structure";
export type ProfileArtMatchEvidence = {
  artworkID: string;
  classification: "identical_canonical_pixels" | "identical_output_pixels" | "identical_cross_stage_pixels" | "similar_luminance_structure";
  pHashDistance?: number;
  dHashDistance?: number;
  edgeHashDistance?: number;
};
export type ProfileArtImagePreparationResult =
  | { ok: false; code: ProfileArtImageErrorCode; inventoryReady: false; match?: ProfileArtMatchEvidence }
  | {
      ok: true;
      status: "prepared_for_illustration_review";
      inventoryReady: false;
      requiresIllustrationReview: true;
      image: {
        kind: ProfileArtKind; format: "webp"; mime: "image/webp";
        width: number; height: number; bytes: Uint8Array; byteSHA256: string;
        sourceFormat: RasterFormat; sourceWidth: number; sourceHeight: number;
        resizePolicy: "auto-orient-centre-cover-srgb-white";
        fingerprint: ProfileArtFingerprint;
      };
      novelty: { scope: "supplied_complete_catalog_snapshot"; snapshotID: string; compared: number; semanticUniquenessProven: false };
    };

class PreparationFailure extends Error {
  readonly code: ProfileArtImageErrorCode;
  constructor(code: ProfileArtImageErrorCode) { super(code); this.code = code; }
}
let activeJobs = 0; // No waiting queue retains large input buffers. Do not change global sharp cache/concurrency.
const hex = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const shaPattern = /^[0-9a-f]{64}$/;
const failure = (code: ProfileArtImageErrorCode, match?: ProfileArtMatchEvidence): ProfileArtImagePreparationResult =>
  ({ ok: false, code, inventoryReady: false, ...(match ? { match } : {}) });

function validateComparisons(value: ProfileArtComparisonSet): ProfileArtImageErrorCode | null {
  if (!value || value.scope !== "all-catalog-art" || value.complete !== true) return "comparison_set_incomplete";
  if (typeof value.snapshotID !== "string" || !idPattern.test(value.snapshotID) || !Array.isArray(value.entries)) return "invalid_comparison_set";
  if (value.entries.length > PROFILE_ART_IMAGE_POLICY.maxReferences) return "comparison_set_too_large";
  const seen = new Set<string>();
  for (const entry of value.entries) {
    const f = entry?.fingerprint;
    if (!entry || typeof entry.artworkID !== "string" || !idPattern.test(entry.artworkID) || seen.has(entry.artworkID)
      || !f || f.version !== PROFILE_ART_IMAGE_POLICY.fingerprintVersion
      || typeof f.canonicalPixelSHA256 !== "string" || typeof f.pixelSHA256 !== "string" || typeof f.pHash !== "string" || typeof f.dHash !== "string" || typeof f.edgeHash !== "string"
      || !shaPattern.test(f.canonicalPixelSHA256) || !shaPattern.test(f.pixelSHA256)
      || !/^[0-7][0-9a-f]{15}$/.test(f.pHash) || !/^[0-9a-f]{32}$/.test(f.dHash) || !/^[0-9a-f]{32}$/.test(f.edgeHash)) return "invalid_comparison_set";
    seen.add(entry.artworkID);
  }
  return null;
}

function rasterFormat(bytes: Buffer): RasterFormat | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpeg";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null; // SVG/PDF/GIF/HEIF/TIFF never reach the decoder.
}
function inspectContainer(bytes: Buffer, format: RasterFormat): void {
  if (format === "png") {
    let offset = 8, count = 0, ended = false;
    while (offset < bytes.length) {
      if (++count > PROFILE_ART_IMAGE_POLICY.maxContainerChunks || offset + 12 > bytes.length) throw new PreparationFailure("invalid_container");
      const length = bytes.readUInt32BE(offset), type = bytes.toString("ascii", offset + 4, offset + 8);
      if (length > bytes.length - offset - 12) throw new PreparationFailure("invalid_container");
      if (type === "acTL" || type === "fcTL" || type === "fdAT") throw new PreparationFailure("animation_not_allowed");
      offset += length + 12;
      if (type === "IEND") { ended = length === 0 && offset === bytes.length; break; }
    }
    if (!ended) throw new PreparationFailure("invalid_container");
  } else if (format === "webp") {
    if (bytes.readUInt32LE(4) + 8 !== bytes.length) throw new PreparationFailure("invalid_container");
    let offset = 12, count = 0;
    while (offset < bytes.length) {
      if (++count > PROFILE_ART_IMAGE_POLICY.maxContainerChunks || offset + 8 > bytes.length) throw new PreparationFailure("invalid_container");
      const type = bytes.toString("ascii", offset, offset + 4), length = bytes.readUInt32LE(offset + 4);
      if (length > bytes.length - offset - 8) throw new PreparationFailure("invalid_container");
      if (type === "ANIM" || type === "ANMF" || (type === "VP8X" && length >= 1 && (bytes[offset + 8] & 2))) throw new PreparationFailure("animation_not_allowed");
      offset += 8 + length + (length % 2);
    }
    if (offset !== bytes.length) throw new PreparationFailure("invalid_container");
  }
}
const cosine = Array.from({ length: 8 }, (_, frequency) =>
  Array.from({ length: 32 }, (_, position) => Math.cos(((2 * position + 1) * frequency * Math.PI) / 64)));
function structuralHashes(gray: Uint8Array): Pick<ProfileArtFingerprint, "pHash" | "dHash" | "edgeHash"> {
  const mean = gray.reduce((sum, value) => sum + value, 0) / gray.length;
  const variance = gray.reduce((sum, value) => sum + (value - mean) ** 2, 0) / gray.length;
  if (!Number.isFinite(variance) || variance < 1) throw new PreparationFailure("low_information");
  const coefficients: number[] = [];
  for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
    if (u === 0 && v === 0) continue;
    let coefficient = 0;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) coefficient += gray[y * 32 + x] * cosine[u][x] * cosine[v][y];
    coefficients.push(coefficient * (u === 0 ? Math.SQRT1_2 : 1) * (v === 0 ? Math.SQRT1_2 : 1));
  }
  const sorted = [...coefficients].sort((a, b) => a - b), median = sorted[31];
  const zero = BigInt(0), one = BigInt(1);
  let p = zero;
  for (const coefficient of coefficients) p = (p << one) | (coefficient > median ? one : zero);
  let d = zero, edge = zero;
  const sample = (x: number, y: number) => gray[Math.round(y * 31 / 8) * 32 + Math.round(x * 31 / 8)];
  for (const vertical of [false, true]) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    // A tiny tolerance suppresses encoder noise in otherwise flat areas.
    const delta = vertical ? sample(x, y + 1) - sample(x, y) : sample(x + 1, y) - sample(x, y);
    d = (d << one) | (delta > 2 ? one : zero);
    edge = (edge << one) | (Math.abs(delta) > 2 ? one : zero);
  }
  return { pHash: p.toString(16).padStart(16, "0"), dHash: d.toString(16).padStart(32, "0"), edgeHash: edge.toString(16).padStart(32, "0") };
}
const nibbleBits = [0,1,1,2,1,2,2,3,1,2,2,3,2,3,3,4];
function hamming(a: string, b: string): number {
  let distance = 0;
  for (let i = 0; i < a.length; i++) distance += nibbleBits[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  return distance;
}
function findMatch(candidate: ProfileArtFingerprint, references: ProfileArtComparisonSet["entries"]): ProfileArtMatchEvidence | null {
  for (const { artworkID, fingerprint } of references) {
    if (candidate.canonicalPixelSHA256 === fingerprint.canonicalPixelSHA256) return { artworkID, classification: "identical_canonical_pixels" };
    if (candidate.pixelSHA256 === fingerprint.pixelSHA256) return { artworkID, classification: "identical_output_pixels" };
    if (candidate.canonicalPixelSHA256 === fingerprint.pixelSHA256 || candidate.pixelSHA256 === fingerprint.canonicalPixelSHA256)
      return { artworkID, classification: "identical_cross_stage_pixels" };
  }
  let closest: ProfileArtMatchEvidence | null = null;
  for (const { artworkID, fingerprint } of references) {
    const p = hamming(candidate.pHash, fingerprint.pHash), d = hamming(candidate.dHash, fingerprint.dHash), edge = hamming(candidate.edgeHash, fingerprint.edgeHash);
    // Inverting luminance is not a new illustration either. This remains a heuristic.
    const pDistance = Math.min(p, 63 - p);
    if (pDistance <= PROFILE_ART_IMAGE_POLICY.nearPHashBits && (d <= PROFILE_ART_IMAGE_POLICY.nearDHashBits || edge <= PROFILE_ART_IMAGE_POLICY.nearEdgeBits)
      && (!closest || pDistance + Math.min(d, edge) < closest.pHashDistance! + Math.min(closest.dHashDistance!, closest.edgeHashDistance!)))
      closest = { artworkID, classification: "similar_luminance_structure", pHashDistance: pDistance, dHashDistance: d, edgeHashDistance: edge };
  }
  return closest;
}
function pixelDigest(bytes: Uint8Array, width: number, height: number): string {
  return createHash("sha256").update(`cg-art-rgb-v1\0${width}x${height}\0`).update(bytes).digest("hex");
}

/**
 * Compare against ALL known catalog art, including legacy/shared/retired pictures.
 * `complete` is an explicit trusted-worker obligation, not a database lookup by this library.
 * Neither passing this heuristic nor this result confers semantic uniqueness/publication readiness.
 */
export async function prepareProfileArtImage(
  input: { kind: ProfileArtKind; bytes: Uint8Array },
  comparisons: ProfileArtComparisonSet,
  options: { signal?: AbortSignal } = {},
): Promise<ProfileArtImagePreparationResult> {
  if (!input || !["avatar", "cover"].includes(input.kind) || !(input.bytes instanceof Uint8Array)) return failure("invalid_input");
  if (!input.bytes.byteLength) return failure("empty_input");
  if (input.bytes.byteLength > PROFILE_ART_IMAGE_POLICY.maxInputBytes) return failure("input_too_large");
  const comparisonError = validateComparisons(comparisons);
  if (comparisonError) return failure(comparisonError);
  if (options.signal?.aborted) return failure("aborted");
  if (activeJobs >= PROFILE_ART_IMAGE_POLICY.maxActiveJobs) return failure("busy");
  activeJobs++;
  const began = performance.now(), target = PROFILE_ART_IMAGE_POLICY.targets[input.kind];
  const check = () => {
    if (options.signal?.aborted) throw new PreparationFailure("aborted");
    const remaining = PROFILE_ART_IMAGE_POLICY.processingBudgetMs - (performance.now() - began);
    if (remaining <= 0) throw new PreparationFailure("processing_timeout");
    return Math.max(1, Math.ceil(remaining / 1000));
  };
  try {
    const snapshot = { snapshotID: comparisons.snapshotID,
      entries: comparisons.entries.map(({ artworkID, fingerprint }) => ({ artworkID, fingerprint: { ...fingerprint } })) };
    const bytes = Buffer.from(input.bytes); // Isolated bounded snapshot; no caller-buffer mutation.
    const format = rasterFormat(bytes);
    if (!format) return failure("unsupported_format");
    inspectContainer(bytes, format);
    const image = sharp(bytes, { limitInputPixels: PROFILE_ART_IMAGE_POLICY.maxInputPixels, animated: false, failOn: "warning", sequentialRead: true }).timeout({ seconds: check() });
    const metadata = await image.metadata(); check();
    if (metadata.format !== format || !metadata.width || !metadata.height) return failure("decode_failed");
    if ((metadata.pages ?? 1) !== 1) return failure("animation_not_allowed");
    if (metadata.width > PROFILE_ART_IMAGE_POLICY.maxInputSide || metadata.height > PROFILE_ART_IMAGE_POLICY.maxInputSide
      || metadata.width * metadata.height > PROFILE_ART_IMAGE_POLICY.maxInputPixels) return failure("input_pixel_limit");
    const normalized = await image.rotate().toColourspace("srgb").flatten({ background: "#ffffff" }).removeAlpha()
      .resize({ width: target.width, height: target.height, fit: "cover", position: "centre", kernel: "lanczos3" })
      .raw().timeout({ seconds: check() }).toBuffer({ resolveWithObject: true }); check();
    if (normalized.info.width !== target.width || normalized.info.height !== target.height || normalized.info.channels !== 3) return failure("decode_failed");
    const canonicalPixelSHA256 = pixelDigest(normalized.data, target.width, target.height);
    // Do not use withMetadata/keepExif/keepIccProfile: no original metadata is retained.
    const output = await sharp(normalized.data, { raw: { width: target.width, height: target.height, channels: 3 } })
      .webp({ quality: 82, effort: 4 }).timeout({ seconds: check() }).toBuffer(); check();
    if (output.byteLength > target.maxBytes) return failure("output_too_large");
    const decoded = await sharp(output, { limitInputPixels: PROFILE_ART_IMAGE_POLICY.maxInputPixels, failOn: "warning" })
      .toColourspace("srgb").removeAlpha().raw().timeout({ seconds: check() }).toBuffer({ resolveWithObject: true }); check();
    if (decoded.info.width !== target.width || decoded.info.height !== target.height || decoded.info.channels !== 3) return failure("decode_failed");
    const gray = await sharp(decoded.data, { raw: { width: target.width, height: target.height, channels: 3 } })
      .resize(32, 32, { fit: "fill" }).greyscale().raw().timeout({ seconds: check() }).toBuffer(); check();
    if (gray.byteLength !== 1024) return failure("decode_failed");
    const fingerprint: ProfileArtFingerprint = { version: PROFILE_ART_IMAGE_POLICY.fingerprintVersion,
      canonicalPixelSHA256, pixelSHA256: pixelDigest(decoded.data, target.width, target.height), ...structuralHashes(gray) };
    const match = findMatch(fingerprint, snapshot.entries); check();
    if (match) return failure(match.classification === "similar_luminance_structure" ? "similar_structure" : "duplicate_pixels", match);
    return { ok: true, status: "prepared_for_illustration_review", inventoryReady: false, requiresIllustrationReview: true,
      image: { kind: input.kind, format: "webp", mime: "image/webp", width: target.width, height: target.height,
        bytes: output, byteSHA256: hex(output), sourceFormat: format, sourceWidth: metadata.width, sourceHeight: metadata.height,
        resizePolicy: "auto-orient-centre-cover-srgb-white", fingerprint },
      novelty: { scope: "supplied_complete_catalog_snapshot", snapshotID: snapshot.snapshotID, compared: snapshot.entries.length, semanticUniquenessProven: false } };
  } catch (error) {
    if (options.signal?.aborted) return failure("aborted");
    if (error instanceof PreparationFailure) return failure(error.code);
    const message = error instanceof Error ? error.message : "";
    if (/pixel limit/i.test(message)) return failure("input_pixel_limit");
    if (/timeout|timed out/i.test(message)) return failure("processing_timeout");
    return failure("decode_failed"); // Do not leak native errors, input contents or paths.
  } finally { activeJobs--; }
}
