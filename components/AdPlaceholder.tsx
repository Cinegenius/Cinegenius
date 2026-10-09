"use client";

import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";
import { useTranslations } from "next-intl";

export default function AdPlaceholder({ ctaHref = "/werben" }: { ctaHref?: string }) {
  const t = useTranslations("advertising");

  return (
    <aside aria-label={t("bannerAria")} className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <Link
        href={ctaHref}
        aria-label={`${t("bannerBadge")}: ${t("bannerTitle")}`}
        className="group relative flex min-h-28 flex-col gap-4 overflow-hidden rounded-2xl border border-cyan-200/25 bg-[#10131d] p-4 shadow-[0_0_28px_rgba(34,211,238,0.12),0_0_48px_rgba(217,70,239,0.08)] transition hover:border-fuchsia-300/45 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5"
      >
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_8%_50%,rgba(34,211,238,0.18),transparent_38%),radial-gradient(ellipse_at_88%_50%,rgba(217,70,239,0.16),transparent_42%),radial-gradient(ellipse_at_50%_100%,rgba(190,242,37,0.1),transparent_55%)]" />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-lime-300" />

        <div className="relative flex min-w-0 items-center gap-3 sm:gap-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-200/30 bg-cyan-300/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.18)] sm:h-14 sm:w-14">
            <Megaphone aria-hidden="true" size={23} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-fuchsia-200">{t("bannerBadge")}</p>
            <h2 className="mt-1 font-display text-lg font-bold leading-tight text-white sm:text-xl">{t("bannerTitle")}</h2>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-200/80 sm:text-sm">{t("bannerText")}</p>
          </div>
        </div>

        <span className="relative inline-flex min-h-11 shrink-0 items-center justify-center gap-3 rounded-xl border border-lime-200/50 bg-gradient-to-r from-lime-300 to-lime-200 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_18px_rgba(190,242,37,0.24)] transition group-hover:brightness-110 sm:min-w-48">
          {t("bannerCta")}
          <ArrowRight aria-hidden="true" size={16} className="transition group-hover:translate-x-1" />
        </span>
      </Link>
    </aside>
  );
}
