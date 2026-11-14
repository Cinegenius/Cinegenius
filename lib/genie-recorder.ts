import { GENIE_AUDIO_MAX_BYTES, GENIE_RECORDING_MAX_MS, genieAudioType, isNativeGenieHost, nativeGenieVoice } from "./genie-voice";
import { GENIE_MAX_MESSAGE_CHARS } from "./genie";

export type RecordingState = "idle" | "requesting" | "recording" | "transcribing";
export type VoiceError = "unsupported" | "permission" | "failed" | "timeout" | "rate_limited" | "unauthorized" | "unavailable" | "app_unavailable";
type Callbacks = { state: (state: RecordingState) => void; text: (text: string) => void; error: (error: VoiceError) => void };

/** One explicit recording at a time. Cancel invalidates even a late permission result. */
export function createGenieRecorder(callbacks: Callbacks) {
  let generation = 0;
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let busy = false;
  let finishing = false;
  let native: ReturnType<typeof nativeGenieVoice> = null;
  let removeNativeListener: (() => void) | null = null;
  const stopTracks = () => { stream?.getTracks().forEach(track => track.stop()); stream = null; };
  const cancel = (notify = true) => {
    generation++;
    clearTimeout(timer);
    controller?.abort(); controller = null;
    removeNativeListener?.(); removeNativeListener = null;
    native?.cancel(); native = null;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recorder = null; stopTracks(); busy = false; finishing = false;
    if (notify) callbacks.state("idle");
  };
  const fail = (error: VoiceError) => { cancel(); callbacks.error(error); };
  const stop = () => {
    if (native) {
      if (finishing) return;
      finishing = true;
      clearTimeout(timer);
      timer = setTimeout(() => fail("timeout"), 15_000);
      try { native.stop(); callbacks.state("transcribing"); }
      catch { fail("failed"); }
      return;
    }
    if (recorder?.state !== "recording") return;
    clearTimeout(timer);
    recorder.stop(); stopTracks();
    callbacks.state("transcribing");
  };
  const start = async (locale: string) => {
    if (busy) return;
    const bridge = nativeGenieVoice();
    if (bridge) {
      native = bridge; busy = true;
      const token = ++generation;
      callbacks.state("requesting");
      const stateChanged = (event: Event) => {
        if (token !== generation) return;
        const state = (event as CustomEvent).detail?.state;
        if (state === "listening") callbacks.state("recording");
        if (state === "processing") callbacks.state("transcribing");
      };
      window.addEventListener("cinegenius:voice-state", stateChanged);
      removeNativeListener = () => window.removeEventListener("cinegenius:voice-state", stateChanged);
      timer = setTimeout(stop, GENIE_RECORDING_MAX_MS);
      try {
        const result = await bridge.start({ locale });
        if (token !== generation) return;
        if (typeof result.text !== "string" || !result.text.trim() || result.text.length > GENIE_MAX_MESSAGE_CHARS || result.text.includes("\0")) { fail("failed"); return; }
        cancel(); callbacks.text(result.text.trim());
      } catch (error) {
        if (token !== generation) return;
        const code = error && typeof error === "object" && "code" in error ? error.code : "audio";
        if (code === "cancelled" || code === "interrupted") { cancel(); return; }
        fail(code === "permission-denied" ? "permission" : code === "language-unavailable" || code === "unavailable" ? "unsupported" : code === "timeout" ? "timeout" : "failed");
      }
      return; // Never bypass a native permission denial with web recording.
    }
    if (isNativeGenieHost()) { callbacks.error("app_unavailable"); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { callbacks.error("unsupported"); return; }
    const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) { callbacks.error("unsupported"); return; }
    busy = true;
    const token = ++generation;
    callbacks.state("requesting");
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (generation !== token) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream = acquired;
      const recording = new MediaRecorder(acquired, { mimeType, audioBitsPerSecond: 32_000 });
      recorder = recording;
      const chunks: Blob[] = [];
      let size = 0;
      recording.ondataavailable = event => {
        if (generation !== token || !event.data.size) return;
        size += event.data.size;
        if (size > GENIE_AUDIO_MAX_BYTES) { fail("failed"); return; }
        chunks.push(event.data);
      };
      recording.onerror = () => { if (generation === token) fail("failed"); };
      acquired.getAudioTracks().forEach(track => { track.onended = () => { if (generation === token && recording.state === "recording") fail("failed"); }; });
      recording.onstop = async () => {
        if (generation !== token) return;
        stopTracks();
        recorder = null;
        clearTimeout(timer);
        const mime = genieAudioType(recording.mimeType);
        if (!size || !mime) { fail("failed"); return; }
        callbacks.state("transcribing");
        const request = new AbortController();
        controller = request;
        let timedOut = false;
        timer = setTimeout(() => { timedOut = true; request.abort(); }, 35_000);
        try {
          const response = await fetch("/api/genie/transcribe", {
            method: "POST", headers: { "Content-Type": mime, "X-Genie-Locale": locale },
            credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer",
            signal: request.signal, body: new Blob(chunks, { type: mime }),
          });
          if (generation !== token) return;
          if (response.status === 401) { fail("unauthorized"); return; }
          if (response.status === 429) { fail("rate_limited"); return; }
          if (response.status === 503) { fail("unavailable"); return; }
          if (response.status === 504) { fail("timeout"); return; }
          if (!response.ok) { fail("failed"); return; }
          const result: unknown = await response.json();
          if (generation !== token) return;
          if (!result || typeof result !== "object" || !("text" in result) || typeof result.text !== "string"
            || !result.text.trim() || result.text.length > GENIE_MAX_MESSAGE_CHARS || result.text.includes("\0")) { fail("failed"); return; }
          cancel();
          callbacks.text(result.text.trim());
        } catch { if (generation === token) fail(timedOut ? "timeout" : "failed"); }
        finally { chunks.length = 0; if (generation === token) clearTimeout(timer); }
      };
      recording.start(250);
      callbacks.state("recording");
      timer = setTimeout(stop, GENIE_RECORDING_MAX_MS);
    } catch (error) {
      if (generation === token) fail(error instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(error.name) ? "permission" : "failed");
    }
  };
  return { start, stop, cancel };
}
