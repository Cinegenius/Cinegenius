"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Send, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { GENIE_MAX_MESSAGE_CHARS, genieAreaForPath } from "@/lib/genie";
import { clearConversation, GENIE_IDLE_MS, GENIE_MEMORY_ACTIVITY, readConversationSnapshot, safeLinks, saveConversation, trimExchanges, type ConversationSnapshot, type Exchange } from "@/lib/genie-conversation";
import styles from "./Genie.module.css";
import { nativeGenieVoice } from "@/lib/genie-voice";
import { isGenieSearchHref } from "@/lib/genie-search";
import { useFormRouter } from "@/lib/use-form-router";
import GenieVoiceControls from "./GenieVoiceControls";

type Message = { role: "user" | "assistant"; content: string };
type Status = "errorSearch" | "errorInvalid" | "errorRateLimited" | "errorUnavailable" | "errorTimeout" | "errorFailed" | "errorUnsafe" | "errorNetwork" | "cancelled";

const SERVER_ERRORS: Record<string, Status> = {
  invalid_request: "errorInvalid",
  search_unresolved: "errorSearch",
  rate_limited: "errorRateLimited",
  unavailable: "errorUnavailable",
  timeout: "errorTimeout",
  failed: "errorFailed",
  unsafe_input: "errorUnsafe",
};

export default function GeniePanel({ active, requestRef, memoryScope }: { active: boolean; requestRef: RefObject<AbortController | null>; memoryScope: string | null }) {
  const t = useTranslations("Genie");
  const locale = useLocale();
  const router = useFormRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loginRequired, setLoginRequired] = useState(!memoryScope);
  const canUse = Boolean(memoryScope) && !loginRequired;
  const query = searchParams.toString();
  const returnTo = `${pathname || "/"}${query ? `?${query}` : ""}`;
  const [memory, setMemory] = useState<ConversationSnapshot>(() => {
    const empty = { exchanges: [], updatedAt: Date.now() };
    if (!memoryScope) return empty;
    try { return readConversationSnapshot(window.sessionStorage, memoryScope, Date.now()) ?? empty; }
    catch { return empty; }
  });
  const memoryRef = useRef(memory);
  const { exchanges } = memory;
  const [draft, setDraft] = useState("");
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const sequence = useRef(exchanges.at(-1)?.id ?? 0);
  const transcript = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const pending = pendingUser !== null;
  const spokenRequest = useRef<AbortController | null>(null);
  const [voiceReset, setVoiceReset] = useState(0);
  const [voiceReply, setVoiceReply] = useState<{ id: number; text: string; locale: string; spoken: boolean; route?: string; fromRoute?: string } | null>(null);

  const setExchanges = useCallback((next: Exchange[], updatedAt = Date.now()) => {
    memoryRef.current = { exchanges: next, updatedAt };
    setMemory(memoryRef.current);
  }, []);

  const expireIfIdle = useCallback(() => {
    const age = Date.now() - memoryRef.current.updatedAt;
    if (age >= 0 && age < GENIE_IDLE_MS) return;
    setExchanges([]);
    try { clearConversation(window.sessionStorage); } catch { /* Private storage can be blocked. */ }
    // A suspended request must restore its unsent text, never revive old context.
    requestRef.current?.abort();
    setVoiceReply(null);
  }, [requestRef, setExchanges]);

  const recordActivity = useCallback(() => {
    expireIfIdle();
    const next = memoryRef.current.exchanges;
    const now = Date.now();
    setExchanges(next, now);
    if (memoryScope && next.length) {
      try { saveConversation(window.sessionStorage, memoryScope, next, now); } catch { /* In-memory chat remains usable. */ }
      window.dispatchEvent(new Event(GENIE_MEMORY_ACTIVITY));
    }
  }, [expireIfIdle, memoryScope, setExchanges]);

  useEffect(() => {
    // Also check on resume: mobile browsers can suspend timers in the background.
    const events = ["focus", "pageshow", "cinegenius:app-resume"];
    events.forEach(event => window.addEventListener(event, expireIfIdle));
    document.addEventListener("visibilitychange", expireIfIdle);
    const timer = exchanges.length || pending
      ? window.setTimeout(expireIfIdle, Math.max(0, memory.updatedAt + GENIE_IDLE_MS - Date.now()))
      : null;
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      events.forEach(event => window.removeEventListener(event, expireIfIdle));
      document.removeEventListener("visibilitychange", expireIfIdle);
    };
  }, [expireIfIdle, exchanges.length, memory.updatedAt, pending]);

  useEffect(() => {
    if (!active) requestRef.current?.abort();
  }, [active, requestRef]);

  useEffect(() => () => {
    const pendingRequest = requestRef.current;
    requestRef.current = null;
    pendingRequest?.abort();
  }, [requestRef]);

  useEffect(() => {
    if (active && transcript.current) {
      transcript.current.scrollTop = exchanges.length || pendingUser || status ? transcript.current.scrollHeight : 0;
    }
  }, [active, exchanges, pendingUser, status]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendContent(draft);
  }

  async function sendContent(text: string, spoken = false) {
    const content = text.trim();
    if (requestRef.current || !content || !active || !canUse) return;
    if (content.length > GENIE_MAX_MESSAGE_CHARS) {
      setStatus("errorInvalid");
      return;
    }

    recordActivity();
    const previous = trimExchanges(memoryRef.current.exchanges, content);
    const messages: Message[] = previous.flatMap(entry => [
      { role: "user" as const, content: entry.user },
      { role: "assistant" as const, content: entry.reply },
    ]);
    messages.push({ role: "user", content });
    const controller = new AbortController();
    requestRef.current = controller;
    spokenRequest.current = spoken ? controller : null;
    setPendingUser(content);
    setDraft("");
    setStatus(null);
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 35_000);
    const cancel = () => {
      window.clearTimeout(timeout);
      if (requestRef.current !== controller) return;
      requestRef.current = null;
      setDraft(content);
      setPendingUser(null);
      setStatus(timedOut ? "errorTimeout" : "cancelled");
    };
    controller.signal.addEventListener("abort", cancel, { once: true });

    try {
      const response = await fetch("/api/genie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
        body: JSON.stringify({ area: genieAreaForPath(pathname), locale, messages }),
      });
      if (requestRef.current !== controller) return;
      if (controller.signal.aborted) throw new DOMException("", "AbortError");
      if (response.status === 401) {
        setLoginRequired(true);
        setExchanges([]);
        if (memoryScope) {
          try { clearConversation(window.sessionStorage); } catch { /* Storage may be unavailable. */ }
        }
        setDraft(content);
        setStatus(null);
        return;
      }
      const result: unknown = await response.json();
      expireIfIdle();
      if (requestRef.current !== controller) return;
      if (controller.signal.aborted) throw new DOMException("", "AbortError");
      if (!response.ok) {
        const code = result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "failed";
        setStatus(Object.hasOwn(SERVER_ERRORS, code) ? SERVER_ERRORS[code] : "errorFailed");
        setDraft(content);
        return;
      }
      if (!result || typeof result !== "object" || !("reply" in result) || typeof result.reply !== "string" || !result.reply.trim() || result.reply.length > GENIE_MAX_MESSAGE_CHARS) {
        setStatus("errorFailed");
        setDraft(content);
        return;
      }
      const updated = trimExchanges([...previous, {
        id: ++sequence.current,
        user: content,
        reply: result.reply,
        links: safeLinks("links" in result ? result.links : []),
      }]);
      setExchanges(updated);
      recordActivity();
      const searchLink = updated.at(-1)?.links.find(link => isGenieSearchHref(link.href));
      if (spoken && searchLink) router.push(searchLink.href);
      setVoiceReply({ id: sequence.current, text: result.reply, locale: "language" in result && typeof result.language === "string" ? result.language : locale, spoken, route: spoken ? searchLink?.href : undefined, fromRoute: spoken && searchLink ? returnTo : undefined });
    } catch {
      if (requestRef.current !== controller) return;
      setDraft(content);
      setStatus(controller.signal.aborted ? (timedOut ? "errorTimeout" : "cancelled") : "errorNetwork");
    } finally {
      window.clearTimeout(timeout);
      if (spokenRequest.current === controller) spokenRequest.current = null;
      controller.signal.removeEventListener("abort", cancel);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setPendingUser(null);
      }
    }
  }

  function clearChat() {
    const pendingRequest = requestRef.current;
    requestRef.current = null;
    pendingRequest?.abort();
    try { clearConversation(window.sessionStorage); }
    catch { /* The in-memory conversation is cleared even if storage is blocked. */ }
    setExchanges([]);
    setDraft("");
    setPendingUser(null);
    setStatus(null);
    setVoiceReset(value => value + 1);
    setVoiceReply(null);
    requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
  }

  if (!canUse) {
    return (
      <div className={styles.loginGate}>
        <p className={styles.greeting}>{t("loginTitle")}</p>
        <p className={styles.notice}>{t("loginHint")}</p>
        <div className={styles.loginActions}>
          <Link href={`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`} prefetch={false} className="btn-primary">{t("signIn")}</Link>
          <Link href={`/sign-up?redirect_url=${encodeURIComponent(returnTo)}`} prefetch={false} className="btn-secondary">{t("signUp")}</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div ref={transcript} className={styles.transcript} role="log" aria-live="polite" aria-relevant="additions text" aria-label={t("name")}
        onPointerDown={recordActivity} onKeyDown={recordActivity} onWheel={recordActivity} onTouchMove={recordActivity}>
        <div className={styles.greeting}><p>{t("greeting")}</p></div>
        <div className={styles.notice} id={`${id}-notice`}>
          <p>{t("privacy")} <Link href="/datenschutz" prefetch={false}>{t("privacyLink")}</Link></p>
          <p>{t("caution")}</p>
          <p id="genie-voice-notice">{t(nativeGenieVoice() ? "voice.noticeNative" : "voice.notice")}</p>
        </div>
        {exchanges.map(entry => (
          <div key={entry.id} className={styles.exchange}>
            <div className={styles.userMessage}>
              <span className={styles.speaker}>{t("you")}</span>
              <p>{entry.user}</p>
            </div>
            <div className={styles.assistantMessage}>
              <span className={styles.speaker}>{t("assistant")}</span>
              <p>{entry.reply}</p>
              {entry.links.length > 0 && <ul className={styles.links}>{entry.links.map(link => <li key={link.href}><Link href={link.href} prefetch={false}>{link.label}</Link></li>)}</ul>}
            </div>
          </div>
        ))}
        {pendingUser && <div className={styles.userMessage}><span className={styles.speaker}>{t("you")}</span><p>{pendingUser}</p></div>}
        {pending && <p className={styles.status} role="status">{t("sending")}</p>}
        {status && <p className={styles.status} role={status === "cancelled" ? "status" : "alert"}>{t(status)}</p>}
      </div>
      <form className={styles.composer} onSubmit={send} onPointerDown={recordActivity} onKeyDownCapture={recordActivity}>
        <GenieVoiceControls active={active} pending={pending} locale={locale} resetKey={voiceReset} reply={voiceReply} routeKey={returnTo}
          onInterrupt={() => spokenRequest.current?.abort()}
          onUnauthorized={() => { setLoginRequired(true); setExchanges([]); try { clearConversation(window.sessionStorage); } catch {} }}
          onText={text => {
            if (requestRef.current || !active || !canUse) return;
            recordActivity();
            if (draft.trim()) { setDraft(`${draft.trim()}\n${text}`); return; }
            void sendContent(text, true);
          }} />
        <label className={styles.inputLabel} htmlFor={`${id}-message`}>{t("inputLabel")}</label>
        <div className={styles.inputRow}>
          <textarea
            ref={input}
            id={`${id}-message`}
            name="genie-message"
            className={styles.input}
            value={draft}
            onChange={event => { recordActivity(); if (!requestRef.current) setDraft(event.target.value); }}
            onKeyDown={event => {
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
              event.preventDefault();
              if (!event.repeat && !pending) event.currentTarget.form?.requestSubmit();
            }}
            maxLength={GENIE_MAX_MESSAGE_CHARS}
            placeholder={t("inputPlaceholder")}
            rows={2}
            readOnly={pending}
            autoComplete="off"
            aria-describedby={`${id}-keyboard ${id}-count ${id}-notice`}
          />
          <button type="submit" className={styles.sendButton} disabled={pending || !draft.trim()} aria-label={t("send")} title={t("send")}>
            <Send size={18} aria-hidden="true" />
          </button>
        </div>
        <span id={`${id}-keyboard`} className={styles.inputLabel}>{t("keyboardHint")}</span>
        <div className={styles.actions}>
          <span id={`${id}-count`} className={styles.count}>{t("count", { count: draft.length, max: GENIE_MAX_MESSAGE_CHARS })}</span>
          {(exchanges.length > 0 || draft || pending || status) && <button type="button" className={styles.iconButton} onClick={clearChat} aria-label={t("clear")} title={t("clear")}>
            <Trash2 size={18} aria-hidden="true" />
          </button>}
        </div>
      </form>
    </>
  );
}
