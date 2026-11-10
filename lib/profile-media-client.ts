import { PROFILE_MEDIA_MAX_BYTES, PROFILE_MEDIA_MIME_TYPES, validateCompressedProfileMedia, validateProfileMediaSource } from "./profile-media";
import { uiErrorMessage } from "./ui-error-message";

export type ProfileMediaTranslate = (key: string) => string;

export type ProfileMediaSourceError = "empty" | "source-too-large" | "unsupported" | "compressed-too-large";

export async function prepareProfileMediaFile(
  file: File,
  compress: (file: File) => Promise<File>,
): Promise<{ file: File; error: null } | { file: null; error: ProfileMediaSourceError }> {
  const sourceError = validateProfileMediaSource(file);
  if (sourceError) return { file: null, error: sourceError === "too-large" ? "source-too-large" : sourceError };

  // The browser reduces large source images before sending them to Vercel.
  const compressed = await compress(file);
  if (validateCompressedProfileMedia(compressed)) return { file: null, error: "compressed-too-large" };
  return { file: compressed, error: null };
}

export async function sendProfileMediaFile(file: File, translate?: ProfileMediaTranslate): Promise<string> {
  if (file.size > PROFILE_MEDIA_MAX_BYTES) throw new Error(translate?.("mediaSecurity.tooLarge") ?? "Das verarbeitete Bild darf höchstens 4 MB groß sein.");
  if (file.type && !PROFILE_MEDIA_MIME_TYPES.has(file.type)) throw new Error(translate?.("mediaSecurity.invalid") ?? "Das Bild konnte nicht sicher verarbeitet werden. Verwende ein gültiges JPG-, PNG- oder WEBP-Bild.");

  const body = new FormData();
  body.append("file", file);
  const fallback = translate?.("mediaSecurity.saveFailed") ?? "Das Bild konnte nicht gespeichert werden. Bitte versuche es erneut.";
  try {
    const response = await fetch("/api/upload/profile-media", { method: "POST", body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.url) throw new Error(result.error ?? `HTTP ${response.status}`);
    return result.url as string;
  } catch (error) {
    throw new Error(uiErrorMessage(error, fallback));
  }
}

export { PROFILE_MEDIA_ACCEPT, PROFILE_MEDIA_MAX_BYTES, PROFILE_MEDIA_SOURCE_MAX_BYTES } from "./profile-media";
