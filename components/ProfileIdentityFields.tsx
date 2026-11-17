"use client";
import { useTranslations } from "next-intl";

export default function ProfileIdentityFields({value, visible, onChange}: {value: string; visible: boolean; onChange: (value: string, visible: boolean) => void}) {
  const t = useTranslations("ProfileIdentity");
  const examples = [...new Set([t("examples.masculine"), t("examples.feminine"), t("examples.neutral")])];
  return <fieldset className="rounded-xl border border-border bg-bg-secondary p-4 sm:p-6">
    <legend className="px-1 text-sm font-semibold">{t("pronouns")}</legend>
    <p className="mb-3 text-xs text-text-muted">{t("hint")}</p>
    <label htmlFor="profile-pronoun-value" className="sr-only">{t("pronouns")}</label>
    <input id="profile-pronoun-value" list="profile-pronoun-options" maxLength={60} value={value} onChange={event => onChange(event.target.value, visible)} placeholder={t("none")} className="min-h-11 w-full rounded-lg border border-border bg-bg-elevated px-3 text-sm" />
    <datalist id="profile-pronoun-options">{examples.map(item => <option key={item} value={item} />)}</datalist>
    <p className="mt-2 text-xs text-text-muted">{t("custom")}</p>
    <label className="mt-3 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={visible} onChange={event => onChange(value, event.target.checked)} className="h-5 w-5 accent-gold" />{t("show")}</label>
    {value && <button type="button" onClick={() => onChange("", false)} className="min-h-11 text-sm text-text-muted hover:text-gold">{t("clear")}</button>}
  </fieldset>;
}
