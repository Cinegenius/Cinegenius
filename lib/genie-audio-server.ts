import "server-only";
import { GENIE_MAX_MESSAGE_CHARS } from "@/lib/genie";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { GENIE_AUDIO_MAX_BYTES, genieAudioType, matchesAudioContainer } from "@/lib/genie-voice";
import { GenieError, readBoundedBytes, readBoundedJson, type GenieConfiguration } from "@/lib/genie-server";

export async function readGenieAudio(request: Request) {
  const locale = request.headers.get("x-genie-locale") ?? "";
  const mime = genieAudioType(request.headers.get("content-type") ?? "");
  if (!mime || !SUPPORTED_LOCALES.includes(locale as typeof SUPPORTED_LOCALES[number])) throw new GenieError("invalid_request", 400);
  const bytes = await readBoundedBytes(request, GENIE_AUDIO_MAX_BYTES, new GenieError("invalid_request", 413));
  if (!matchesAudioContainer(bytes, mime)) throw new GenieError("invalid_request", 400);
  return { bytes, mime, locale };
}

export async function transcribeGenieAudio(request: Request, audio: Awaited<ReturnType<typeof readGenieAudio>>, config: GenieConfiguration) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(25_000)]);
  try {
    signal.throwIfAborted();
    const body = new FormData();
    body.set("model", "gpt-transcribe");
    body.set("file", new Blob([audio.bytes], { type: audio.mime }), `speech.${audio.mime.split("/")[1]}`);
    // Only the explicit recording is forwarded. No account, cookies, URL or background context.
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${config.apiKey}` },
      body, cache: "no-store", redirect: "error", signal,
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new GenieError("unavailable", 503);
    }
    const result = await readBoundedJson(response, 16 * 1024, new GenieError("failed", 502));
    signal.throwIfAborted();
    if (!result || typeof result !== "object" || !("text" in result) || typeof result.text !== "string"
      || !result.text.trim() || result.text.length > GENIE_MAX_MESSAGE_CHARS || result.text.includes("\0")) throw new GenieError("failed", 502);
    return { text: result.text.trim() };
  } catch (error) {
    if (signal.aborted) throw new GenieError("timeout", 504);
    if (error instanceof GenieError) throw error;
    throw new GenieError("failed", 502);
  }
}
