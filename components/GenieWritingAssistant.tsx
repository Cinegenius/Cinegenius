"use client";

import { useSession } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { GENIE_MAX_MESSAGE_CHARS } from "@/lib/genie";
import styles from "./GenieWritingAssistant.module.css";

type WritingArea = "profile" | "company" | "location" | "marketplace";
type Props = {
  area: WritingArea;
  value: string;
  onApply: (text: string) => void;
  maxLength: number;
  contextKey?: string;
  disabled?: boolean;
};
type ErrorKey = "errorInvalid" | "errorRateLimited" | "errorUnavailable" | "errorTimeout" | "errorFailed" | "errorUnsafe" | "errorNetwork";
const ERRORS: Record<string, ErrorKey> = {
  invalid_request: "errorInvalid", rate_limited: "errorRateLimited", unavailable: "errorUnavailable",
  timeout: "errorTimeout", failed: "errorFailed", unsafe_input: "errorUnsafe",
};
const TOPICS = { profile: "topicsProfile", company: "topicsCompany", location: "topicsLocation", marketplace: "topicsMarketplace" } as const;

export default function GenieWritingAssistant(props: Props) {
  const { isLoaded, session } = useSession();
  if (!isLoaded) return null;
  return <GenieWritingContent key={`${session?.id ?? "guest"}:${props.contextKey ?? props.area}`} {...props} />;
}

export function GenieWritingContent({ area, value, onApply, maxLength, disabled = false }: Props) {
  const t = useTranslations("GenieWriting");
  const errors = useTranslations("Genie");
  const locale = useLocale();
  const id = useId();
  const limit = Math.min(2000, Math.max(1, Math.floor(maxLength)));
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);
  const [notice, setNotice] = useState<"conflict" | "currentTooLong" | "applied" | null>(null);
  const request = useRef<AbortController | null>(null);
  const originalValue = useRef(value);

  useEffect(() => () => {
    const controller = request.current;
    request.current = null;
    controller?.abort();
  }, []);

  useEffect(() => {
    if (disabled) request.current?.abort();
  }, [disabled]);

  function close() {
    request.current?.abort();
    setOpen(false);
  }

  function useCurrent() {
    setErrorKey(null);
    if (value.length > GENIE_MAX_MESSAGE_CHARS) {
      setNotice("currentTooLong");
      return;
    }
    setNotes(value);
    setPreview(null);
    setNotice(null);
  }

  async function generate() {
    const content = notes.trim();
    if (request.current || disabled || !content) return;
    if (content.length > GENIE_MAX_MESSAGE_CHARS) {
      setErrorKey("errorInvalid");
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    originalValue.current = value;
    setPending(true);
    setPreview(null);
    setErrorKey(null);
    setNotice(null);
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 35_000);
    const cancel = () => {
      window.clearTimeout(timeout);
      if (request.current !== controller) return;
      request.current = null;
      setPending(false);
      if (timedOut) setErrorKey("errorTimeout");
    };
    controller.signal.addEventListener("abort", cancel, { once: true });
    try {
      const response = await fetch("/api/genie", {
        method: "POST", credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ area, locale, messages: [{ role: "user", content }], writing: { maxLength: limit } }),
      });
      const data: unknown = await response.json();
      if (request.current !== controller || controller.signal.aborted) return;
      if (!response.ok) {
        const code = data && typeof data === "object" && "error" in data ? String(data.error) : "failed";
        setErrorKey(Object.hasOwn(ERRORS, code) ? ERRORS[code] : "errorFailed");
      } else if (data && typeof data === "object" && "reply" in data && typeof data.reply === "string" && data.reply.trim() && data.reply.length <= limit) {
        setPreview(data.reply);
      } else {
        setErrorKey("errorFailed");
      }
    } catch {
      if (request.current === controller && !controller.signal.aborted) setErrorKey("errorNetwork");
    } finally {
      window.clearTimeout(timeout);
      controller.signal.removeEventListener("abort", cancel);
      if (request.current === controller) {
        request.current = null;
        setPending(false);
      }
    }
  }

  function apply() {
    if (disabled || pending || !preview?.trim() || preview.length > limit) return;
    if (value !== originalValue.current) {
      setNotice("conflict");
      return;
    }
    onApply(preview.trim());
    setPreview(null);
    setNotice("applied");
  }

  return (
    <div className={styles.root}>
      <button type="button" className={styles.trigger} disabled={disabled} aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => open ? close() : setOpen(true)}>
        <Sparkles size={15} aria-hidden="true" /> {t("open")}
      </button>
      {open && (
        <section id={`${id}-panel`} className={styles.panel} aria-label={t("open")} aria-busy={pending}>
          <div className={styles.heading}>
            <label htmlFor={`${id}-notes`}>{t("notes")}</label>
            <button type="button" className={styles.close} onClick={close} aria-label={t("close")}><X size={17} aria-hidden="true" /></button>
          </div>
          <p id={`${id}-topic`} className={styles.help}>{t(TOPICS[area])}</p>
          <textarea id={`${id}-notes`} value={notes} rows={3} maxLength={GENIE_MAX_MESSAGE_CHARS} placeholder={t("notesPlaceholder")} disabled={pending || disabled} aria-describedby={`${id}-topic ${id}-privacy`} onChange={event => { setNotes(event.target.value); setPreview(null); setNotice(null); }} />
          {value && <button type="button" className={styles.copy} disabled={pending || disabled} onClick={useCurrent}>{t("useCurrent")}</button>}
          <p id={`${id}-privacy`} className={styles.help}>{t("privacy")}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={pending || disabled || !notes.trim()} onClick={() => void generate()}>{t(pending ? "generating" : "generate")}</button>
            {pending && <button type="button" className={styles.secondary} onClick={() => request.current?.abort()}>{t("cancel")}</button>}
          </div>
          {errorKey && <p role="alert" className={styles.error}>{errors(errorKey)}</p>}
          {notice && <p role={notice === "applied" ? "status" : "alert"} className={notice === "applied" ? styles.success : styles.help}>{t(notice)}</p>}
          {preview !== null && (
            <div className={styles.preview}>
              <label htmlFor={`${id}-preview`}>{t("preview")}</label>
              <textarea id={`${id}-preview`} rows={5} value={preview} maxLength={limit} disabled={disabled} onChange={event => setPreview(event.target.value)} aria-describedby={`${id}-review ${id}-count`} />
              <p id={`${id}-count`} className={styles.count}>{t("remaining", { count: preview.length, max: limit })}</p>
              <p id={`${id}-review`} className={styles.help}>{t("review")}</p>
              {preview.length > limit && <p role="alert" className={styles.error}>{t("errorTooLong", { max: limit })}</p>}
              <button type="button" className={styles.primary} disabled={disabled || pending || !preview.trim() || preview.length > limit} onClick={apply}>{t("apply")}</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
