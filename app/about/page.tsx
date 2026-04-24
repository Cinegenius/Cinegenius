import type { Metadata } from "next";
import Link from "next/link";
import { Film, Users, Zap, Star, ArrowRight, CheckCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Über uns — CineGenius",
  description: "CineGenius ist der All-in-One-Marktplatz für Film, Social Media & Fotografie in Deutschland, Österreich und der Schweiz. Locations, Crew, Equipment und Jobs — alles an einem Ort.",
  openGraph: {
    title: "Über CineGenius",
    description: "Der Marktplatz für Film, Social Media & Fotografie im DACH-Raum.",
  },
};

export default async function AboutPage() {
  const t = await getTranslations("about");

  const values = [
    { icon: Film,  title: t("value1Title"), description: t("value1Desc") },
    { icon: Users, title: t("value2Title"), description: t("value2Desc") },
    { icon: Zap,   title: t("value3Title"), description: t("value3Desc") },
    { icon: Star,  title: t("value4Title"), description: t("value4Desc") },
  ];

  const missionPoints = [
    t("missionPoint1"),
    t("missionPoint2"),
    t("missionPoint3"),
    t("missionPoint4"),
  ];

  return (
    <div className="pt-16 min-h-screen">

      {/* ── HERO ── */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gold/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gold/10 border border-gold/20 rounded-full text-gold text-xs font-medium mb-6">
            <Film size={12} /> {t("heroBadge")}
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-bold text-text-primary mb-6 leading-tight">
            {t("heroTitle")}<br />
            <span className="text-gradient-gold">{t("heroTitleHighlight")}</span>
          </h1>
          <p className="text-text-secondary text-lg leading-relaxed max-w-2xl mx-auto mb-10">
            {t("heroSubtitle")}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/locations" className="px-6 py-3 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center gap-2">
              {t("heroCtaPrimary")} <ArrowRight size={15} />
            </Link>
            <Link href="/sign-up" className="px-6 py-3 border border-border text-text-secondary hover:border-gold hover:text-gold rounded-lg transition-colors font-medium">
              {t("heroCtaSecondary")}
            </Link>
          </div>
        </div>
      </section>

      {/* ── MISSION ── */}
      <section className="py-20 px-4 bg-bg-secondary border-y border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-6">
            {t("missionLabel")}
          </h2>
          <div className="space-y-4 text-text-secondary leading-relaxed text-left">
            <p>{t("missionP1")}</p>
            <p>{t("missionP2")}</p>
            <p>{t("missionP3")}</p>
          </div>
          <div className="mt-8 space-y-3 text-left">
            {missionPoints.map((point) => (
              <div key={point} className="flex items-start gap-2.5 text-sm text-text-secondary">
                <CheckCircle size={15} className="text-gold mt-0.5 shrink-0" />
                {point}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VALUES ── */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-3">
              {t("valuesLabel")}
            </h2>
            <p className="text-text-muted max-w-xl mx-auto">
              {t("valuesSubtitle")}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map(({ icon: Icon, title, description }) => (
              <div key={title} className="p-6 bg-bg-secondary border border-border rounded-xl hover:border-gold/30 transition-colors">
                <div className="w-10 h-10 bg-gold/10 border border-gold/20 rounded-lg flex items-center justify-center mb-4">
                  <Icon size={18} className="text-gold" />
                </div>
                <h3 className="font-semibold text-text-primary mb-2">{title}</h3>
                <p className="text-text-muted text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-4 bg-bg-secondary border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-4xl font-bold text-text-primary mb-4">
            {t("ctaTitle")}
          </h2>
          <p className="text-text-muted mb-8 text-lg">
            {t("ctaDesc")}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/sign-up"
              className="px-8 py-3.5 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center gap-2"
            >
              {t("ctaPrimary")} <ArrowRight size={15} />
            </Link>
            <Link
              href="/locations"
              className="px-8 py-3.5 border border-border text-text-secondary hover:border-gold hover:text-gold rounded-lg transition-colors font-medium"
            >
              {t("ctaSecondary")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
