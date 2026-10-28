import Link from "next/link";
import { useTranslations } from "next-intl";
import type { PublicResponsiblePerson } from "@/lib/responsible-person-server";
export default function ResponsiblePersonCard({ person }: { person: PublicResponsiblePerson | null | undefined }) {
  const t = useTranslations("responsiblePerson");
  if (!person) return null;
  return <div className="min-w-0 rounded-xl border border-border bg-bg-secondary p-4 text-sm">
    <p className="mb-1 text-xs text-text-muted">{t("contact")}</p>
    {person.href ? <Link href={person.href} className="break-words font-semibold text-text-primary hover:text-gold">{person.name}</Link> : <p className="break-words font-semibold text-text-primary">{person.name}</p>}
    {person.function && <p className="mt-1 break-words text-text-secondary">{person.function === "other" ? person.customFunction : t(`functions.${person.function}`)}</p>}
  </div>;
}
