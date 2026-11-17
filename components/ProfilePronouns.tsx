"use client";
import { useTranslations } from "next-intl";
import { publicPronouns } from "@/lib/profile-identity";
export default function ProfilePronouns({profile}: {profile: {pronouns?: string | null; show_pronouns?: boolean}}) {
  const t = useTranslations("ProfileIdentity");
  const value = publicPronouns(profile);
  return value ? <p className="mt-1 break-words text-sm text-text-muted" aria-label={t("display", {value})}>{value}</p> : null;
}
