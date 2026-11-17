"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown } from "lucide-react";
import MediaImage from "@/components/MediaImage";
import { PROFILE_AVATARS, PROFILE_COVERS } from "@/lib/profile-art";

export default function ProfileArtPicker({ kind, value, onChange, disabled = false }: {
  kind: "avatar" | "cover";
  value: string;
  onChange: (src: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("ProfileArt");
  const [open, setOpen] = useState(false);
  const choice = (src: string, label: string, round: boolean) => <button
    key={src} type="button" disabled={disabled} aria-label={label} aria-pressed={value === src}
    onClick={() => onChange(src)}
    className={`relative min-h-11 min-w-11 overflow-hidden rounded-lg border-2 p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50 ${value === src ? "border-gold bg-gold/10" : "border-transparent hover:border-gold/40"}`}
  >
    <MediaImage src={src} alt="" width={round ? 160 : 320} height={round ? 160 : 128} unoptimized
      className={`block w-full ${round ? "aspect-square rounded-full" : "aspect-[5/2] rounded-md"}`} />
    {!round && <span className="mt-1 block break-words text-xs text-text-secondary">{label}</span>}
    {value === src && <span className="absolute right-1 top-1 rounded-full bg-gold p-0.5 text-bg-primary"><Check size={13} aria-hidden="true" /></span>}
  </button>;
  return <details data-no-draft className="mt-3 rounded-xl border border-border bg-bg-primary px-3" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="flex min-h-11 cursor-pointer list-none [&::-webkit-details-marker]:hidden items-center justify-between gap-2 text-sm text-text-primary">
      <span>{t(kind === "avatar" ? "chooseAvatar" : "chooseCover")}</span><ChevronDown size={16} aria-hidden="true" className={open ? "rotate-180" : ""} />
    </summary>
    {open && <div className="pb-3">
      <p className="mb-3 text-xs leading-5 text-text-muted">{t("hint")}</p>
      {kind === "avatar" ? (["masculine", "feminine", "neutral"] as const).map(presentation => <div key={presentation} role="group" aria-label={t(presentation)} className="mt-3">
        <p className="mb-1 text-xs text-text-muted">{t(presentation)}</p>
        <div className="grid grid-cols-4 gap-1">{PROFILE_AVATARS.filter(item => item.presentation === presentation).map(item => choice(item.src, t("avatarOption", { number: PROFILE_AVATARS.indexOf(item) + 1 }), true))}</div>
      </div>) : <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{PROFILE_COVERS.map(item => choice(item.src, t(`themes.${item.theme}`), false))}</div>}
    </div>}
  </details>;
}
