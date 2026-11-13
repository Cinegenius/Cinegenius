"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import CompanyLogo from "@/components/CompanyLogo";
import { COMPANY_CATEGORIES } from "@/lib/companyCategories";
import { taxonomyLabel } from "@/lib/departments";

export type CompanyMembership = {
  id: string;
  title: string | null;
  public_titles: string[];
  is_company_owner: boolean;
  companies: { id: string; slug: string; name: string; logo_url: string | null; categories: string[] | null };
};
export type CompanyMemberships = CompanyMembership[] | null;

/** Receives only memberships already approved for the public personal profile. */
export default function ProfileCompanyLinks({ membership }: { membership: CompanyMemberships }) {
  const t = useTranslations();
  if (!membership?.length) return null;

  return <div className="min-w-0">
    <div className="mb-2.5 flex items-center gap-2">
      <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-gold" />
      <p className="text-[10px] font-bold uppercase tracking-widest text-gold">{t("footer.col3")}</p>
    </div>
    <div className="space-y-2.5">
      {membership.map(entry => {
        const company = entry.companies;
        const publicRole = entry.public_titles.join(" · ") || t(entry.is_company_owner ? "responsiblePerson.functions.owner" : "Ui.text_46a19d00aadaa0");
        const category = COMPANY_CATEGORIES.find(item => item.id === company.categories?.[0]);

        return <Link key={entry.id} href={`/companies/${encodeURIComponent(company.slug)}`} className="profile-company-link group flex min-h-24 min-w-0 items-start gap-3 rounded-xl border border-border/70 bg-bg-primary/40 p-3 transition-colors hover:border-gold/40 hover:bg-bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
          <CompanyLogo src={company.logo_url} name={company.name} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-bg-primary/60" />
          <div className="min-w-0 flex-1 space-y-1 text-left [overflow-wrap:anywhere]">
            <p className="break-words text-sm font-semibold leading-snug text-text-primary group-hover:text-gold">{company.name}</p>
            {category && <p className="text-[11px] leading-relaxed text-gold/80">{taxonomyLabel(category.label, t)}</p>}
            <p className="break-words text-xs leading-relaxed text-text-muted">{publicRole}</p>
            <span className="inline-flex max-w-full items-start gap-1 text-[10px] leading-relaxed text-gold/80">{t.rich("Ui.text_f797cb26e674d2", { part1: () => <ExternalLink aria-hidden="true" size={11} className="mt-0.5 shrink-0" /> })}</span>
          </div>
        </Link>;
      })}
    </div>
  </div>;
}
