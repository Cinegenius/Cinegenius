/**
 * lib/uploadGuard.ts
 * Server-side file upload validation.
 *
 * Design principles:
 * - File is read ONCE into a buffer. All checks run on that buffer.
 *   The same buffer is returned for Supabase upload (no double-read).
 * - MIME type from the Content-Type header is intentionally NOT trusted
 *   for anything security-relevant. Magic bytes from the actual file
 *   content are the authoritative source of truth for file type.
 * - Extension is derived from the validated magic bytes, never from
 *   the client-supplied filename or Content-Type header.
 * - Storage paths are user-scoped and contain a UUID to prevent
 *   overwrite attacks and path traversal.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Maximum upload size in bytes. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Each entry maps a canonical MIME type to:
 *  - ext: the file extension to use in storage
 *  - magic: the byte signature at the start of the file
 *  - offset: byte offset where the signature starts (usually 0)
 */
const SIGNATURES: Array<{
  mime: string;
  ext: string;
  magic: number[];
  offset: number;
}> = [
  // JPEG — FF D8 FF
  { mime: "image/jpeg", ext: "jpg",  magic: [0xFF, 0xD8, 0xFF],               offset: 0 },
  // PNG — 89 50 4E 47 0D 0A 1A 0A
  { mime: "image/png",  ext: "png",  magic: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0 },
  // WebP — RIFF????WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
  // Checked in two parts: [0x52,0x49,0x46,0x46] at 0, [0x57,0x45,0x42,0x50] at 8
  { mime: "image/webp", ext: "webp", magic: [0x52, 0x49, 0x46, 0x46],          offset: 0 },
  // HEIC/HEIF — 'ftyp' box starts at byte 4
  { mime: "image/heic", ext: "heic", magic: [0x66, 0x74, 0x79, 0x70],          offset: 4 },
];

/** Allowed MIME types derived from SIGNATURES — single source of truth. */
export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set(
  SIGNATURES.map((s) => s.mime)
);

// How many bytes we need to read to check all signatures (WebP needs 12)
const MAGIC_HEADER_BYTES = 16;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the canonical MIME type based on magic bytes in `header`,
 * or null if the bytes don't match any known signature.
 *
 * Note: WebP has a split signature (bytes 0-3 AND bytes 8-11), so
 * it requires a separate check.
 */
function detectMimeFromBytes(header: Uint8Array): string | null {
  for (const sig of SIGNATURES) {
    if (sig.mime === "image/webp") {
      // WebP: RIFF at 0 AND WEBP at 8
      const riff = [0x52, 0x49, 0x46, 0x46];
      const webp = [0x57, 0x45, 0x42, 0x50];
      const riffMatch = riff.every((b, i) => header[i] === b);
      const webpMatch = webp.every((b, i) => header[8 + i] === b);
      if (riffMatch && webpMatch) return sig.mime;
      continue;
    }

    const match = sig.magic.every((b, i) => header[sig.offset + i] === b);
    if (match) return sig.mime;
  }
  return null;
}

function extForMime(mime: string): string {
  return SIGNATURES.find((s) => s.mime === mime)?.ext ?? "jpg";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ValidatedUpload = {
  /** The full file content — use this for the Supabase upload (already buffered). */
  buffer: ArrayBuffer;
  /** MIME type confirmed by magic bytes — use as contentType for storage. */
  mime: string;
  /** File extension derived from magic bytes — use in the storage path. */
  ext: string;
};

export type UploadValidationError = {
  error: string;
  status: 400 | 413 | 415;
};

/**
 * Validates a File upload server-side.
 *
 * - Reads the file ONCE into an ArrayBuffer.
 * - Checks size limit.
 * - Checks magic bytes (actual file content), not the Content-Type header.
 * - Returns { buffer, mime, ext } on success, or { error, status } on failure.
 *
 * The returned `buffer` should be passed directly to Supabase Storage
 * to avoid reading the file a second time.
 */
export async function validateUpload(
  file: File
): Promise<ValidatedUpload | UploadValidationError> {
  // Size check first — avoid reading large files into memory
  if (file.size === 0) {
    return { error: "Datei ist leer", status: 400 };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "Datei zu groß (max. 5 MB)", status: 413 };
  }

  // Read file once
  const buffer = await file.arrayBuffer();
  const header = new Uint8Array(buffer, 0, Math.min(MAGIC_HEADER_BYTES, buffer.byteLength));

  // Detect type from magic bytes — ignore client Content-Type
  const detectedMime = detectMimeFromBytes(header);

  if (!detectedMime) {
    return {
      error: "Ungültiges Dateiformat. Nur JPG, PNG, WEBP und HEIC sind erlaubt.",
      status: 415,
    };
  }

  return {
    buffer,
    mime: detectedMime,
    ext: extForMime(detectedMime),
  };
}

/**
 * Builds a user-scoped, collision-safe storage path.
 *
 *   listings:  {userId}/{uuid}.{ext}
 *   avatars:   avatars/{userId}/{uuid}.{ext}
 *
 * - User-scoped: one user cannot overwrite another user's files.
 * - UUID filename: no two uploads collide, no overwrite possible.
 * - Extension from validated mime: never from client filename.
 */
export function buildStoragePath(
  userId: string,
  ext: string,
  prefix?: string
): string {
  const uuid = crypto.randomUUID().replace(/-/g, "");
  const filename = `${uuid}.${ext}`;
  return prefix ? `${prefix}/${userId}/${filename}` : `${userId}/${filename}`;
}
