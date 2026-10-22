/**
 * Client-side image compression via Canvas API.
 * Resizes and converts to WebP before upload — no extra packages needed.
 *
 * Uses FileReader instead of URL.createObjectURL so that iOS Safari never
 * throws "The string did not match the expected pattern." — a DOMException
 * that occurs when iOS labels a HEIC file as JPEG before the conversion is
 * complete and the blob URL mechanism can't handle the raw bytes.
 */

import { MAX_UPLOAD_BYTES } from "./upload-limits";

interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0–1
  /** Keep the output below the request payload limit used by server uploads. */
  maxBytes?: number;
}

export const MAX_FUNCTION_UPLOAD_BYTES = MAX_UPLOAD_BYTES;
const PASSTHROUGH_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function readAsDataURL(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

async function tryCompress(
  file: File | Blob,
  maxWidth: number,
  maxHeight: number,
  quality: number,
): Promise<File> {
  // FileReader.readAsDataURL triggers the actual HEIC→JPEG conversion on iOS,
  // so img.src never sees raw HEIC bytes — no DOMException possible.
  const dataUrl = await readAsDataURL(file);

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width  = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas unavailable"));

      try {
        ctx.drawImage(img, 0, 0, width, height);
      } catch {
        // On iOS, canvas can't draw HEIC even when img.onload fired
        return reject(new Error("Canvas draw failed"));
      }

      const baseName = (file instanceof File ? file.name : "image")
        .replace(/\.[^.]+$/, "");

      const finish = (blob: Blob | null, ext: string, mime: string) => {
        if (!blob) return reject(new Error("toBlob failed"));
        resolve(new File([blob], `${baseName}.${ext}`, { type: mime }));
      };

      // Safari < 16.4 does not support WebP encoding — fall back to JPEG.
      try {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              // WebP not supported (iOS < 16.4) — try JPEG
              canvas.toBlob((b) => finish(b, "jpg", "image/jpeg"), "image/jpeg", quality);
            } else {
              finish(blob, "webp", "image/webp");
            }
          },
          "image/webp",
          quality,
        );
      } catch {
        canvas.toBlob(
          (blob) => finish(blob, "jpg", "image/jpeg"),
          "image/jpeg",
          quality,
        );
      }
    };

    img.onerror = () => reject(new Error("Image load failed"));

    img.src = dataUrl;
  });
}

export async function compressImage(
  file: File | Blob,
  options: CompressOptions = {},
): Promise<File> {
  const { maxWidth = 1920, maxHeight = 1920, quality = 0.82 } = options;
  const { maxBytes } = options;

  if (maxBytes !== undefined && file.size <= maxBytes && file instanceof File && PASSTHROUGH_MIME_TYPES.has(file.type)) {
    return file;
  }

  try {
    if (maxBytes === undefined) {
      return await tryCompress(file, maxWidth, maxHeight, quality);
    }

    // Vercel Functions reject request bodies larger than 4.5 MB before our
    // upload route can respond. Leave room for multipart boundaries and
    // progressively reduce dimensions/quality until the file is safely below
    // the shared 4 MB upload cap.
    const attempts = [
      { scale: 1, quality },
      { scale: 1, quality: Math.min(quality, 0.72) },
      { scale: 0.85, quality: Math.min(quality, 0.68) },
      { scale: 0.7, quality: Math.min(quality, 0.62) },
      { scale: 0.55, quality: Math.min(quality, 0.56) },
      { scale: 0.45, quality: Math.min(quality, 0.5) },
    ];

    for (const attempt of attempts) {
      const compressed = await tryCompress(
        file,
        Math.max(320, Math.round(maxWidth * attempt.scale)),
        Math.max(320, Math.round(maxHeight * attempt.scale)),
        attempt.quality,
      );
      if (compressed.size <= maxBytes) return compressed;
    }

    throw new Error("Bild überschreitet Uploadgröße");
  } catch (cause) {
    // Keep the legacy fallback only when no request-body limit is configured.
    if (maxBytes === undefined) {
      if (file instanceof File) return file;
      return new File([file], "image.jpg", { type: "image/jpeg" });
    }
    if (file instanceof File && file.size <= maxBytes && PASSTHROUGH_MIME_TYPES.has(file.type)) return file;
    if (cause instanceof Error && cause.message === "Bild überschreitet Uploadgröße") {
      throw new Error("Das Foto ist zu groß für den Upload. Bitte wähle ein kleineres Bild oder exportiere es als JPG, PNG oder WEBP.");
    }
    throw new Error("Das Foto konnte im Browser nicht verkleinert werden. Bitte wähle ein kleineres JPG-, PNG- oder WEBP-Bild.");
  }
}

/** Convenience wrapper for avatar uploads — smaller max size. */
export function compressAvatar(file: File | Blob): Promise<File> {
  return compressImage(file, { maxWidth: 500, maxHeight: 500, quality: 0.88, maxBytes: MAX_FUNCTION_UPLOAD_BYTES });
}

/**
 * Safe wrapper around URL.createObjectURL — returns null instead of throwing.
 * Used only for instant preview; errors are silently ignored.
 */
export function safeObjectURL(file: File | Blob): string | null {
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}
