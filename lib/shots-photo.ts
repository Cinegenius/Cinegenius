import { SHOT_MAX_EDGE as CONTRACT_MAX_EDGE, SHOT_MAX_PHOTO_BYTES } from "./shots";
import type { ShotLook } from "./shots";
export type { ShotLook, ShotFormat } from "./shots";
export type ShotPhoto = { blob: Blob; width: number; height: number };
export const SHOT_LOOKS: readonly { id: ShotLook; grain: number }[] = [
  { id: "original", grain: 0 }, { id: "film", grain: 20 }, { id: "photo", grain: 0 }, { id: "bw", grain: 45 },
];
export const SHOT_IMPORT_BYTES = 20 * 1024 * 1024;
export const SHOT_EXPORT_BYTES = SHOT_MAX_PHOTO_BYTES;
export const SHOT_MAX_EDGE = CONTRACT_MAX_EDGE;
export type ShotPhotoErrorCode = "fileType" | "fileSize" | "imageSize" | "decode" | "canvas" | "export";
export class ShotPhotoError extends Error {
  readonly code: ShotPhotoErrorCode;
  constructor(code: ShotPhotoErrorCode) { super(code); this.name = "ShotPhotoError"; this.code = code; }
}

function active(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException("Aborted", "AbortError"); }

export function shotPhotoDimensions(width: number, height: number): { width: number; height: number } {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 40_000_000) throw new ShotPhotoError("imageSize");
  const scale = Math.min(1, SHOT_MAX_EDGE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function decode(blob: Blob, signal?: AbortSignal): Promise<HTMLImageElement> {
  active(signal);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob), image = new Image();
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true; URL.revokeObjectURL(url); signal?.removeEventListener("abort", cancel);
      image.onload = null; image.onerror = null;
      if (error) { image.src = ""; reject(error); } else resolve(image);
    };
    const cancel = () => finish(new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", cancel, { once: true });
    image.onload = () => finish(); image.onerror = () => finish(new ShotPhotoError("decode")); image.src = url;
  });
}

function jpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (!blob || blob.type !== "image/jpeg" || !blob.size || blob.size > SHOT_EXPORT_BYTES) reject(new ShotPhotoError("export"));
    else resolve(blob);
  }, "image/jpeg", .84));
}

/** Decode and redraw every import: the exported JPEG contains pixels, never the source EXIF. */
export async function importShotPhoto(file: File, signal?: AbortSignal): Promise<ShotPhoto> {
  active(signal);
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new ShotPhotoError("fileType");
  if (!file.size || file.size > SHOT_IMPORT_BYTES) throw new ShotPhotoError("fileSize");
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer()); active(signal);
  const signature = file.type === "image/jpeg" ? header[0] === 255 && header[1] === 216 && header[2] === 255
    : file.type === "image/png" ? [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => header[index] === value)
      : [82, 73, 70, 70].every((value, index) => header[index] === value) && [87, 69, 66, 80].every((value, index) => header[index + 8] === value);
  if (!signature) throw new ShotPhotoError("fileType");
  const image = await decode(file, signal);
  let canvas: HTMLCanvasElement | undefined;
  try {
    active(signal);
    const { width, height } = shotPhotoDimensions(image.naturalWidth, image.naturalHeight);
    canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d"); if (!context) throw new ShotPhotoError("canvas");
    context.fillStyle = "#fff"; context.fillRect(0, 0, width, height); context.drawImage(image, 0, 0, width, height);
    const blob = await jpeg(canvas); active(signal); return { blob, width, height };
  } finally { image.src = ""; if (canvas) { canvas.width = 0; canvas.height = 0; } }
}

/** Always render from the normalized original. Grain is deterministic and never animated. */
export async function renderShotPhoto(original: ShotPhoto, look: ShotLook, grain: number, signal?: AbortSignal): Promise<ShotPhoto> {
  active(signal);
  if (!SHOT_LOOKS.some(item => item.id === look) || !Number.isFinite(grain) || grain < 0 || grain > 100) throw new ShotPhotoError("export");
  if (look === "original" && grain === 0) return original;
  const image = await decode(original.blob, signal), canvas = document.createElement("canvas");
  canvas.width = original.width; canvas.height = original.height;
  try {
    active(signal);
    const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) throw new ShotPhotoError("canvas");
    context.drawImage(image, 0, 0, original.width, original.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height), bytes = pixels.data;
    let seed = 7013;
    for (let row = 0; row < canvas.height; row++) {
      if (row % 64 === 0) { active(signal); await new Promise<void>(resolve => setTimeout(resolve, 0)); }
      for (let col = 0; col < canvas.width; col++) {
        const index = (row * canvas.width + col) * 4;
        let r = bytes[index], g = bytes[index + 1], b = bytes[index + 2];
        const luma = .2126 * r + .7152 * g + .0722 * b;
        if (look === "film") { r = (r - 128) * .94 + 136; g = (g - 128) * .96 + 132; b = (b - 128) * .94 + 128; }
        else if (look === "photo") { r = (luma + (r - luma) * 1.06 - 128) * 1.035 + 128; g = (luma + (g - luma) * 1.06 - 128) * 1.035 + 128; b = (luma + (b - luma) * 1.06 - 128) * 1.035 + 128; }
        else if (look === "bw") r = g = b = (luma - 128) * 1.07 + 130;
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        const noise = ((seed >>> 0) / 4294967295 - .5) * grain * .64;
        bytes[index] = r + noise; bytes[index + 1] = g + noise; bytes[index + 2] = b + noise;
      }
    }
    active(signal); context.putImageData(pixels, 0, 0);
    const blob = await jpeg(canvas); active(signal); return { ...original, blob };
  } finally { image.src = ""; canvas.width = 0; canvas.height = 0; }
}
