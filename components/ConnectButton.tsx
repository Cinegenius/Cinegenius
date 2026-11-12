"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Clock, Loader2, UserCheck, UserPlus, X } from "lucide-react";
import { validContactConnection, type ContactConnection } from "@/lib/contact-connections";
import { uiErrorMessage } from "@/lib/ui-error-message";

/** One mutually accepted contact model on every person-profile variant. */
export default function ConnectButton({ targetUserId, disabled = false }: { targetUserId: string; disabled?: boolean }) {
  const t = useTranslations("Contacts");
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const account = user?.id ?? "";
  const scope = `${account}:${targetUserId}`;
  const current = useRef<string | null>(scope);
  const pending = useRef<AbortController | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<{ scope: string; connection: ContactConnection | null; error: string; ready: boolean; busy: boolean }>({ scope: "", connection: null, error: "", ready: false, busy: false });
  const own = snapshot.scope === scope ? snapshot : null;
  useLayoutEffect(() => {
    current.current = scope;
    return () => { current.current = null; pending.current?.abort(); pending.current = null; };
  }, [scope]);
  useEffect(() => {
    if (!isLoaded || !account || account === targetUserId || disabled) return;
    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/friendships?userId=${encodeURIComponent(targetUserId)}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
        const payload = await response.json();
        if (!response.ok || payload.friendship !== null && !validContactConnection(payload.friendship, account, targetUserId)) throw new Error(t("loadError"));
        if (active && current.current === scope) setSnapshot({ scope, connection: payload.friendship, error: "", ready: true, busy: false });
      } catch {
        if (active && current.current === scope) setSnapshot({ scope, connection: null, error: t("loadError"), ready: false, busy: false });
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [account, targetUserId, scope, disabled, isLoaded, attempt, t]);

  async function change(action: "request" | "accepted" | "rejected" | "remove") {
    if (pending.current || !own?.ready || !account || disabled) return;
    const controller = new AbortController();
    pending.current = controller;
    setSnapshot(previous => ({ ...previous, busy: true, error: "" }));
    try {
      const response = await fetch(action === "request" ? "/api/friendships" : `/api/friendships/${own.connection?.id}`, {
        method: action === "request" ? "POST" : action === "remove" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json", "X-Contact-Account": account }, cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
        ...(action === "remove" ? {} : { body: JSON.stringify(action === "request" ? { receiver_id: targetUserId, accountId: account } : { status: action, accountId: account }) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (current.current !== scope) return;
      if (!response.ok) throw new Error(payload.error || t("error"));
      if (action === "remove" && (payload.success !== true || payload.friendship !== null)) throw new Error(t("error"));
      if (action !== "remove" && !validContactConnection(payload.friendship, account, targetUserId)) throw new Error(t("error"));
      setSnapshot({ scope, connection: payload.friendship, error: "", ready: true, busy: false });
      window.dispatchEvent(new Event("cg:contacts-changed"));
      if (action === "accepted" || action === "remove") router.refresh();
    } catch (cause) {
      if (current.current === scope) setSnapshot(previous => ({ ...previous, error: uiErrorMessage(cause, t("error")), busy: false }));
    } finally { if (pending.current === controller) pending.current = null; }
  }

  const button = "inline-flex min-h-11 min-w-11 max-w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-secondary px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:border-gold/50 disabled:opacity-50";
  if (account === targetUserId || disabled) return null;
  if (isLoaded && !account) return <Link href={`/sign-in?redirect_url=${encodeURIComponent(pathname)}`} className={button}><UserPlus size={14} aria-hidden="true" />{t("add")}</Link>;
  if (!own?.ready) return <div className="min-w-0 max-w-full">
    {own?.error ? <><p role="alert" className="mb-1 max-w-xs text-xs text-red-400">{own.error}</p><button type="button" onClick={() => setAttempt(value => value + 1)} className={button}>{t("retry")}</button></>
      : <button type="button" disabled className={button}><Loader2 size={14} className="animate-spin" aria-hidden="true" />{t("loading")}</button>}
  </div>;
  const connection = own.connection;
  return <div className="min-w-0 max-w-full">
    <div className="flex max-w-full flex-wrap items-center gap-2">
      {connection?.status === "accepted" ? <Link href="/dashboard?tab=friends" className={button}><UserCheck size={14} aria-hidden="true" />{t("inContacts")}</Link>
        : connection?.status === "pending" && connection.sender_id === account ? <>
          <span role="status" className="inline-flex min-h-11 items-center gap-1.5 text-xs text-text-secondary"><Clock size={14} aria-hidden="true" />{t("requestSent")}</span>
          <button type="button" disabled={own.busy} onClick={() => void change("remove")} className={button}>{t("cancelRequest")}</button>
        </> : connection?.status === "pending" ? <>
          <button type="button" disabled={own.busy} onClick={() => void change("accepted")} className={button}>{own.busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}{t("accept")}</button>
          <button type="button" disabled={own.busy} onClick={() => void change("rejected")} className={button}><X size={14} aria-hidden="true" />{t("reject")}</button>
        </> : <button type="button" disabled={own.busy} onClick={() => void change("request")} className={button}>{own.busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <UserPlus size={14} aria-hidden="true" />}{t("add")}</button>}
    </div>
    {own.error && <p role="alert" className="mt-1 max-w-xs break-words text-xs text-red-400">{own.error}</p>}
  </div>;
}
