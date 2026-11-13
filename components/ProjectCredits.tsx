"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Users } from "lucide-react";
import MediaImage from "@/components/MediaImage";
import { getDeptLabel, getDepartmentRoleLabel } from "@/lib/departments";
import { groupProjectCredits, resolveProjectCreditRole, splitProjectCreditRole } from "@/lib/project-credit-roles";

type DisplayCredit = {
  id: string;
  role: string;
  profile: { display_name: string; avatar_url: string | null; slug: string | null } | null;
  ghost?: { name: string; avatar_url: string | null; slug: string } | null;
};

export default function ProjectCredits({ credits }: { credits: DisplayCredit[] }) {
  const locale = useLocale();
  const t = useTranslations();
  const taxonomy = useTranslations("Taxonomy");
  const animals = useTranslations("FilmAnimals");
  if (!credits.length) return <div className="browse-card p-6 text-center text-text-muted">
    <Users size={28} className="mx-auto mb-3" aria-hidden="true" />
    <p>{t("Ui.text_a95fd3e3a2c975")}</p>
    <p className="mt-2 text-sm">{t("Ui.text_88cfb0708819b8")}</p>
  </div>;

  return <div className="space-y-4">
    <p className="text-sm leading-relaxed text-text-muted">{t("projects.creditsNotice")}</p>
    {groupProjectCredits(credits).map(({ department, members }) => <section key={department?.id ?? "unassigned"} className="browse-card overflow-hidden">
      <h2 className="flex min-h-12 items-center gap-3 border-b border-border bg-bg-elevated px-4 py-3 text-sm font-semibold text-text-primary">
        <span className="h-4 w-1 shrink-0 rounded-full bg-gold/70" aria-hidden="true" />
        <span className="min-w-0 flex-1">{department ? getDeptLabel(department, locale, animals, taxonomy) : t("projects.unassignedCredits")}</span>
        <span className="text-text-muted tabular-nums">{members.length.toLocaleString(locale)}</span>
      </h2>
      <ul className="divide-y divide-border">
        {members.map(credit => {
          const parsed = splitProjectCreditRole(credit.role);
          const match = resolveProjectCreditRole(credit.role);
          const role = match ? getDepartmentRoleLabel(match.department.id, match.role, locale, animals, taxonomy) : parsed.role;
          const name = credit.profile?.display_name ?? credit.ghost?.name ?? t("Ui.text_276ffa1fb4f970");
          const avatar = credit.profile?.avatar_url ?? credit.ghost?.avatar_url;
          const href = credit.profile?.slug ? `/profile/${credit.profile.slug}` : credit.ghost?.slug ? `/person/${credit.ghost.slug}` : null;
          const identity = <>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-elevated text-gold">
              {avatar ? <MediaImage src={avatar} width={40} height={40} alt="" className="h-full w-full object-cover" /> : name.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 break-words text-sm font-semibold text-text-primary">{name}</span>
          </>;
          return <li key={credit.id} className="grid min-w-0 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-4">
            {href ? <Link href={href} className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg hover:text-gold focus-visible:outline-2 focus-visible:outline-gold">{identity}</Link> : <div className="flex min-h-11 min-w-0 items-center gap-3">{identity}</div>}
            <div className="min-w-0 break-words pl-[52px] text-sm text-text-secondary sm:pl-0">
              <p>{role}{parsed.character && <> · {parsed.character}</>}</p>
              {parsed.note && <p className="mt-1 text-xs text-text-muted">{parsed.note}</p>}
            </div>
          </li>;
        })}
      </ul>
    </section>)}
  </div>;
}
