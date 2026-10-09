"use client";

import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";
import { useTranslations } from "next-intl";

function Billboard({ side, href }: { side: "left" | "right"; href: string }) {
  const t = useTranslations("advertising");
  const position = side === "left"
    ? { left: "calc((100vw - 1280px) / 2 - 168px)" }
    : { right: "calc((100vw - 1280px) / 2 - 168px)" };

  return (
    <div
      className="pointer-events-auto absolute top-1/2 w-[clamp(120px,9vw,160px)] -translate-y-1/2"
      style={position}
    >
      <Link
        href={href}
        aria-label={`${t("bannerBadge")}: ${t("bannerTitle")}`}
        className="group relative flex min-h-[350px] flex-col overflow-hidden rounded-[22px] border border-white/20 bg-[#090b12] p-3 shadow-[0_0_32px_rgba(34,211,238,0.18),0_0_60px_rgba(217,70,239,0.13)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_0_36px_rgba(34,211,238,0.28),0_0_72px_rgba(217,70,239,0.2)] sm:p-4"
      >
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_10%,rgba(34,211,238,0.28),transparent_45%),radial-gradient(ellipse_at_85%_35%,rgba(217,70,239,0.24),transparent_46%),radial-gradient(ellipse_at_50%_95%,rgba(190,242,37,0.18),transparent_48%)]" />
        <div aria-hidden="true" className="absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,0.75)_0.7px,transparent_0.9px)] [background-size:7px_7px]" />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-lime-300" />

        <div className="relative flex h-full flex-1 flex-col">
          <div className="mb-6 flex items-center justify-between gap-1">
            <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-300/40 bg-fuchsia-400/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-fuchsia-100 shadow-[0_0_14px_rgba(217,70,239,0.22)]">
              <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-300" />
              {t("bannerBadge")}
            </span>
            <Megaphone aria-hidden="true" size={15} className="shrink-0 text-cyan-200 drop-shadow-[0_0_7px_rgba(34,211,238,0.8)]" />
          </div>

          <h2 className="font-display text-lg font-bold leading-tight text-white [text-shadow:0_0_14px_rgba(217,70,239,0.38)] sm:text-xl">
            {t("bannerTitle")}
          </h2>
          <p className="mt-3 line-clamp-5 text-xs leading-relaxed text-slate-200/85">
            {t("bannerText")}
          </p>

          <div aria-hidden="true" className="my-5 h-px bg-gradient-to-r from-cyan-300/70 via-fuchsia-300/50 to-transparent" />

          <span className="mt-auto inline-flex min-h-10 items-center justify-between gap-1 rounded-xl border border-lime-200/50 bg-gradient-to-r from-lime-300 to-lime-200 px-2.5 py-2 text-[11px] font-bold leading-tight text-slate-950 shadow-[0_0_18px_rgba(190,242,37,0.3)] transition group-hover:brightness-110 sm:px-3">
            <span>{t("bannerCta")}</span>
            <ArrowRight aria-hidden="true" size={13} className="shrink-0" />
          </span>
        </div>
      </Link>
    </div>
  );
}

export default function AdPlaceholder({
  ctaHref = "/werben",
  mode = "inline",
}: {
  ctaHref?: string;
  mode?: "side" | "inline";
}) {
  const t = useTranslations("advertising");

  return (
    <>
      {mode === "side" && (
        /* Vertical digital billboards sit in the outside gutters on wide screens. */
        <aside aria-label={t("bannerAria")} className="pointer-events-none fixed inset-0 z-30 hidden min-[1700px]:block">
          <Billboard side="left" href={ctaHref} />
          <Billboard side="right" href={ctaHref} />
        </aside>
      )}

      {/* Smaller screens keep one compact, in-flow version so the content stays unobstructed. */}
      <aside aria-label={t("bannerAria")} className={`mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8 ${mode === "side" ? "min-[1700px]:hidden" : ""}`}>
        <Link
          href={ctaHref}
          className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-cyan-200/25 bg-[#10131d] p-4 shadow-[0_0_24px_rgba(34,211,238,0.1)] transition hover:border-fuchsia-300/45 sm:px-6"
        >
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_12%_40%,rgba(34,211,238,0.17),transparent_42%),radial-gradient(ellipse_at_88%_50%,rgba(217,70,239,0.15),transparent_45%)]" />
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-200/30 bg-cyan-300/10 text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.18)]">
            <Megaphone size={19} />
          </div>
          <div className="relative min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-fuchsia-200">{t("bannerBadge")}</p>
            <h2 className="mt-0.5 truncate font-display text-base font-bold text-white sm:text-lg">{t("bannerTitle")}</h2>
            <p className="mt-1 hidden text-sm text-text-secondary sm:block">{t("bannerText")}</p>
          </div>
          <ArrowRight aria-hidden="true" size={19} className="relative shrink-0 text-lime-300 transition group-hover:translate-x-1" />
        </Link>
      </aside>
    </>
  );
}
