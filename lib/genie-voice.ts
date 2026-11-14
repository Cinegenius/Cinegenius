/** Shared web/native recording limits. No key, transcript or recording is persisted here. */
export const GENIE_AUDIO_MAX_BYTES = 1024 * 1024;
export const GENIE_RECORDING_MAX_MS = 30_000;
export const GENIE_AUDIO_TYPES = ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav"] as const;
export const GENIE_SPEECH_RATE = 0.94;
export const GENIE_SPEECH_VOLUME = 0.85;

/** Keep the spoken language; prefer a natural/system-default voice when installed. */
export function selectGenieSpeechVoice(voices: SpeechSynthesisVoice[], locale: string): SpeechSynthesisVoice | null {
  const language = locale.toLowerCase().split("-")[0];
  const score = (voice: SpeechSynthesisVoice) =>
    (/premium|enhanced|natural|neural/i.test(voice.name) ? 8 : 0)
    + (voice.lang.toLowerCase() === locale.toLowerCase() ? 4 : 0)
    + (voice.default ? 2 : 0) + (voice.localService ? 1 : 0);
  return voices.filter(voice => voice.lang.toLowerCase().split("-")[0] === language)
    .sort((a, b) => score(b) - score(a))[0] ?? null;
}
export interface NativeGenieVoice {
  readonly version: 1;
  capabilities(options: { locale: string }): Promise<{ recognition: boolean; synthesis: boolean; systemServiceMayProcessAudio: boolean }>;
  start(options: { locale: string }): Promise<{ text: string }>;
  stop(): void;
  cancel(): void;
  speak(options: { locale: string; text: string }): Promise<void>;
  stopSpeaking(): void;
}
export function nativeGenieVoice(): NativeGenieVoice | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as Window & { CineGeniusVoice?: NativeGenieVoice }).CineGeniusVoice;
  return bridge?.version === 1 ? bridge : null;
}
export function genieAudioType(value: string): typeof GENIE_AUDIO_TYPES[number] | null {
  const type = value.split(";", 1)[0].trim().toLowerCase();
  return GENIE_AUDIO_TYPES.find(item => item === type) ?? null;
}

/** Reject mislabeled uploads before sending them to the transcription service. */
export function matchesAudioContainer(bytes: Uint8Array, mime: string): boolean {
  const ascii = (offset: number, value: string) => [...value].every((char, i) => bytes[offset + i] === char.charCodeAt(0));
  if (bytes.length < 12) return false;
  if (mime === "audio/webm") return [0x1a, 0x45, 0xdf, 0xa3].every((value, i) => bytes[i] === value);
  if (mime === "audio/mp4") return ascii(4, "ftyp");
  if (mime === "audio/ogg") return ascii(0, "OggS");
  return mime === "audio/wav" && ascii(0, "RIFF") && ascii(8, "WAVE");
}
