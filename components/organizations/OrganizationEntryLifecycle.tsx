"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { EyeOff, RotateCcw, Trash2 } from "lucide-react";

export type LifecycleEntry = {
  id: string; title: string; updated_at: string; moderation_status: string;
  owner_withdrawn_from?: string | null;
};
export type LifecycleAction = "hide" | "delete" | "restore";

export default function OrganizationEntryLifecycle({ entry, disabled, onAction }: {
  entry: LifecycleEntry; disabled: boolean;
  onAction: (entry: LifecycleEntry, action: LifecycleAction, reason: string) => Promise<boolean>;
}) {
  const t = useTranslations("Organizations.lifecycle");
  const [action, setAction] = useState<LifecycleAction | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const button = "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50 [overflow-wrap:anywhere]";
  const hidden = entry.moderation_status === "hidden";
  const deleted = entry.moderation_status === "deleted";

  return <section className="min-w-0 space-y-3 rounded-2xl border border-border bg-bg-secondary p-5 [overflow-wrap:anywhere]" aria-label={t("manage")}>
    <h2 className="font-semibold text-text-primary">{t("manage")}</h2>
    <p className="text-sm text-text-secondary">{t("notice")}</p>
    {action ? <form onSubmit={async event => {
      event.preventDefault();
      if (pending.current || disabled || reason.trim().length < 5) return;
      pending.current = true; setBusy(true);
      try {
        if (await onAction(entry, action, reason.trim())) { setAction(null); setReason(""); }
      } finally { pending.current = false; setBusy(false); }
    }} className="space-y-3">
      <p className="font-semibold text-text-primary">{t("confirm", { action: t(action), title: entry.title })}</p>
      <p className="text-sm text-text-secondary">{t(`${action}Help`)}</p>
      <label className="block text-sm text-text-primary">{t("reason")}
        <textarea required minLength={5} maxLength={1000} disabled={disabled || busy} value={reason} onChange={event => setReason(event.target.value)} className="mt-1 min-h-24 w-full rounded-xl border border-border bg-bg-primary px-3 py-2" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button disabled={disabled || busy || reason.trim().length < 5} className={`${button} text-crimson-light`}>{busy ? t("working") : t(action)}</button>
        <button type="button" disabled={disabled || busy} onClick={() => { setAction(null); setReason(""); }} className={`${button} text-text-primary`}>{t("cancel")}</button>
      </div>
    </form> : <div className="flex flex-wrap gap-2">
      {!hidden && !deleted && <button type="button" disabled={disabled} onClick={() => setAction("hide")} className={`${button} text-text-primary`}><EyeOff size={17} aria-hidden="true" />{t("hide")}</button>}
      {!deleted && <button type="button" disabled={disabled} onClick={() => setAction("delete")} className={`${button} text-crimson-light`}><Trash2 size={17} aria-hidden="true" />{t("delete")}</button>}
      {(deleted || hidden && !!entry.owner_withdrawn_from) && <button type="button" disabled={disabled} onClick={() => setAction("restore")} className={`${button} text-text-primary`}><RotateCcw size={17} aria-hidden="true" />{t("restore")}</button>}
    </div>}
  </section>;
}
