"use client";
import { useTranslations } from "next-intl";
import type { StoredResponsiblePerson } from "@/lib/responsible-person";
export default function ResponsiblePersonAdmin({ person }: { person?: StoredResponsiblePerson | null }) {
  const t = useTranslations("responsiblePerson");
  return <div className="min-w-0 break-words text-xs text-text-muted">{person?.firstName && person?.lastName ? <><p>{t("title")}: {person.firstName} {person.lastName}{person.function ? ` · ${person.function === "other" ? person.customFunction : t(`functions.${person.function}`)}` : ""}</p><p className="break-all font-mono">{person.userId}</p></> : <p>{t("missing")}</p>}</div>;
}
