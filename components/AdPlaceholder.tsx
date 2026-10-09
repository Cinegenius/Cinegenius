"use client";

import Link from "next/link";
import { ArrowRight, Clapperboard, Megaphone } from "lucide-react";
import { useTranslations } from "next-intl";

export default function AdPlaceholder({ ctaHref = "/werben" }: { ctaHref?: string }) {
  const t = useTranslations("advertising");

  return (
    <aside aria-label={t("bannerAria")} className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 sm:py-6">
      <div className="relative isolate overflow-hidden rounded-2xl border border-gold/25 bg-bg-secondary">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_82%_50%,rgba(190,242,37,0.16),transparent_44%),linear-gradient(115deg,rgba(30,35,48,0.96),rgba(16,19,27,0.98))]" />
        <Clapperboard aria-hidden="true" className="pointer-events-none absolute -right-5 -top-8 h-40 w-40 rotate-12 text-gold/[0.07] sm:-right-2 sm:h-48 sm:w-48" />

        <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-7 sm:py-6">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gold">
              <Megaphone size={12} /> {t("bannerBadge")}
            </div>
            <h2 className="font-display text-xl font-bold leading-tight text-text-primary sm:text-2xl">
              {t("bannerTitle")}
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-text-secondary">
              {t("bannerText")}
            </p>
          </div>

          <Link
            href={ctaHref}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-bg-primary transition hover:bg-gold-light"
          >
            {t("bannerCta")} <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </aside>
  );
}
