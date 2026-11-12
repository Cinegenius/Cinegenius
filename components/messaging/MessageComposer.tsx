"use client";
import {useLayoutEffect, useRef, useState, type FormEvent} from "react";
import {flushSync} from "react-dom";
import {useUser} from "@clerk/nextjs";
import {useTranslations} from "next-intl";
import {Loader2, Send} from "lucide-react";
import {useFormDraft} from "@/lib/use-form-draft";
import FormDraftStatus from "@/components/FormDraftStatus";
import {messageDestinationKey, confirmedChatMessage, validConversationId, restoredMessageValue, validMessageRequestKey, type ChatMessage, type MessageDestination} from "@/lib/messaging-ui";
import {uiErrorMessage} from "@/lib/ui-error-message";

export default function MessageComposer({accountId, destination, onSent}: {accountId: string; destination: MessageDestination; onSent: (message: ChatMessage, conversationId: string) => void}) {
  const t = useTranslations("Messaging");
  const {user, isLoaded} = useUser();
  const key = messageDestinationKey(destination);
  const [value, setValue] = useState({destination:key, content:"", requestKey:""});
  const [phase, setPhase] = useState<"idle" | "saving" | "posting">("idle");
  const [error, setError] = useState("");
  const [wrongTarget, setWrongTarget] = useState(false);
  const pending = useRef(false);
  const owner = useRef(user?.id);
  useLayoutEffect(() => {owner.current = user?.id; return () => {owner.current = undefined;};}, [user?.id]);
  const sameAccount = isLoaded && user?.id === accountId;
  const draft = useFormDraft({formKey:`message:${key}`, value, enabled:sameAccount && !!key && !wrongTarget, busy:phase === "posting", restore: saved => {
    const restored = restoredMessageValue(saved, key);
    if (restored) setValue(restored); else setWrongTarget(true);
  }});
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (pending.current || !sameAccount || !draft.loaded || wrongTarget || !value.content.trim()) return;
    pending.current = true; setPhase("saving"); setError("");
    const content = value.content.trim();
    const idempotencyKey = validMessageRequestKey(value.requestKey) ? value.requestKey : crypto.randomUUID();
    const ownDestination = {...destination};
    let timeout: number | undefined;
    try {
      if (value.requestKey !== idempotencyKey) flushSync(() => setValue(current => ({...current, requestKey:idempotencyKey})));
      const saved = await draft.flush();
      if (owner.current !== accountId) return;
      if (!saved) throw new Error(t("recoveryError"));
      setPhase("posting");
      const controller = new AbortController(); timeout = window.setTimeout(() => controller.abort(), 20_000);
      const response = await fetch(ownDestination.conversationId ? `/api/conversations/${ownDestination.conversationId}` : "/api/conversations", {
        method:"POST", cache:"no-store", signal:controller.signal, headers:{"Content-Type":"application/json"},
        body:JSON.stringify({content, idempotencyKey, accountId, ...(ownDestination.conversationId ? {} : {receiver_id:ownDestination.recipientId})}),
      });
      const payload = await response.json().catch(() => ({}));
      if (owner.current !== accountId) return;
      const conversationId = ownDestination.conversationId ?? payload.conversationId;
      if (!response.ok || !confirmedChatMessage(payload.message, accountId, content) || !validConversationId(conversationId)) throw new Error(payload.error ?? t("sendError"));
      await draft.complete();
      if (owner.current !== accountId) return;
      setValue({destination:key, content:"", requestKey:""});
      onSent(payload.message, conversationId);
    } catch (cause) {if (owner.current === accountId) setError(uiErrorMessage(cause, t("sendError")));}
    finally {if (timeout !== undefined) window.clearTimeout(timeout); pending.current = false; if (owner.current === accountId) setPhase("idle");}
  }
  if (!sameAccount) return <p role="status" className="p-3 text-sm text-text-muted">{t("loading")}</p>;
  return <form onSubmit={event => void submit(event)} className="shrink-0 border-t border-border px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:px-4">
    {wrongTarget && <p role="alert" className="mb-2 text-sm text-red-400 [[data-theme=light]_&]:text-red-700">{t("wrongTarget")}</p>}
    {error && <p role="alert" className="mb-2 break-words text-sm text-red-400 [[data-theme=light]_&]:text-red-700">{error}</p>}
    {(value.content || draft.status === "error" || !draft.loaded) && <FormDraftStatus draft={draft}/>}
    <div className="flex min-w-0 items-end gap-2">
      <textarea aria-label={t("message")} placeholder={t("message")} rows={1} maxLength={5000} value={value.content} disabled={phase !== "idle" || !draft.loaded || wrongTarget}
        onChange={event => {draft.resume(); setValue({destination:key, content:event.target.value, requestKey:event.target.value.trim() === value.content.trim() ? value.requestKey : crypto.randomUUID()}); setError(""); event.target.style.height="auto"; event.target.style.height=`${Math.min(144,event.target.scrollHeight)}px`;}}
        onKeyDown={event => {if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && window.matchMedia?.("(pointer:fine)").matches) {event.preventDefault(); void submit();}}}
        className="min-h-11 max-h-36 min-w-0 flex-1 resize-none rounded-2xl border border-border bg-bg-elevated px-4 py-3 text-base leading-5 text-text-primary outline-none focus:border-gold disabled:opacity-60"/>
      <button type="submit" aria-label={t(error ? "retrySend" : "send")} disabled={phase !== "idle" || !draft.loaded || wrongTarget || !value.content.trim()} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-2xl bg-gold text-bg-primary disabled:opacity-40">{phase !== "idle" ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}</button>
    </div>
  </form>;
}
