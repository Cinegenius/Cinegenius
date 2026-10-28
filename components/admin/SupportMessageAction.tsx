"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import UnoptimizedImage from "@/components/UnoptimizedImage";
import { Check, Loader2, Mail, MessageSquareText, Send, X } from "lucide-react";
import { SUPPORT_AVATAR_URL } from "@/lib/support-identity";
import { fillSupportTemplate } from "@/lib/support-message-templates";
import { SETUP_TEMPLATE_KEY } from "@/lib/support-setup-template";

type TargetType = "profile" | "company" | "listing";
type Template = { template_key: string; label: string; body: string; enabled: boolean };
type Target = {
  targetType: "profile" | "company" | "location" | "marketplace";
  targetId: string; targetLabel: string; editUrl: string; recipientUserId: string;
  recipientName: string; recipientProfileUrl: string | null; recipientAvatarUrl: string | null;
  firstName: string | null; companyName: string | null; listingTitle: string | null;
  missingFields: string[]; isDraft: boolean;
  setupIncomplete?: boolean;
};
type Previous = { id: string; support_target_label: string; updated_at: string };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Aktion fehlgeschlagen.");
  return data as T;
}
function defaultKey(target: Target) {
  if (target.setupIncomplete) return SETUP_TEMPLATE_KEY;
  if (target.targetType === "profile" && !target.recipientProfileUrl) return "check_in";
  if (target.targetType === "profile") return "crew_profile";
  if (target.targetType === "company") return "company_profile";
  return target.targetType === "location" ? "location" : "marketplace_listing";
}
function applies(template: Template, target: Target) {
  if (template.template_key === SETUP_TEMPLATE_KEY) return target.setupIncomplete === true;
  if (template.template_key === "crew_profile") return target.targetType === "profile" && Boolean(target.recipientProfileUrl);
  if (template.template_key === "company_profile") return target.targetType === "company";
  if (template.template_key === "location") return target.targetType === "location";
  if (template.template_key === "marketplace_listing") return target.targetType === "marketplace";
  if (template.template_key === "more_photos") return target.targetType === "location" || target.targetType === "marketplace";
  if (template.template_key === "resume_draft") return target.targetType !== "profile" && target.isDraft;
  return true;
}

export function SupportMessageAction({ targetType, targetId, label }: { targetType: TargetType; targetId: string; label?: string }) {
  const t = useTranslations("AdminAccounts");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [target, setTarget] = useState<Target | null>(null);
  const [previous, setPrevious] = useState<Previous[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateKey, setTemplateKey] = useState("");
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const idempotency = useRef<{ content: string; key: string } | null>(null);
  const selected = templates.find((template) => template.template_key === templateKey);
  const needsFields = selected?.body.includes("{{fehlendeAngaben}}") ?? false;
  const unresolved = /\{\{[^}]+\}\}/.test(message);
  const linkUrl = target ? new URL(target.editUrl, typeof window === "undefined" ? "https://www.cinegenius.co" : window.location.origin).toString() : "";
  const linkOkay = !selected?.body.includes("{{Bearbeitungslink}}") || (Boolean(linkUrl) && message.includes(linkUrl));

  async function openModal() {
    if (success) idempotency.current = null;
    setOpen(true); setLoading(true); setError(""); setSuccess("");
    try {
      const [resolved, templateList] = await Promise.all([
        fetchJson<{ target: Target; previousContacts: Previous[] }>(
          "/api/admin/support/resolve?type=" + targetType + "&id=" + encodeURIComponent(targetId), { cache: "no-store" },
        ),
        fetchJson<{ templates: Template[] }>("/api/admin/support/templates", { cache: "no-store" }),
      ]);
      setTarget(resolved.target); setPrevious(resolved.previousContacts);
      const enabled = templateList.templates.filter((template) => template.enabled && applies(template, resolved.target));
      setTemplates(enabled);
      const first = enabled.find((template) => template.template_key === defaultKey(resolved.target))
        ?? enabled.find((template) => template.template_key === "check_in") ?? enabled[0];
      setTemplateKey(first?.template_key ?? "");
      setMessage(first ? fillSupportTemplate(first.body, resolved.target, window.location.origin) : "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Supportziel konnte nicht geladen werden.");
    } finally { setLoading(false); }
  }
  function selectTemplate(key: string) {
    setTemplateKey(key);
    const template = templates.find((item) => item.template_key === key);
    if (template && target) setMessage(fillSupportTemplate(template.body, target, window.location.origin));
  }
  async function submit() {
    if (!target || !selected || submitting.current || success || !message.trim() || unresolved || !linkOkay) return;
    if (needsFields && !target.missingFields.length) {
      setError("Keine fehlenden Pflichtangaben gefunden. Freiwillige Ergänzungen stellen wir nicht als Pflicht dar.");
      return;
    }
    submitting.current = true;
    setSending(true); setError(""); setSuccess("");
    try {
      const content = message.trim();
      if (!idempotency.current || idempotency.current.content !== content) {
        idempotency.current = { content, key: crypto.randomUUID() };
      }
      const result = await fetchJson<{ success: boolean; duplicate: boolean; conversationId: string }>("/api/admin/support/threads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, templateKey, content, idempotencyKey: idempotency.current.key }),
      });
      if (!result.success || !result.conversationId) throw new Error("Die Speicherung konnte nicht bestätigt werden. Bitte sicher erneut versuchen; dieselbe Nachricht wird nicht doppelt gespeichert.");
      setSuccess(result.duplicate ? "Nachricht bereits erfolgreich gesendet. Es wurde kein Duplikat erstellt." : "Nachricht erfolgreich gesendet.");
    } catch (cause) { setError(cause instanceof TypeError ? "Keine Versandbestätigung erhalten. Bitte erneut versuchen. Deine Nachricht bleibt erhalten; der erneute Versuch erzeugt keine doppelte Nachricht." : cause instanceof Error ? cause.message : "Nachricht konnte nicht gesendet werden."); }
    finally { submitting.current = false; setSending(false); }
  }

  return <>
    <button type="button" onClick={() => void openModal()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gold/30 px-3 py-2 text-xs font-semibold text-gold hover:bg-gold/10">
      <MessageSquareText size={13} /> {label || t("sendSupport")}
    </button>
    {open && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !sending) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="support-compose-title" className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-bg-primary shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-5"><div><h2 id="support-compose-title" className="font-display text-xl font-bold text-text-primary">Supportnachricht senden</h2><p className="mt-1 text-xs text-text-muted">Einzelversand im Namen von CineGenius Support</p></div><button type="button" onClick={() => setOpen(false)} disabled={sending} aria-label="Fenster schließen" className="rounded-lg p-2 text-text-muted hover:bg-bg-elevated"><X size={18} /></button></header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {success && <div role="status" aria-live="polite" className="rounded-xl border border-success/30 bg-success/10 p-4 sm:p-5"><div className="flex items-center gap-3 text-success"><Check size={24} /><h3 className="text-lg font-semibold">{success}</h3></div><p className="mt-2 text-sm text-text-primary">Die Nachricht an {target?.recipientName} ist dauerhaft gespeichert und im Nachrichtenbereich des Mitglieds verfügbar.</p><p className="mt-2 text-xs text-text-secondary">Du findest die Unterhaltung unter Admin → Support. Dieses Fenster bleibt bis zum Schließen geöffnet.</p><p className="mt-4 whitespace-pre-wrap break-words border-t border-success/30 pt-4 text-sm leading-6 text-text-primary">{message}</p></div>}
          {!success && (loading ? <div className="flex items-center gap-2 py-10 text-sm text-text-muted"><Loader2 className="animate-spin" size={17} /> Empfänger und Profil werden geprüft…</div> : target && <>
            <div className="rounded-xl border border-border bg-bg-secondary p-3 sm:p-4">
              <div className="flex items-center gap-3">{target.recipientAvatarUrl ? <UnoptimizedImage src={target.recipientAvatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-elevated text-text-muted"><Mail size={16} /></div>}<div className="min-w-0 flex-1"><p className="text-xs text-text-muted">Empfänger</p>{target.recipientProfileUrl ? <a href={target.recipientProfileUrl} target="_blank" rel="noreferrer" className="block truncate text-sm font-semibold text-text-primary hover:text-gold">{target.recipientName}</a> : <p className="text-sm font-semibold text-text-primary">{target.recipientName}</p>}</div></div>
              <p className="mt-3 border-t border-border pt-3 text-xs text-text-muted">Betroffen: <strong className="text-text-secondary">{target.targetLabel}</strong>{target.isDraft ? " · Entwurf" : ""}</p>
              {target.missingFields.length > 0 && <p className="mt-1 text-xs text-gold">Ermittelte fehlende Pflichtangaben: {target.missingFields.join(", ")}</p>}
              {previous.length > 0 && <div className="mt-3 border-t border-border pt-3"><p className="text-xs font-semibold text-text-secondary">Bisherige Supportkontakte dieses Mitglieds</p><ul className="mt-1 space-y-1">{previous.map((item) => <li key={item.id} className="text-xs text-text-muted">{new Date(item.updated_at).toLocaleString("de-DE")} · {item.support_target_label}</li>)}</ul></div>}
            </div>
            <label className="block text-xs font-medium text-text-secondary">Nachrichtenvorlage<select disabled={sending} value={templateKey} onChange={(event) => selectTemplate(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary">{templates.map((template) => <option key={template.template_key} value={template.template_key}>{template.label}</option>)}</select></label>
            {needsFields && !target.missingFields.length && <p role="status" className="rounded-lg border border-gold/30 bg-gold/10 p-3 text-xs text-gold">Diese Vorlage passt nicht: Es fehlen keine Pflichtangaben. Wähle eine Nachfrage oder eine optionale Fotovorlage.</p>}
            <label className="block text-xs font-medium text-text-secondary">Nachricht bearbeiten<textarea disabled={sending} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={5000} rows={7} className="mt-1.5 w-full resize-y rounded-lg border border-border bg-bg-secondary p-3 text-sm leading-6 text-text-primary outline-none focus:border-gold" /></label>
            <div className="rounded-xl border border-border bg-bg-secondary p-3 sm:p-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Vorschau</p><p className="whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">{message || "Die Nachrichtenvorschau erscheint hier."}</p><p className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-text-muted"><UnoptimizedImage src={SUPPORT_AVATAR_URL} alt="" className="h-5 w-5 object-contain" />CineGenius Support</p></div>
            <p className="text-[11px] leading-5 text-text-muted">Antworten landen im geschützten Support-Postfach. Private Kontaktdaten des Administrators werden nicht angezeigt.</p>
          </>)}
          {error && <p role="alert" className="rounded-lg border border-crimson/30 bg-crimson/10 p-3 text-sm text-crimson-light">{error}</p>}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-border p-4"><button type="button" onClick={() => setOpen(false)} disabled={sending} className="min-h-11 rounded-lg border border-border px-4 text-sm text-text-secondary">{success ? "Schließen" : "Abbrechen"}</button>{!success && <button type="button" onClick={() => void submit()} disabled={loading || sending || !selected || !message.trim() || unresolved || !linkOkay || (needsFields && !target?.missingFields.length)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-semibold text-bg-primary disabled:cursor-not-allowed disabled:opacity-50">{sending ? <><Loader2 size={15} className="animate-spin" /> Wird gespeichert…</> : <><Send size={15} /> Nachricht senden</>}</button>}</footer>
      </section>
    </div>}
  </>;
}

