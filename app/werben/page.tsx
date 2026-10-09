import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Clapperboard, MapPin, Megaphone, MonitorPlay } from "lucide-react";
import { getTranslations } from "next-intl/server";
import AdPlaceholder from "@/components/AdPlaceholder";

export const metadata: Metadata = {
  title: "Werben auf CineGenius",
  description: "Erreiche Filmschaffende, Kreative und Produktionsfirmen mit einer passenden Werbeplatzierung auf CineGenius.",
};

export default async function AdvertisingPage() {
  const t = await getTranslations("advertising");
  const subject = encodeURIComponent(t("emailSubject"));
  const body = encodeURIComponent(t("emailBody"));
  const contactHref = `mailto:support@cinegenius.co?subject=${subject}&body=${body}`;
  const placements = [
    { icon: Megaphone, title: t("placement1Title"), text: t("placement1Text") },
    { icon: Clapperboard, title: t("placement2Title"), text: t("placement2Text") },
    { icon: MapPin, title: t("placement3Title"), text: t("placement3Text") },
  ];

  return (
    <main className="min-h-screen pt-16">
      <section className="relative isolate overflow-hidden border-b border-border bg-bg-primary">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(190,242,37,0.12),transparent_46%),radial-gradient(ellipse_at_bottom_left,rgba(45,212,191,0.08),transparent_42%)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            <Megaphone size={15} /> {t("eyebrow")}
          </p>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight text-text-primary sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
            {t("intro")}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={contactHref}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-6 py-3 font-semibold text-bg-primary transition hover:bg-gold-light"
            >
              {t("ctaButton")} <ArrowRight size={17} />
            </a>
            <Link
              href="/companies"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-bg-secondary/70 px-6 py-3 font-semibold text-text-primary transition hover:border-gold/50"
            >
              {t("companiesLink")}
            </Link>
          </div>
          <p className="mt-4 text-xs text-text-muted">{t("pricingNote")}</p>
        </div>
      </section>

      <section className="pt-7 sm:pt-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{t("previewEyebrow")}</p>
          <h2 className="font-display text-xl font-bold text-text-primary sm:text-2xl">{t("previewTitle")}</h2>
        </div>
        <AdPlaceholder mode="side" ctaHref={contactHref} />
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mb-7 max-w-2xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{t("placementsEyebrow")}</p>
          <h2 className="font-display text-2xl font-bold text-text-primary sm:text-3xl">{t("placementsTitle")}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {placements.map((placement) => {
            const Icon = placement.icon;
            return (
              <article key={placement.title} className="rounded-2xl border border-border bg-bg-secondary p-5 sm:p-6">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold">
                  <Icon size={20} />
                </div>
                <h3 className="mb-2 font-semibold text-text-primary">{placement.title}</h3>
                <p className="text-sm leading-relaxed text-text-muted">{placement.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 rounded-2xl border border-border bg-bg-secondary p-6 sm:p-8 md:grid-cols-[1fr_0.9fr] md:items-center">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">{t("processEyebrow")}</p>
            <h2 className="font-display text-2xl font-bold text-text-primary">{t("processTitle")}</h2>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">{t("processText")}</p>
          </div>
          <ul className="space-y-3">
            {[t("step1"), t("step2"), t("step3")].map((step) => (
              <li key={step} className="flex items-start gap-3 text-sm text-text-secondary">
                <BadgeCheck size={17} className="mt-0.5 shrink-0 text-gold" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mx-auto mt-5 flex max-w-2xl items-start justify-center gap-2 text-center text-xs leading-relaxed text-text-muted">
          <MonitorPlay size={15} className="mt-0.5 shrink-0" /> {t("disclosure")}
        </p>
        <div className="mt-8 text-center">
          <a
            href={contactHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-gold transition hover:text-gold-light"
          >
            {t("ctaSecondary")} <ArrowRight size={15} />
          </a>
        </div>
      </section>
    </main>
  );
}
