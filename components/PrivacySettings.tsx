"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PRIVACY_AUDIENCES, type PrivacySettings as Settings } from "@/lib/profile-privacy";

export default function PrivacySettings({ accountId }: { accountId: string | null }) {
  const t = useTranslations("PrivacySettings");
  const router = useRouter();
  const [loaded, setLoaded] = useState<{account: string; settings: Settings} | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  const account = useRef(accountId); account.current = accountId;
  const request = useRef<AbortController | null>(null);
  const settings = loaded?.account === accountId ? loaded.settings : null;

  useEffect(() => {
    setLoaded(null); setError(false); setSaved(false);
    if (!accountId) return;
    const controller = new AbortController(); request.current = controller; setBusy(true);
    fetch("/api/user-settings", { cache: "no-store", signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok || !body.settings || typeof body.settings.ghost_mode !== "boolean") throw new Error(); return body.settings as Settings; })
      .then(value => { if (!controller.signal.aborted && account.current === accountId) setLoaded({ account: accountId, settings: value }); })
      .catch(() => { if (!controller.signal.aborted && account.current === accountId) setError(true); })
      .finally(() => { if (request.current === controller) { request.current = null; setBusy(false); } });
    return () => { controller.abort(); request.current?.abort(); request.current = null; };
  }, [accountId, retry]);

  async function change(key: keyof Settings, value: string | boolean) {
    if (!accountId || !settings || request.current) return;
    const actor = accountId, controller = new AbortController(); request.current = controller;
    setBusy(true); setError(false); setSaved(false);
    try {
      const response = await fetch("/api/user-settings", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: actor, [key]: value }), signal: controller.signal });
      const body = await response.json();
      if (!response.ok || !body.success || typeof body.settings?.ghost_mode !== "boolean") throw new Error();
      if (controller.signal.aborted || account.current !== actor) return;
      setLoaded({ account: actor, settings: body.settings }); setSaved(true);
      window.dispatchEvent(new Event("cinegenius:privacy-changed")); router.refresh();
    } catch { if (!controller.signal.aborted && account.current === actor) setError(true); }
    finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  }

  const control = "min-h-11 w-full min-w-0 rounded-lg border border-border bg-bg-primary px-3 text-sm text-text-primary focus:border-gold/60 disabled:opacity-60";
  return <section className="p-5 rounded-xl border border-border bg-bg-secondary" aria-busy={busy}>
    <h3 className="font-semibold text-text-primary mb-1">{t("title")}</h3>
    <p className="text-xs text-text-muted mb-4 leading-relaxed">{t("intro")}</p>
    {error && <div role="alert" className="mb-4 text-sm text-text-secondary"><p>{t("error")}</p><button type="button" className="min-h-11 text-gold underline" disabled={busy} onClick={() => setRetry(value => value + 1)}>{t("retry")}</button></div>}
    {!settings ? <p role="status" className="text-sm text-text-muted">{busy ? t("loading") : t("unavailable")}</p> : <>
      <label className="flex min-h-11 items-center justify-between gap-4">
        <span><span className="block text-sm font-semibold text-text-primary">{t("ghost")}</span><span className="mt-1 block text-xs leading-relaxed text-text-muted">{t("ghostHelp")}</span></span>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center"><input type="checkbox" className="h-5 w-5 accent-gold" checked={settings.ghost_mode} disabled={busy} onChange={event => void change("ghost_mode", event.target.checked)} /></span>
      </label>
      <p className="mt-3 text-xs leading-relaxed text-text-muted">{t("limits")}</p>
      {settings.ghost_mode && <p className="mt-3 text-sm text-gold" role="status">{t("ghostActive")}</p>}
      <fieldset disabled={busy || settings.ghost_mode} className="mt-5 grid min-w-0 gap-4 border-t border-border pt-4 sm:grid-cols-2 disabled:opacity-60">
        <legend className="sr-only">{t("visibility")}</legend>
        <label className="block min-w-0 text-xs text-text-muted"><span className="mb-1.5 block">{t("profile")}</span>
          <select className={control} value={settings.profile_visibility} onChange={event => void change("profile_visibility",event.target.value)}>
            <option value="public">{t("audience.public")}</option><option value="private">{t("audience.friends")}</option>
          </select>
        </label>
        {(["location_visibility","map_visibility","activity_visibility","phone_visibility","contact_email_visibility"] as const).map(key => <label key={key} className="block min-w-0 text-xs text-text-muted"><span className="mb-1.5 block">{t(key)}</span>
          <select className={control} value={settings[key]} onChange={event => void change(key,event.target.value)}>{PRIVACY_AUDIENCES.map(audience => <option key={audience} value={audience}>{t(`audience.${audience}`)}</option>)}</select>
        </label>)}
      </fieldset>
      <p className="mt-3 text-xs leading-relaxed text-text-muted">{t("locationHelp")}</p>
      <div className="mt-5 border-t border-border pt-4 space-y-4">
        <label className="block text-xs text-text-muted"><span className="mb-1.5 block">{t("messages")}</span><select className={control} value={settings.message_permission} disabled={busy} onChange={event => void change("message_permission",event.target.value)}><option value="everyone">{t("audience.members")}</option><option value="friends_only">{t("audience.friends")}</option></select></label>
        <label className="flex min-h-11 items-center justify-between gap-4 text-sm text-text-secondary"><span>{t("email")}</span><span className="flex h-11 w-11 shrink-0 items-center justify-center"><input type="checkbox" className="h-5 w-5 accent-gold" checked={settings.email_new_message} disabled={busy} onChange={event => void change("email_new_message",event.target.checked)} /></span></label>
      </div>
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-xs text-text-muted">{busy ? t("saving") : saved ? t("saved") : ""}</p>
    </>}
  </section>;
}
