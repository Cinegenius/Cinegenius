"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";
import { useTranslations } from "next-intl";

type Ad = {
  id: string;
  advertiser_name: string;
  headline: string;
  description: string;
  cta_label: string;
  destination_url: string;
  image_url: string;
};

export default function AdPlaceholder({ slotIndex = 0 }: { slotIndex?: 0 | 1 }) {
  const t = useTranslations("advertising");
  const [ads, setAds] = useState<Ad[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ads", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { ads: [] })
      .then((result: { ads?: Ad[] }) => {
        if (!cancelled && Array.isArray(result.ads)) setAds(result.ads);
      })
      .catch(() => {
        if (!cancelled) setAds([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (ads.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActiveIndex((index) => index + 1), 7000);
    return () => window.clearInterval(timer);
  }, [ads.length]);

  useEffect(() => {
    if (ads.length < 2 || activeIndex !== ads.length) return;
    const reset = window.setTimeout(() => {
      setTransitionEnabled(false);
      setActiveIndex(0);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => setTransitionEnabled(true)));
    }, 550);
    return () => window.clearTimeout(reset);
  }, [activeIndex, ads.length]);

  const slotAds = ads.length > 1
    ? [...ads.slice(slotIndex), ...ads.slice(0, slotIndex)]
    : slotIndex === 0 ? ads : [];
  const hasAds = slotAds.length > 0;
  const slides = hasAds ? [...slotAds, ...(slotAds.length > 1 ? [slotAds[0]] : [])] : [];
  const banner = (ad?: Ad) => (
    <div className="group relative flex min-h-[132px] overflow-hidden rounded-2xl border border-cyan-200/25 bg-[#10131d] shadow-[0_0_28px_rgba(34,211,238,0.12),0_0_48px_rgba(217,70,239,0.08)] transition hover:border-fuchsia-300/45 sm:min-h-[148px]">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_8%_50%,rgba(34,211,238,0.16),transparent_38%),radial-gradient(ellipse_at_88%_50%,rgba(217,70,239,0.14),transparent_42%),radial-gradient(ellipse_at_50%_100%,rgba(190,242,37,0.09),transparent_55%)]" />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-lime-300" />
      {ad?.image_url ? (
        // Uploaded campaign images use the same public storage bucket as listings.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ad.image_url} alt="" className="relative w-[27%] min-w-[88px] max-w-[240px] object-cover" />
      ) : (
        <div aria-hidden="true" className="relative flex w-[27%] min-w-[88px] max-w-[240px] items-center justify-center border-r border-white/10 bg-gradient-to-br from-cyan-300/15 via-fuchsia-400/10 to-lime-300/15 text-cyan-100">
          <Megaphone size={28} />
        </div>
      )}
      <div className="relative flex min-w-0 flex-1 flex-col justify-center gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-fuchsia-200">
            {ad ? `${t("adLabel")} · ${ad.advertiser_name}` : t("bannerBadge")}
          </p>
          <h2 className="mt-1 line-clamp-2 font-display text-base font-bold leading-tight text-white sm:text-xl">
            {ad?.headline ?? t("bannerTitle")}
          </h2>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-200/80 sm:text-sm">
            {ad?.description ?? t("bannerText")}
          </p>
        </div>
        <span className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-lime-200/50 bg-gradient-to-r from-lime-300 to-lime-200 px-4 py-2 text-xs font-bold text-slate-950 shadow-[0_0_18px_rgba(190,242,37,0.24)] transition group-hover:brightness-110 sm:min-w-44 sm:self-center sm:px-5 sm:text-sm">
          {ad?.cta_label ?? t("bannerCta")}
          <ArrowRight aria-hidden="true" size={15} className="transition group-hover:translate-x-1" />
        </span>
      </div>
    </div>
  );

  return (
    <aside aria-label={t("bannerAria")} className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      {hasAds ? (
        <div className="overflow-hidden rounded-2xl" aria-live="polite">
          <div
            className={`flex ${transitionEnabled ? "transition-transform duration-500 ease-out" : ""}`}
            style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          >
            {slides.map((ad, index) => (
              <a
                key={`${ad.id}-${index}`}
                href={ad.destination_url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                aria-label={`${ad.headline} — ${ad.cta_label}`}
                className="block min-w-full"
              >
                {banner(ad)}
              </a>
            ))}
          </div>
          {slotAds.length > 1 && (
            <p className="sr-only">{t("adRotationHint", { current: (activeIndex % slotAds.length) + 1, total: slotAds.length })}</p>
          )}
        </div>
      ) : (
        <Link href="/werben#anzeigenformular" aria-label={`${t("bannerBadge")}: ${t("bannerTitle")}`} className="block">
          {banner()}
        </Link>
      )}
    </aside>
  );
}
