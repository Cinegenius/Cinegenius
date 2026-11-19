/** Shared web/native recording limits. No key, transcript or recording is persisted here. */
export const GENIE_AUDIO_MAX_BYTES = 1024 * 1024;
export const GENIE_RECORDING_MAX_MS = 30_000;
export const GENIE_AUDIO_TYPES = ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav"] as const;
export const GENIE_SPEECH_RATE = 0.94;
export const GENIE_SPEECH_VOLUME = 0.85;
export const GENIE_SPEECH_LOCALES: Readonly<Record<string, string>> = Object.freeze({
  de: "de-DE", en: "en-GB", es: "es-ES", it: "it-IT", cs: "cs-CZ", hu: "hu-HU",
  nl: "nl-NL", "nl-BE": "nl-BE", sv: "sv-SE", fr: "fr-FR", pl: "pl-PL", "pt-PT": "pt-PT",
  "zh-Hans": "zh-CN", ja: "ja-JP", ko: "ko-KR", ru: "ru-RU", uk: "uk-UA",
});

/** Preserve the requested accent; prefer higher quality among matching installed voices. */
export function selectGenieSpeechVoice(voices: SpeechSynthesisVoice[], locale: string): SpeechSynthesisVoice | null {
  const tag = (GENIE_SPEECH_LOCALES[locale] ?? locale).replaceAll("_", "-").toLowerCase();
  const language = tag.split("-")[0];
  const rank = (voice: SpeechSynthesisVoice) => [
    Number(voice.lang.replaceAll("_", "-").toLowerCase() === tag),
    /premium/i.test(voice.name) ? 3 : /enhanced|natural|neural/i.test(voice.name) ? 2 : 0,
    Number(Boolean(voice.default)), Number(Boolean(voice.localService)),
  ];
  return voices.filter(voice => voice.lang.replaceAll("_", "-").toLowerCase().split("-")[0] === language)
    .sort((a, b) => {
      const left = rank(a), right = rank(b);
      for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return right[i] - left[i];
      return (a.voiceURI || a.name).localeCompare(b.voiceURI || b.name, "en");
    })[0] ?? null;
}

/** Speak the visible wording, with paragraph pauses, rather than Markdown punctuation or URLs. */
export function genieSpokenText(text: string): string {
  return text.slice(0, 6000)
    .replace(/```[^\n]*\n[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/[^\s)]+/g, " ")
    .replace(/^[ \t]{0,3}(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/gm, "")
    .replace(/(\*\*|__)([\s\S]*?)\1/g, "$2")
    .replace(/(^|\s)[*_]([^\n*_]+)[*_](?=\s|[.,!?;:]|$)/g, "$1$2")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
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
