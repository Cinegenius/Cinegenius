"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2, VolumeX, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { createGenieRecorder, type RecordingState, type VoiceError } from "@/lib/genie-recorder";
import { genieSpeechRouteReady, nativeGenieVoice } from "@/lib/genie-voice";
import styles from "./Genie.module.css";

export default function GenieVoiceControls({ active, pending, locale, resetKey, onText, onUnauthorized, onInterrupt, reply, routeKey }: {
  active: boolean; pending: boolean; locale: string; resetKey: number; routeKey: string;
  onText: (text: string) => void; onUnauthorized: () => void; onInterrupt: () => void;
  reply: { id: number; text: string; locale: string; spoken: boolean; route?: string } | null;
}) {
  const t = useTranslations("Genie.voice");
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setVoiceErrorCode] = useState<VoiceError | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const recorder = useRef<ReturnType<typeof createGenieRecorder> | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const latest = useRef({ onText, onUnauthorized, onInterrupt });
  latest.current = { onText, onUnauthorized, onInterrupt };
  const spokenId = useRef(0);
  const speechGeneration = useRef(0);
  const stopSpeech = () => {
    speechGeneration.current++;
    nativeGenieVoice()?.stopSpeaking();
    if (utterance.current) { utterance.current.onend = null; utterance.current.onerror = null; utterance.current = null; window.speechSynthesis?.cancel(); }
    setSpeaking(false);
  };
  const speak = (text: string, language: string) => {
    stopSpeech();
    const native = nativeGenieVoice();
    if (native) {
      const token = speechGeneration.current;
      setSpeaking(true);
      void native.speak({ text, locale: language }).then(() => {
        if (speechGeneration.current === token) setSpeaking(false);
      }, () => { if (speechGeneration.current === token) { setSpeaking(false); setVoiceErrorCode("unsupported"); } });
      return;
    }
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") { setVoiceErrorCode("unsupported"); return; }
    const output = new SpeechSynthesisUtterance(text);
    output.lang = language;
    // Prefer an installed voice; never silently choose an unrelated language.
    const installed = window.speechSynthesis.getVoices();
    const voices = installed.filter(voice => voice.lang.split("-")[0] === language.split("-")[0]);
    if (installed.length && !voices.length) { setVoiceErrorCode("unsupported"); return; }
    output.voice = voices.find(voice => voice.localService) ?? voices[0] ?? null;
    output.onend = () => { if (utterance.current === output) { utterance.current = null; setSpeaking(false); } };
    output.onerror = () => { if (utterance.current === output) { utterance.current = null; setSpeaking(false); setVoiceErrorCode("failed"); } };
    utterance.current = output; setSpeaking(true); window.speechSynthesis.speak(output);
  };

  useEffect(() => {
    const capture = createGenieRecorder({ state: setState, text: text => latest.current.onText(text), error: code => {
      setVoiceErrorCode(code); if (code === "unauthorized") latest.current.onUnauthorized();
    } });
    recorder.current = capture;
    const cancel = () => { capture.cancel(); stopSpeech(); latest.current.onInterrupt(); };
    const visibility = () => { if (document.visibilityState !== "visible") cancel(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", cancel);
    return () => {
      capture.cancel(false); recorder.current = null;
      speechGeneration.current++; nativeGenieVoice()?.stopSpeaking();
      if (utterance.current) { utterance.current.onend = null; utterance.current.onerror = null; window.speechSynthesis?.cancel(); utterance.current = null; }
      document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", cancel);
    };
  }, []);
  useEffect(() => { if (!active || pending) { recorder.current?.cancel(); stopSpeech(); } }, [active, pending]);
  useEffect(() => {
    recorder.current?.cancel(); stopSpeech(); setVoiceErrorCode(null);
    latest.current.onInterrupt();
    spokenId.current = Math.max(spokenId.current, reply?.id ?? 0);
  }, [resetKey, locale]);
  useEffect(() => {
    if (!reply || !reply.spoken || spokenId.current >= reply.id) return;
    if (!active || document.visibilityState !== "visible") { spokenId.current = reply.id; return; }
    if (pending || (reply.route && !genieSpeechRouteReady(reply.route, routeKey))) return;
    spokenId.current = reply.id;
    speak(reply.text, reply.locale);
  }, [active, pending, reply, routeKey]);

  return <div className={styles.voiceControls}>
    <div className={styles.voiceActions}>
      <button type="button" className={styles.iconButton} disabled={pending || !active || state === "requesting" || state === "transcribing"}
        aria-label={t(state === "recording" ? "stop" : "start")} title={t(state === "recording" ? "stop" : "start")}
        aria-pressed={state === "recording"} aria-describedby="genie-voice-notice"
        onClick={() => { setVoiceErrorCode(null); if (state === "recording") recorder.current?.stop(); else { stopSpeech(); void recorder.current?.start(locale); } }}>
        {state === "recording" ? <Square size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
      </button>
      {state !== "idle" && <button type="button" className={styles.iconButton} onClick={() => { recorder.current?.cancel(); setVoiceErrorCode(null); }} aria-label={t("cancel")} title={t("cancel")}><X size={18} aria-hidden="true" /></button>}
      {reply && state === "idle" && <button type="button" className={styles.iconButton} disabled={pending || !active}
        aria-label={t(speaking ? "stopSpeaking" : "speak")} title={t(speaking ? "stopSpeaking" : "speak")}
        onClick={() => { setVoiceErrorCode(null); if (speaking) stopSpeech(); else speak(reply.text, reply.locale); }}>
        {speaking ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
      </button>}
      <span className={styles.count} role="status">{state !== "idle" ? t(state) : speaking ? t("speaking") : ""}</span>
    </div>
    {error && error !== "unauthorized" && <p className={styles.status} role="alert">{t(`error.${error}`)}</p>}
  </div>;
}
