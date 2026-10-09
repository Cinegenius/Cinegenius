import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Megaphone, MonitorPlay } from "lucide-react";
import { getTranslations } from "next-intl/server";
import AdCampaignForm from "@/components/AdCampaignForm";

export const metadata: Metadata = {
  title: "Werbung selbst schalten — CineGenius",
  description: "Erstelle deinen horizontalen Werbebanner auf CineGenius selbst. Aktuell kostenlos für 30 Tage.",
};

export default async function AdvertisingPage() {
  const t = await getTranslations("advertising");

  return (
    <main className="min-h-screen pt-16">
      <section className="relative isolate overflow-hidden border-b border-border bg-bg-primary">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(190,242,37,0.12),transparent_46%),radial-gradient(ellipse_at_bottom_left,rgba(45,212,191,0.08),transparent_42%)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            <Megaphone size={15} /> {t("eyebrow")}
          </p>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight text-text-primary sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
            {t("intro")}
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="#anzeigenformular" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-6 py-3 font-semibold text-bg-primary transition hover:bg-gold-light">
              {t("ctaButton")} <ArrowRight size={17} />
            </Link>
            <Link href="/companies" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-bg-secondary/70 px-6 py-3 font-semibold text-text-primary transition hover:border-gold/50">
              {t("companiesLink")}
            </Link>
          </div>
          <p className="mt-4 text-xs text-text-muted">{t("pricingNote")}</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-9 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-5 max-w-2xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{t("slotsEyebrow")}</p>
          <h2 className="font-display text-2xl font-bold text-text-primary sm:text-3xl">{t("slotsTitle")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">{t("slotsText")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[t("slot1"), t("slot2")].map((slot, index) => (
            <article key={slot} className="flex items-center gap-4 rounded-2xl border border-border bg-bg-secondary p-4 sm:p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-sm font-bold text-gold">0{index + 1}</span>
              <p className="text-sm font-semibold text-text-primary">{slot}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 pb-10 sm:px-6 lg:px-8">
        <AdCampaignForm />
      </div>

      <section className="mx-auto max-w-5xl px-4 pb-14 sm:px-6 sm:pb-16 lg:px-8">
        <div className="rounded-2xl border border-border bg-bg-secondary p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <MonitorPlay size={19} className="mt-1 shrink-0 text-gold" />
            <div>
              <h2 className="font-display text-xl font-bold text-text-primary">{t("processTitle")}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-muted">{t("processText")}</p>
            </div>
          </div>
          <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-text-muted">{t("disclosure")}</p>
        </div>
      </section>
    </main>
  );
}
