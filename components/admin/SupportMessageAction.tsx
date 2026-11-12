"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslations , useLocale } from "next-intl";
import UnoptimizedImage from "@/components/UnoptimizedImage";
import { Check, Loader2, Mail, MessageSquareText, Send, X } from "lucide-react";
import { SUPPORT_AVATAR_URL } from "@/lib/support-identity";
import { fillSupportTemplate } from "@/lib/support-message-templates";
import { SETUP_TEMPLATE_KEY } from "@/lib/support-setup-template";
import { STARTED_OFFER_TEMPLATE_KEY } from "@/lib/support-started-offer-template";
import { uiErrorMessage } from "@/lib/ui-error-message";

type TargetType = "profile" | "company" | "listing" | "started_offer";
type Template = { template_key: string; label: string; body: string; enabled: boolean };
type Target = {
  targetType: "profile" | "company" | "location" | "marketplace";
  targetId: string; targetLabel: string; editUrl: string; recipientUserId: string;
  recipientName: string; recipientProfileUrl: string | null; recipientAvatarUrl: string | null;
  firstName: string | null; companyName: string | null; listingTitle: string | null;
  missingFields: string[]; isDraft: boolean;
  setupIncomplete?: boolean;
  startedOffer?: boolean;
};
type Previous = { id: string; support_target_label: string; updated_at: string };

async function fetchJson<T>(translate: (key: string, values?: Record<string, string | number>) => string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? translate("Ui.text_028a4ad4223a26"));
  return data as T;
}
function defaultKey(target: Target) {
  if (target.startedOffer) return STARTED_OFFER_TEMPLATE_KEY;
  if (target.setupIncomplete) return SETUP_TEMPLATE_KEY;
  if (target.targetType === "profile" && !target.recipientProfileUrl) return "check_in";
  if (target.targetType === "profile") return "crew_profile";
  if (target.targetType === "company") return "company_profile";
  return target.targetType === "location" ? "location" : "marketplace_listing";
}
function applies(template: Template, target: Target) {
  if (template.template_key === STARTED_OFFER_TEMPLATE_KEY) return target.startedOffer === true;
  if (target.startedOffer) return ["check_in", "resume_draft"].includes(template.template_key);
  if (template.template_key === SETUP_TEMPLATE_KEY) return target.setupIncomplete === true;
  if (template.template_key === "crew_profile") return target.targetType === "profile" && Boolean(target.recipientProfileUrl);
  if (template.template_key === "company_profile") return target.targetType === "company";
  if (template.template_key === "location") return target.targetType === "location";
  if (template.template_key === "marketplace_listing") return target.targetType === "marketplace";
  if (template.template_key === "more_photos") return target.targetType === "location" || target.targetType === "marketplace";
  if (template.template_key === "resume_draft") return target.targetType !== "profile" && target.isDraft;
  return true;
}

export function SupportMessageAction({ targetType, targetId, label, preferredTemplate }: { targetType: TargetType; targetId: string; label?: string; preferredTemplate?: string }) {
  const uiText = useTranslations();
  const uiLocale = useLocale();

  const t = useTranslations("AdminAccounts");
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const openingRequest = useRef(0);
  const [visibleViewport, setVisibleViewport] = useState<{ height: number; top: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    if (!element) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal(); closeButton.current?.focus();
    const viewport = window.visualViewport;
    const update = () => setVisibleViewport({ height: viewport?.height ?? window.innerHeight, top: viewport?.offsetTop ?? 0 });
    update();
    viewport?.addEventListener("resize", update); viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      ++openingRequest.current;
      if (element.open) element.close();
      document.body.style.overflow = previousOverflow;
      viewport?.removeEventListener("resize", update); viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open]);
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
    const request = ++openingRequest.current;
    if (success) idempotency.current = null;
    setOpen(true); setLoading(true); setError(""); setSuccess("");
    try {
      const [resolved, templateList] = await Promise.all([
        fetchJson<{ target: Target; previousContacts: Previous[] }>(uiText,
          "/api/admin/support/resolve?type=" + targetType + "&id=" + encodeURIComponent(targetId), { cache: "no-store" },
        ),
        fetchJson<{ templates: Template[] }>(uiText, "/api/admin/support/templates", { cache: "no-store" }),
      ]);
      if (request !== openingRequest.current) return;
      setTarget(resolved.target); setPrevious(resolved.previousContacts);
      const enabled = templateList.templates.filter((template) => template.enabled && applies(template, resolved.target));
      setTemplates(enabled);
      const first = enabled.find((template) => preferredTemplate && template.template_key === preferredTemplate)
        ?? enabled.find((template) => template.template_key === defaultKey(resolved.target))
        ?? enabled.find((template) => template.template_key === "check_in") ?? enabled[0];
      setTemplateKey(first?.template_key ?? "");
      setMessage(first ? fillSupportTemplate(first.body, resolved.target, window.location.origin) : "");
    } catch (cause) {
      if (request === openingRequest.current) setError(uiErrorMessage(cause, uiText("Ui.text_e1dd0c7724a370")));
    } finally { if (request === openingRequest.current) setLoading(false); }
  }
  function selectTemplate(key: string) {
    setTemplateKey(key);
    const template = templates.find((item) => item.template_key === key);
    if (template && target) setMessage(fillSupportTemplate(template.body, target, window.location.origin));
  }
  async function submit() {
    if (!target || !selected || submitting.current || success || !message.trim() || unresolved || !linkOkay) return;
    if (needsFields && !target.missingFields.length) {
      setError(uiText("Ui.text_54fbfa121a20d5"));
      return;
    }
    submitting.current = true;
    setSending(true); setError(""); setSuccess("");
    try {
      const content = message.trim();
      if (!idempotency.current || idempotency.current.content !== content) {
        idempotency.current = { content, key: crypto.randomUUID() };
      }
      const result = await fetchJson<{ success: boolean; duplicate: boolean; conversationId: string }>(uiText, "/api/admin/support/threads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, templateKey, content, idempotencyKey: idempotency.current.key }),
      });
      if (!result.success || !result.conversationId) throw new Error(uiText("Ui.text_211a9d068eee5c"));
      setSuccess(result.duplicate ? uiText("Ui.text_077a2df292bb68") : uiText("Ui.text_01ac84511a0ee9"));
    } catch (cause) { setError(cause instanceof TypeError ? uiText("Ui.text_5f1c3988bd5b9a") : uiErrorMessage(cause, uiText("Ui.text_0949dcf4a5790d"))); }
    finally { submitting.current = false; setSending(false); }
  }

  return <>
    <button type="button" onClick={() => void openModal()} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gold/30 px-3 py-2 text-xs font-semibold text-gold hover:bg-gold/10">
      <MessageSquareText size={13} /> {label || t("sendSupport")}
    </button>
    {open && <dialog ref={dialog} aria-modal="true" aria-labelledby="support-compose-title" onCancel={event => { if (sending) event.preventDefault(); else setOpen(false); }} onClose={() => setOpen(false)}
      onMouseDown={event => { if (event.target === event.currentTarget && !sending) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setOpen(false); } }}
      style={visibleViewport ? { top: `max(${visibleViewport.top + 12}px, env(safe-area-inset-top, 0px))`, height: `min(52rem, calc(${Math.max(0, visibleViewport.height - 24)}px - env(safe-area-inset-bottom, 0px)))`, maxHeight: `calc(${Math.max(0, visibleViewport.height - 24)}px - env(safe-area-inset-bottom, 0px))` } as CSSProperties : undefined}
      className="fixed inset-x-0 bottom-auto top-3 z-[90] mx-auto my-0 flex h-[min(52rem,calc(100dvh_-_1.5rem))] max-h-[calc(100dvh_-_1.5rem)] w-[calc(100%_-_1.5rem)] max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-bg-primary p-0 text-text-primary shadow-2xl backdrop:bg-black/75">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4 sm:p-5"><div><h2 id="support-compose-title" className="font-display text-xl font-bold text-text-primary">{uiText("AdminAccounts.sendSupport")}</h2><p className="mt-1 text-xs text-text-muted">{uiText("Ui.text_366dc20a2fdca3")}</p></div><button ref={closeButton} type="button" onClick={() => setOpen(false)} disabled={sending} aria-label={uiText("Ui.text_5680f4c53e18e7")} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-bg-elevated"><X size={18} /></button></header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {success && <div role="status" aria-live="polite" className="rounded-xl border border-success/30 bg-success/10 p-4 sm:p-5"><div className="flex items-center gap-3 text-success"><Check size={24} /><h3 className="text-lg font-semibold">{success}</h3></div><p className="mt-2 text-sm text-text-primary">{uiText.rich("Ui.text_246eed792694d2", { value1: () => (target?.recipientName) })}</p><p className="mt-2 text-xs text-text-secondary">{uiText("Ui.text_7ad48fd5eabf65")}</p><p className="mt-4 whitespace-pre-wrap break-words border-t border-success/30 pt-4 text-sm leading-6 text-text-primary">{message}</p></div>}
          {!success && (loading ? <div className="flex items-center gap-2 py-10 text-sm text-text-muted">{uiText.rich("Ui.text_fa39bfe4f84d95", { part1: () => (<Loader2 className="animate-spin" size={17} />) })}</div> : target && <>
            <div className="rounded-xl border border-border bg-bg-secondary p-3 sm:p-4">
              <div className="flex items-center gap-3">{target.recipientAvatarUrl ? <UnoptimizedImage src={target.recipientAvatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-elevated text-text-muted"><Mail size={16} /></div>}<div className="min-w-0 flex-1"><p className="text-xs text-text-muted">{uiText("Ui.text_2f3ce594bc512d")}</p>{target.recipientProfileUrl ? <a href={target.recipientProfileUrl} target="_blank" rel="noreferrer" className="block truncate text-sm font-semibold text-text-primary hover:text-gold">{target.recipientName}</a> : <p className="text-sm font-semibold text-text-primary">{target.recipientName}</p>}</div></div>
              <p className="mt-3 border-t border-border pt-3 text-xs text-text-muted">{uiText.rich("Ui.text_f0f2a39096fe11", { value2: () => (target.targetLabel), part1: chunks => (<strong className="text-text-secondary">{chunks}</strong>), value3: () => (target.isDraft ? uiText("Ui.text_8d5242b1c066e0") : "") })}</p>
              {target.missingFields.length > 0 && <p className="mt-1 text-xs text-gold">{uiText.rich("Ui.text_0372d81496682a", { value1: () => (target.missingFields.join(", ")) })}</p>}
              {previous.length > 0 && <div className="mt-3 border-t border-border pt-3"><p className="text-xs font-semibold text-text-secondary">{uiText("Ui.text_66418095677005")}</p><ul className="mt-1 space-y-1">{previous.map((item) => <li key={item.id} className="text-xs text-text-muted">{new Date(item.updated_at).toLocaleString(uiLocale)} · {item.support_target_label}</li>)}</ul></div>}
            </div>
            <label className="block text-xs font-medium text-text-secondary">{uiText("Ui.text_0bf9222e2e56cd")}<select disabled={sending} value={templateKey} onChange={(event) => selectTemplate(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary">{templates.map((template) => <option key={template.template_key} value={template.template_key}>{template.label}</option>)}</select></label>
            {needsFields && !target.missingFields.length && <p role="status" className="rounded-lg border border-gold/30 bg-gold/10 p-3 text-xs text-gold">{uiText("Ui.text_d78924b721bdb1")}</p>}
            <label className="block text-xs font-medium text-text-secondary">{uiText.rich("Ui.text_4a6afa7600873f", { part1: () => (<textarea disabled={sending} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={5000} rows={7} className="mt-1.5 w-full resize-y rounded-lg border border-border bg-bg-secondary p-3 text-base leading-6 text-text-primary outline-none sm:text-sm focus:border-gold" />) })}</label>
            <div className="rounded-xl border border-border bg-bg-secondary p-3 sm:p-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{uiText("Ui.text_69337f6de91475")}</p><p className="whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">{message || uiText("Ui.text_b31d3079566d89")}</p><p className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-text-muted">{uiText.rich("Ui.text_f653aa584e98cd", { part1: () => (<UnoptimizedImage src={SUPPORT_AVATAR_URL} alt="" className="h-5 w-5 object-contain" />) })}</p></div>
            <p className="text-[11px] leading-5 text-text-muted">{uiText("Ui.text_2edbc220c87de7")}</p>
          </>)}
          {error && <p role="alert" className="rounded-lg border border-crimson/30 bg-crimson/10 p-3 text-sm text-crimson-light">{error}</p>}
        </div>
        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border p-4"><button type="button" onClick={() => setOpen(false)} disabled={sending} className="min-h-11 rounded-lg border border-border px-4 text-sm text-text-secondary">{success ? uiText("ProfilePhotoCrop.close") : uiText("home.boardCancel")}</button>{!success && <button type="button" onClick={() => void submit()} disabled={loading || sending || !selected || !message.trim() || unresolved || !linkOkay || (needsFields && !target?.missingFields.length)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-semibold text-bg-primary disabled:cursor-not-allowed disabled:opacity-50">{sending ? <>{uiText.rich("Ui.text_024c2384f4859f", { part1: () => (<Loader2 size={15} className="animate-spin" />) })}</> : <>{uiText.rich("Ui.text_1a058a4c47b61b", { part1: () => (<Send size={15} />) })}</>}</button>}</footer>
    </dialog>}
  </>;
}

