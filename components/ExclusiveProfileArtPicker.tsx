"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, ImageOff } from "lucide-react";
import MediaImage from "@/components/MediaImage";

export type ExclusiveProfileArtOption = Readonly<{ artworkId: string; previewSrc: string }>;
export type SavedProfileArtChoice = Readonly<{ previewSrc: string; artworkId?: string }>;
export type ExclusiveProfileArtStatus = "ready" | "loading" | "error" | "empty" | "expired";

export type ExclusiveProfileArtPickerProps = {
  kind: "avatar" | "cover";
  /** Already validated ready options, ordered by the owner. At most 12 per window. */
  options: readonly ExclusiveProfileArtOption[];
  /** Actual saved photograph, legacy artwork or owned artwork; never inferred. */
  savedChoice?: SavedProfileArtChoice | null;
  /** Server-confirmed draft selection, NOT a saved/published profile change. */
  confirmedChoice?: ExclusiveProfileArtOption | null;
  /** The owner supplies and clears this while its bounded request is pending. */
  pendingArtworkId?: string | null;
  status: ExclusiveProfileArtStatus;
  disabled?: boolean;
  onSelect: (artworkId: string) => void;
  onRestoreSaved: () => void;
  onRetry: () => void;
};

/** A controlled view only: no identity, leases, timers, requests or persistence.
 * Opening/rerendering never calls the owner. The owner binds all props/results to
 * its current account/form, enforces deadlines and validates inventory/media.
 * Existing upload/removal actions remain in the surrounding profile form. */
export default function ExclusiveProfileArtPicker({
  kind, options, savedChoice, confirmedChoice, pendingArtworkId, status,
  disabled = false, onSelect, onRestoreSaved, onRetry,
}: ExclusiveProfileArtPickerProps) {
  const t = useTranslations("ExclusiveProfileArt");
  const id = useId();
  const [open, setOpen] = useState(false);
  const title = t(kind === "avatar" ? "chooseAvatar" : "chooseCover");
  const confirmed = status === "expired" ? null : confirmedChoice;
  const savedIsSelected = Boolean(savedChoice && (!confirmed || (savedChoice.artworkId && savedChoice.artworkId === confirmed.artworkId)));
  const pending = Boolean(pendingArtworkId);
  const choicesDisabled = disabled || pending || status === "loading" || status === "expired";
  const visibleOptions = options.slice(0, 12).filter(option => option.artworkId !== savedChoice?.artworkId);
  // A confirmed selection may have left the ready inventory; it must stay visible.
  const separateConfirmed = confirmed && !savedIsSelected && !visibleOptions.some(option => option.artworkId === confirmed.artworkId);
  const messageKey = pending ? "pending" : status === "loading" ? "loading" : status === "error" ? "error"
    : status === "expired" ? "expired" : status === "empty" || (!visibleOptions.length && !separateConfirmed) ? "empty"
      : confirmed ? "selectedHint" : null;
  const canRetry = !pending && (status === "error" || status === "expired" || status === "empty" || (!visibleOptions.length && !separateConfirmed && status !== "loading"));
  const choose = (artworkId: string) => { if (!choicesDisabled && confirmed?.artworkId !== artworkId) onSelect(artworkId); };

  const option = (item: ExclusiveProfileArtOption, label: string) => {
    const checked = confirmed?.artworkId === item.artworkId;
    const waiting = pendingArtworkId === item.artworkId;
    return <label key={item.artworkId} className={`relative flex min-h-11 min-w-0 cursor-pointer flex-col items-center gap-1 rounded-xl border p-2 text-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold ${checked ? "border-gold bg-gold/10" : "border-border bg-bg-secondary"} ${choicesDisabled ? "cursor-default opacity-70" : "hover:border-gold/50"}`}>
      <input type="radio" name={id} value={item.artworkId} checked={checked} disabled={choicesDisabled} onChange={() => choose(item.artworkId)} aria-label={label} aria-describedby={waiting ? `${id}-status` : undefined} className="sr-only" />
      <ProfileArtPreview key={item.previewSrc} src={item.previewSrc} kind={kind} unavailable={t("unavailable")} />
      <span className="block max-w-full break-words text-xs leading-5 text-text-secondary">{label}</span>
      {checked && <span className="absolute right-1 top-1 rounded-full bg-gold p-0.5 text-bg-primary"><Check size={13} aria-hidden="true" /></span>}
      {waiting && <span className="block max-w-full break-words text-xs leading-5 text-text-primary">{t("pending")}</span>}
    </label>;
  };

  return <details data-no-draft className="mt-3 min-w-0 rounded-xl border border-border bg-bg-primary px-3" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
      <span className="min-w-0 break-words">{title}</span><ChevronDown size={16} aria-hidden="true" className={`shrink-0 ${open ? "rotate-180" : ""}`} />
    </summary>
    {open && <fieldset disabled={disabled} aria-describedby={`${id}-help`} className="min-w-0 space-y-3 pb-3">
      <legend className="sr-only">{title}</legend>
      <p id={`${id}-help`} className="text-xs leading-5 text-text-muted">{t("help")}</p>
      {savedChoice && <label className={`flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-xl border p-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold ${savedIsSelected ? "border-gold bg-gold/10" : "border-border bg-bg-secondary"} ${disabled ? "cursor-default opacity-70" : ""}`}>
        <input type="radio" name={id} value="current" checked={savedIsSelected} disabled={disabled} onClick={() => { if (!disabled && savedIsSelected && (pending || status === "expired")) onRestoreSaved(); }} onChange={() => { if (!disabled && !savedIsSelected) onRestoreSaved(); }} className="h-4 w-4 shrink-0 accent-gold" />
        <span className="block w-14 shrink-0"><ProfileArtPreview key={savedChoice.previewSrc} src={savedChoice.previewSrc} kind={kind} unavailable={t("unavailable")} /></span>
        <span className="min-w-0 break-words text-sm text-text-primary">{t(savedIsSelected && !pending && status !== "expired" ? "saved" : "restore")}</span>
      </label>}
      {messageKey && <div className="space-y-2">
        <p id={`${id}-status`} role="status" aria-live="polite" aria-atomic="true" className="break-words text-sm leading-5 text-text-secondary">{t(messageKey)}</p>
        {(status === "error" || status === "empty" || status === "expired") && <p className="text-xs leading-5 text-text-muted">{t("optional")}</p>}
        {canRetry && <button type="button" disabled={disabled} onClick={() => { if (!disabled) onRetry(); }} className="min-h-11 rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50">{t("retry")}</button>}
      </div>}
      {(visibleOptions.length > 0 || separateConfirmed) && <div className="grid gap-2" style={{ gridTemplateColumns: kind === "avatar" ? "repeat(auto-fit, minmax(min(100%, 4.25rem), 1fr))" : "repeat(auto-fit, minmax(min(100%, 8rem), 1fr))" }}>
        {separateConfirmed && option(confirmed, t("selected"))}
        {visibleOptions.map((item, index) => option(item, t("option", { number: index + 1 })))}
      </div>}
    </fieldset>}
  </details>;
}

/** Keyed by source: an error/fallback never sticks to a later account's image. */
function ProfileArtPreview({ src, kind, unavailable }: { src: string; kind: "avatar" | "cover"; unavailable: string }) {
  const [failed, setFailed] = useState(false);
  return <span aria-hidden="true" className={`flex w-full items-center justify-center overflow-hidden bg-bg-primary ${kind === "avatar" ? "aspect-square max-w-20 rounded-full" : "aspect-[5/2] rounded-md"}`}>
    {failed ? <span className="flex min-w-0 flex-col items-center gap-1 p-1"><ImageOff size={18} /><span className="max-w-full break-words text-[10px] leading-tight text-text-muted">{unavailable}</span></span>
      : <MediaImage src={src} alt="" width={kind === "avatar" ? 160 : 320} height={kind === "avatar" ? 160 : 128} mediaSize="thumbnail" loading="lazy" decoding="async" onError={() => setFailed(true)} className={`block h-full w-full object-contain ${kind === "avatar" ? "rounded-full" : "rounded-md"}`} />}
  </span>;
}
