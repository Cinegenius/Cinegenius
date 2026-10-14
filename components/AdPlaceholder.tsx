"use client";

import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";
import { useTranslations } from "next-intl";

export default function AdPlaceholder({ ctaHref = "/werben" }: { ctaHref?: string }) {
  const t = useTranslations("advertising");

  return (
    <aside aria-label={t("bannerAria")} className="site-container py-3 sm:py-4">
      <Link
        href={ctaHref}
        aria-label={`${t("bannerBadge")}: ${t("bannerTitle")}`}
        className="group relative flex min-h-20 flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-bg-secondary p-3 transition hover:border-gold/40 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-4"
      >
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_10%_50%,rgba(194,241,53,0.08),transparent_45%)]" />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

        <div className="relative flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold sm:h-12 sm:w-12">
            <Megaphone aria-hidden="true" size={23} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold">{t("bannerBadge")}</p>
            <h2 className="mt-0.5 font-display text-base font-bold leading-tight text-text-primary sm:text-lg">{t("bannerTitle")}</h2>
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-text-secondary sm:text-sm">{t("bannerText")}</p>
          </div>
        </div>

        <span className="relative inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-bg-primary transition group-hover:bg-gold-light sm:min-w-40">
          {t("bannerCta")}
          <ArrowRight aria-hidden="true" size={16} className="transition group-hover:translate-x-1" />
        </span>
      </Link>
    </aside>
  );
}
