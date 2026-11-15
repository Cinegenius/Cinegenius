"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { GENIE_MAX_MESSAGE_CHARS, validateGenieRequest } from "@/lib/genie";
import { GENIE_IDLE_MS } from "@/lib/genie-conversation";
import { searchPlanFromHref, type SearchPlan } from "@/lib/unified-search";
import { useFormRouter } from "@/lib/use-form-router";

type Message = { role: "user" | "assistant"; content: string };
type FollowUpError = "conversationExpired" | "conversationLimit" | "unauthorized" | "rate_limited" | "unsafe_input" | "failed";
const ERROR = {
  expired: "conversationExpired", limit: "conversationLimit", unauthorized: "unauthorized",
  rate: "rate_limited", unsafe: "unsafe_input", failed: "failed",
} as const;

/** Short-lived, account-scoped dialogue. Nothing is written to storage or the URL. */
export default function SmartSearchClarification({ question, requestText, onUnauthorized, searchContext }: {
  question: string; requestText: string; onUnauthorized: () => void; searchContext?: { plan: SearchPlan; wishIndex?: number };
}) {
  const t = useTranslations("UnifiedSearch");
  const genie = useTranslations("Genie");
  const locale = useLocale();
  const router = useFormRouter();
  const [reply, setReply] = useState(question);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<FollowUpError | null>(null);
  const [activity, setActivity] = useState(() => Date.now());
  const history = useRef<Message[]>(requestText ? [{ role: "user", content: requestText }, { role: "assistant", content: question }] : []);
  const active = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const expired = error === "conversationExpired" || error === "conversationLimit";

  useEffect(() => {
    const expire = () => {
      if (Date.now() - activity < GENIE_IDLE_MS) return;
      active.current?.abort();
      history.current = [];
      setReply("");
      setError(ERROR.expired);
    };
    const timer = window.setTimeout(expire, GENIE_IDLE_MS);
    const events = ["focus", "pageshow", "cinegenius:app-resume"];
    events.forEach(event => window.addEventListener(event, expire));
    document.addEventListener("visibilitychange", expire);
    return () => {
      window.clearTimeout(timer);
      events.forEach(event => window.removeEventListener(event, expire));
      document.removeEventListener("visibilitychange", expire);
    };
  }, [activity]);

  useEffect(() => () => { const request = active.current; active.current = null; request?.abort(); }, []);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || active.current || expired) return;
    if (Date.now() - activity >= GENIE_IDLE_MS) {
      history.current = []; setReply(""); setError(ERROR.expired); return;
    }
    const messages: Message[] = [...history.current, { role: "user", content: text }];
    const validated = validateGenieRequest({ area: "general", locale, messages, ...(searchContext ? { searchContext } : {}) });
    if (!validated.ok) { setError(validated.error === "unsafe_input" ? ERROR.unsafe : ERROR.limit); return; }
    const controller = new AbortController();
    active.current = controller;
    setPending(true); setError(null); setActivity(Date.now());
    const timer = window.setTimeout(() => controller.abort(), 35_000);
    try {
      const response = await fetch("/api/genie", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        cache: "no-store", referrerPolicy: "no-referrer", signal: controller.signal,
        body: JSON.stringify(validated.value),
      });
      if (controller.signal.aborted) return;
      if (response.status === 401) {
        history.current = []; setReply(""); setError(ERROR.unauthorized); onUnauthorized(); return;
      }
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) { setError(data.error === "rate_limited" || data.error === "unsafe_input" ? data.error : ERROR.failed); return; }
      const link = Array.isArray(data.links) ? data.links.find((item: { href?: unknown }) => typeof item?.href === "string" && searchPlanFromHref(item.href)) : null;
      if (link) { history.current = []; router.replace(link.href, { scroll: false }); return; }
      if (typeof data.reply !== "string" || !data.reply.trim() || data.reply.length > GENIE_MAX_MESSAGE_CHARS) { setError(ERROR.failed); return; }
      history.current = [...messages, { role: "assistant", content: data.reply }];
      setReply(data.reply); setDraft(""); setActivity(Date.now());
      input.current?.focus({ preventScroll: true });
    } catch { if (active.current === controller) setError(ERROR.failed); }
    finally { window.clearTimeout(timer); if (active.current === controller) { active.current = null; setPending(false); } }
  }

  const errorText = error === "conversationExpired" || error === "conversationLimit" ? t(error)
    : error === "rate_limited" ? genie("errorRateLimited") : error === "unsafe_input" ? genie("errorUnsafe")
    : error === "unauthorized" ? t("signInRequired") : t("error");
  return <div className="mt-3 text-sm text-text-secondary">
    <p role="status">{reply}</p>
    <form className="mt-3 flex items-center gap-2" onSubmit={send}>
      <input ref={input} aria-label={t("followUpLabel")} value={draft} maxLength={GENIE_MAX_MESSAGE_CHARS}
        readOnly={pending || expired} onChange={event => {
          setDraft(event.target.value);
          if (Date.now() - activity >= GENIE_IDLE_MS) { history.current = []; setReply(""); setError(ERROR.expired); }
          else setActivity(Date.now());
        }}
        placeholder={t("followUpPlaceholder")} autoComplete="off"
        className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-bg-elevated px-4 py-3 text-base text-text-primary focus:border-gold focus:outline-none" />
      <button type="submit" aria-label={t("followUpSubmit")} disabled={pending || expired || !draft.trim()}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border px-3 text-gold disabled:opacity-50"><Send size={20} aria-hidden="true" /></button>
    </form>
    {pending && <p role="status" className="mt-2">{t("understanding")}</p>}
    {error && <p role="alert" className="mt-2">{errorText}</p>}
    {expired && searchContext && <button type="button" className="min-h-11 text-gold" onClick={() => {
      history.current = []; setReply(question); setError(null); setPending(false); active.current = null; setActivity(Date.now());
    }}>{t("restartContext")}</button>}
  </div>;
}
