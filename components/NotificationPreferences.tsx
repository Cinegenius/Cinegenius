"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

type PreferenceState = {
  account: string;
  value: boolean | null;
  status: "loading" | "ready" | "saving" | "saved" | "error";
};

/** A confirmed, account-scoped preference; failures never pretend that a value was saved. */
export default function NotificationPreferences({ accountId }: { accountId: string | null }) {
  const t = useTranslations();
  const [state, setState] = useState<PreferenceState | null>(null);
  const [retry, setRetry] = useState(0);
  const activeAccount = useRef(accountId);
  const request = useRef<AbortController | null>(null);
  useLayoutEffect(() => { activeAccount.current = accountId; }, [accountId]);
  const ownState = state?.account === accountId ? state : null;
  const busy = ownState?.status === "loading" || ownState?.status === "saving";

  useEffect(() => {
    request.current?.abort();
    if (!accountId) return;
    const controller = new AbortController();
    request.current = controller;
    queueMicrotask(() => {
      if (!controller.signal.aborted) setState({ account: accountId, value: null, status: "loading" });
    });
    void fetch("/api/user-settings", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) })
      .then(async response => {
        const body = await response.json();
        if (!response.ok || typeof body.settings?.email_new_message !== "boolean") throw new Error("unavailable");
        return body.settings.email_new_message as boolean;
      })
      .then(value => {
        if (!controller.signal.aborted && activeAccount.current === accountId) setState({ account: accountId, value, status: "ready" });
      })
      .catch(() => {
        if (!controller.signal.aborted && activeAccount.current === accountId) setState({ account: accountId, value: null, status: "error" });
      })
      .finally(() => { if (request.current === controller) request.current = null; });
    return () => { controller.abort(); request.current?.abort(); request.current = null; };
  }, [accountId, retry]);

  async function change() {
    if (!accountId || ownState?.value == null || request.current) return;
    const actor = accountId;
    const previous = ownState.value;
    const controller = new AbortController();
    request.current = controller;
    setState({ account: actor, value: previous, status: "saving" });
    try {
      const response = await fetch("/api/user-settings", {
        method: "PATCH", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: actor, email_new_message: !previous }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
      });
      const body = await response.json();
      if (!response.ok || body.success !== true || body.settings?.email_new_message !== !previous) throw new Error("unavailable");
      if (!controller.signal.aborted && activeAccount.current === actor) setState({ account: actor, value: body.settings.email_new_message, status: "saved" });
    } catch {
      if (!controller.signal.aborted && activeAccount.current === actor) setState({ account: actor, value: previous, status: "error" });
    } finally { if (request.current === controller) request.current = null; }
  }

  return <section aria-label={t("nav.notifications")} aria-busy={busy} className="min-w-0 space-y-4">
    <p className="text-sm leading-6 text-text-muted">{t("Ui.text_dcc686a995d142")}</p>
    {ownState?.status === "error" && <div role="alert" className="rounded-lg border border-border bg-bg-primary p-3 text-sm text-text-secondary">
      <p>{t("PrivacySettings.error")}</p>
      <button type="button" className="mt-1 min-h-11 text-text-primary underline underline-offset-2" disabled={busy} onClick={() => setRetry(value => value + 1)}>{t("PrivacySettings.retry")}</button>
    </div>}
    {ownState?.value == null ? <p role="status" className="flex min-h-11 items-center gap-2 text-sm text-text-muted">
      {accountId && ownState?.status !== "error" && <Loader2 size={16} className="animate-spin" />}
      {accountId && ownState?.status !== "error" ? t("PrivacySettings.loading") : t("PrivacySettings.unavailable")}
    </p> : <>
      <button type="button" role="switch" aria-checked={ownState.value} onClick={() => void change()} disabled={busy}
        className="flex min-h-14 w-full items-center justify-between gap-4 rounded-lg border border-border bg-bg-primary px-4 py-3 text-left text-sm text-text-primary disabled:opacity-60">
        <span className="min-w-0 break-words">{t("PrivacySettings.email")}</span>
        <span aria-hidden="true" className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${ownState.value ? "border-gold bg-gold" : "border-border bg-bg-elevated"}`}><span className={`absolute left-1 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${ownState.value ? "translate-x-5" : "translate-x-0"}`} /></span>
      </button>
      <p role="status" aria-live="polite" className="min-h-5 text-xs text-text-muted">{ownState.status === "saving" ? t("PrivacySettings.saving") : ownState.status === "saved" ? t("PrivacySettings.saved") : ""}</p>
    </>}
    <p className="text-xs leading-5 text-text-muted">{t("Ui.text_c4b78c69ae463f")}</p>
  </section>;
}
