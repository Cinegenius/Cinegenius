"use client";

import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { Loader2, Send } from "lucide-react";
import { useFormDraft } from "@/lib/use-form-draft";
import FormDraftStatus from "@/components/FormDraftStatus";
import { uiErrorMessage } from "@/lib/ui-error-message";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function SupportContactForm({ accountId }: { accountId: string }) {
  const t = useTranslations("SupportContact");
  const { user, isLoaded } = useUser();
  const [value, setValue] = useState({ content: "", requestKey: "" });
  const [sendPhase, setSendPhase] = useState<"idle" | "saving" | "posting">("idle");
  const sending = sendPhase !== "idle";
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const pending = useRef(false);
  const currentAccount = useRef(user?.id);
  useLayoutEffect(() => {
    currentAccount.current = user?.id;
    return () => { currentAccount.current = undefined; };
  }, [user?.id]);
  const sameAccount = isLoaded && user?.id === accountId;
  const draft = useFormDraft({ formKey: "support:contact", value, restore: setValue, enabled: sameAccount, busy: sendPhase === "posting" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !sameAccount || !draft.loaded || !value.content.trim()) return;
    pending.current = true;
    setSendPhase("saving"); setError("");
    const content = value.content.trim();
    const idempotencyKey = uuid.test(value.requestKey) ? value.requestKey : crypto.randomUUID();
    let timer: number | undefined;
    try {
      // The exact text and retry key must survive a reload before the send can
      // reach the server. This also upgrades recovery copies without a key.
      if (idempotencyKey !== value.requestKey) flushSync(() => setValue(previous => ({ ...previous, requestKey: idempotencyKey })));
      const saved = await draft.flush();
      if (currentAccount.current !== accountId) return;
      if (!saved) throw new Error(t("recoveryError"));
      setSendPhase("posting");
      const controller = new AbortController();
      timer = window.setTimeout(() => controller.abort(), 20_000);
      const response = await fetch("/api/support", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        signal: controller.signal, body: JSON.stringify({ content, idempotencyKey, accountId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (currentAccount.current !== accountId) return;
      if (!response.ok) throw new Error(payload.error || t("sendError"));
      if (!uuid.test(payload.conversationId ?? "") || !uuid.test(payload.messageId ?? "")) throw new Error(t("sendError"));
      await draft.complete();
      if (currentAccount.current !== accountId) return;
      setConversationId(payload.conversationId);
      setValue({ content: "", requestKey: "" });
    } catch (cause) {
      if (currentAccount.current === accountId) setError(uiErrorMessage(cause, t("sendError")));
    } finally {
      if (timer !== undefined) window.clearTimeout(timer);
      pending.current = false;
      if (currentAccount.current === accountId) setSendPhase("idle");
    }
  }

  if (!sameAccount) return <p role="status" className="text-sm text-text-muted">{t(isLoaded ? "accountChanged" : "loading")}</p>;
  return <section className="mx-auto min-w-0 max-w-2xl rounded-2xl border border-border bg-bg-secondary p-4 sm:p-6">
    {conversationId ? <div className="space-y-4">
      <p role="status" className="text-sm leading-6 text-text-primary">{t("sent")}</p>
      <Link href={`/messages?conv=${encodeURIComponent(conversationId)}`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-bg-primary">{t("openConversation")}</Link>
    </div> : <form onSubmit={event => void submit(event)} className="space-y-4">
      <label htmlFor="support-message" className="block text-sm font-medium text-text-primary">{t("messageLabel")}</label>
      <textarea id="support-message" value={value.content} maxLength={5000} rows={7}
        disabled={sending || !draft.loaded} required aria-describedby="support-message-help"
        onChange={event => { draft.resume(); setValue({ content: event.target.value, requestKey: crypto.randomUUID() }); setError(""); }}
        className="block min-h-40 w-full min-w-0 resize-y rounded-xl border border-border bg-bg-primary p-3 text-base leading-6 text-text-primary focus:border-gold focus:outline-none disabled:opacity-60" />
      <p id="support-message-help" className="text-xs leading-5 text-text-muted">{t("messageHelp")}</p>
      <FormDraftStatus draft={draft} />
      {error && <p role="alert" className="break-words rounded-xl border border-crimson/30 bg-crimson/10 p-3 text-sm text-crimson-light">{error}</p>}
      <button type="submit" disabled={sending || !draft.loaded || !value.content.trim()}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-bg-primary disabled:opacity-50 sm:w-auto">
        {sending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
        {t(sending ? "sending" : error ? "retry" : "send")}
      </button>
    </form>}
    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-3">
      <Link href="/messages" className="inline-flex min-h-11 items-center text-sm text-gold hover:underline">{t("messages")}</Link>
      <Link href="/help" className="inline-flex min-h-11 items-center text-sm text-text-secondary hover:underline">{t("help")}</Link>
    </div>
  </section>;
}
