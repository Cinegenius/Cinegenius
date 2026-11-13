"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Loader2, MessageSquare } from "lucide-react";
import MediaImage from "./MediaImage";
import MessagingDialog from "./messaging/MessagingDialog";

type Contact = {
  friendship_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
};

export default function ContactCard({ contact, pending, error, onRemove }: {
  contact: Contact;
  pending: boolean;
  error: string;
  onRemove: (id: string) => Promise<boolean>;
}) {
  const t = useTranslations("Contacts");
  const profile = useTranslations("profile");
  const [confirm, setConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const busy = pending || removing;
  const focusStyle = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";
  const close = () => { if (!inFlight.current && !pending) setConfirm(false); };

  async function remove() {
    if (pending || inFlight.current) return;
    inFlight.current = true;
    setRemoving(true); setFailed(false);
    try {
      const removed = await onRemove(contact.friendship_id);
      if (mounted.current) {
        if (removed) setConfirm(false);
        else setFailed(true);
      }
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      inFlight.current = false;
      if (mounted.current) setRemoving(false);
    }
  }

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-bg-secondary p-4 transition-colors hover:border-gold/30 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="shrink-0">
          {contact.avatar_url ? (
            <MediaImage src={contact.avatar_url} alt="" width={44} height={44} unoptimized className="h-11 w-11 rounded-full border border-border object-cover" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/20 bg-gold/15">
              <span className="text-base font-bold text-gold">{contact.display_name[0]?.toUpperCase()}</span>
            </div>
          )}
        </div>
        <div className="min-w-0 [overflow-wrap:anywhere]">
          <p className="text-sm font-semibold text-text-primary">{contact.display_name}</p>
          <p className="text-xs text-text-muted">{contact.role}</p>
        </div>
      </div>
      <div className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 sm:justify-end">
        <Link href={`/messages?to=${encodeURIComponent(contact.user_id)}`} aria-label={t("messageLabel", { name: contact.display_name })}
          className={`inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/20 ${focusStyle}`}>
          <MessageSquare size={16} className="shrink-0" aria-hidden="true" /><span className="min-w-0 [overflow-wrap:anywhere]">{t("message")}</span>
        </Link>
        <Link href={`/profile/${encodeURIComponent(contact.user_id)}`} className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-1 py-2 text-xs text-text-secondary hover:text-gold ${focusStyle}`}>{profile("tabProfile")}</Link>
        <button type="button" disabled={busy} onClick={() => { setFailed(false); setConfirm(true); }} aria-label={t("removeLabel", { name: contact.display_name })}
          className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded px-1 py-2 text-[11px] text-text-muted underline decoration-text-muted/40 underline-offset-4 hover:text-red-400 disabled:opacity-40 ${focusStyle}`}>{t("removeShort")}</button>
      </div>
      <MessagingDialog open={confirm} compact title={t("remove")} busy={busy} onClose={close} footer={<>
        <button type="button" disabled={busy} onClick={close} className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm text-text-secondary disabled:opacity-40 ${focusStyle}`}>{t("cancel")}</button>
        <button type="button" disabled={busy} onClick={() => void remove()} className={`inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm text-red-400 disabled:opacity-40 [overflow-wrap:anywhere] ${focusStyle}`}>
          {busy && <Loader2 size={16} className="shrink-0 animate-spin" aria-hidden="true" />}{t(busy ? "removing" : "remove")}
        </button>
      </>}>
        <p className="text-sm text-text-secondary [overflow-wrap:anywhere]">{t("confirmRemove", { name: contact.display_name })}</p>
        {failed && <p role="alert" className="text-sm text-red-400 [overflow-wrap:anywhere]">{error || t("error")}</p>}
      </MessagingDialog>
    </article>
  );
}
