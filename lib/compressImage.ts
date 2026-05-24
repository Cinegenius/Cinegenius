/**
 * Client-side image compression via Canvas API.
 * Resizes and converts to WebP before upload — no extra packages needed.
 *
 * Falls back to the original file if the browser cannot compress
 * (e.g. Safari < 16.4 without WebP encoding, HEIC files on old iOS).
 */

interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0–1
}

async function tryCompress(
  file: File | Blob,
  maxWidth: number,
  maxHeight: number,
  quality: number,
): Promise<File> {
  // Call createObjectURL BEFORE entering the Promise constructor.
  // On older iOS Safari, DOMExceptions thrown inside `new Promise()` constructors
  // are not reliably converted to rejections — they escape as uncaught errors.
  // Calling it here makes the throw a normal async throw that await/catch handles correctly.
  const url = URL.createObjectURL(file);

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

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

      ctx.drawImage(img, 0, 0, width, height);

      const baseName = (file instanceof File ? file.name : "image")
        .replace(/\.[^.]+$/, "");

      const finish = (blob: Blob | null, ext: string, mime: string) => {
        if (!blob) return reject(new Error("toBlob failed"));
        resolve(new File([blob], `${baseName}.${ext}`, { type: mime }));
      };

      // Safari < 16.4 throws synchronously for 'image/webp' — fall back to JPEG.
      try {
        canvas.toBlob(
          (blob) => finish(blob, "webp", "image/webp"),
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

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };

    img.src = url;
  });
}

export async function compressImage(
  file: File | Blob,
  options: CompressOptions = {},
): Promise<File> {
  const { maxWidth = 1920, maxHeight = 1920, quality = 0.82 } = options;

  try {
    return await tryCompress(file, maxWidth, maxHeight, quality);
  } catch {
    // Compression not possible on this browser/file type — upload original.
    // The server's size + magic-byte validation still applies.
    if (file instanceof File) return file;
    return new File([file], "image.jpg", { type: "image/jpeg" });
  }
}

/** Convenience wrapper for avatar uploads — smaller max size. */
export function compressAvatar(file: File | Blob): Promise<File> {
  return compressImage(file, { maxWidth: 500, maxHeight: 500, quality: 0.88 });
}

/**
 * Safe wrapper around URL.createObjectURL — returns null instead of throwing.
 * iOS Safari throws "The string did not match the expected pattern." for HEIC/HEIF.
 */
export function safeObjectURL(file: File | Blob): string | null {
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}
