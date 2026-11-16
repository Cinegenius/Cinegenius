"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { NEW_COMPANY_URL } from "@/lib/company-navigation";

export default function CompanySwitcher({ companies, selectedId, onSelect }: {
  companies: Array<{ id: string; name: string; city: string | null }>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations();
  return <div className="flex min-w-0 flex-wrap items-center gap-3">
    {companies.length > 1 && <label className="flex min-h-11 w-full min-w-0 items-center gap-3 text-xs text-text-muted sm:w-auto sm:flex-1">
      <span className="shrink-0">{t("Ui.text_8caed0d961965e")}</span>
      <select value={selectedId} onChange={event => onSelect(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary">
        {companies.map(company => <option key={company.id} value={company.id}>{company.name}{company.city ? t("Ui.text_f6b53f9c8ab3ef", { value1: company.city }) : ""}</option>)}
      </select>
    </label>}
    <Link href={NEW_COMPANY_URL} className="inline-flex min-h-11 items-center text-sm text-gold hover:text-gold-light">{t("companies.addCompany")}</Link>
  </div>;
}
