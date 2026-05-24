/**
 * Client-side image compression via Canvas API.
 * Resizes and converts to WebP before upload — no extra packages needed.
 *
 * Uses FileReader instead of URL.createObjectURL so that iOS Safari never
 * throws "The string did not match the expected pattern." — a DOMException
 * that occurs when iOS labels a HEIC file as JPEG before the conversion is
 * complete and the blob URL mechanism can't handle the raw bytes.
 */

interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0–1
}

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

  try {
    return await tryCompress(file, maxWidth, maxHeight, quality);
  } catch {
    // Compression failed — upload original. Server validates size + magic bytes.
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
 * Used only for instant preview; errors are silently ignored.
 */
export function safeObjectURL(file: File | Blob): string | null {
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}
