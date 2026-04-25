import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle, Zap, Shield, Users, MapPin, Car, Package, Briefcase, Sparkles, ArrowRight,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Preise — CineGenius",
  description: "CineGenius ist kostenlos für alle. Keine versteckten Gebühren. Locations, Crew, Equipment und Jobs finden und inserieren.",
  openGraph: {
    title: "Preise & Konditionen — CineGenius",
    description: "Kostenlos mitmachen — keine versteckten Gebühren.",
  },
};

export default async function PricingPage() {
  const t = await getTranslations("pricing");

  const freeFeatures = [
    t("feature1"), t("feature2"), t("feature3"), t("feature4"), t("feature5"),
    t("feature6"), t("feature7"), t("feature8"), t("feature9"), t("feature10"),
  ];

  const categories = [
    { icon: MapPin,    name: t("catLocations") },
    { icon: Car,       name: t("catVehicles") },
    { icon: Package,   name: t("catProps") },
    { icon: Users,     name: t("catCrew") },
    { icon: Briefcase, name: t("catJobs") },
    { icon: Sparkles,  name: t("catCustomProps") },
  ];

  const faqs = [
    { q: t("faq1Q"), a: t("faq1A") },
    { q: t("faq2Q"), a: t("faq2A") },
    { q: t("faq3Q"), a: t("faq3A") },
    { q: t("faq4Q"), a: t("faq4A") },
    { q: t("faq5Q"), a: t("faq5A") },
  ];

  const pillars = [
    { icon: Zap,          title: t("pillar1Title"), desc: t("pillar1Desc"), color: "border-gold/30 bg-gold-subtle", iconColor: "text-gold", featured: false },
    { icon: CheckCircle,  title: t("pillar2Title"), desc: t("pillar2Desc"), color: "border-gold bg-gold-subtle shadow-lg", iconColor: "text-gold", featured: true },
    { icon: Shield,       title: t("pillar3Title"), desc: t("pillar3Desc"), color: "border-success/30 bg-success/5", iconColor: "text-success", featured: false },
  ];

  return (
    <div className="pt-20 min-h-screen">
      {/* Hero */}
      <div className="text-center py-20 px-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-success/30 bg-success/10 text-success text-xs font-semibold uppercase tracking-widest mb-6">
          <CheckCircle size={12} /> {t("heroBadge")}
        </div>
        <h1 className="font-display text-5xl sm:text-6xl font-bold text-text-primary mb-5 leading-tight">
          {t("heroTitle")}
          <br />
          <span className="text-gradient-gold">{t("heroTitleHighlight")}</span>
        </h1>
        <p className="text-text-secondary text-lg max-w-2xl mx-auto leading-relaxed mb-10">
          {t("heroSubtitle")}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/sign-up" className="px-8 py-3.5 bg-gold text-bg-primary font-semibold rounded-md hover:bg-gold-light transition-colors flex items-center justify-center gap-2">
            {t("heroCtaPrimary")} <ArrowRight size={16} />
          </Link>
          <Link href="/locations" className="px-8 py-3.5 border border-border text-text-primary font-semibold rounded-md hover:border-gold hover:text-gold transition-all flex items-center justify-center gap-2">
            {t("heroCtaSecondary")}
          </Link>
        </div>
      </div>

      {/* 3 Pillar */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pillars.map(({ icon: Icon, title, desc, color, iconColor, featured }) => (
            <div key={title} className={`relative p-7 rounded-2xl border ${color} flex flex-col items-center text-center`}>
              {featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-gold text-bg-primary text-xs font-bold rounded-full uppercase tracking-widest">
                    {t("pillar2Badge")}
                  </span>
                </div>
              )}
              <div className="w-12 h-12 rounded-xl bg-bg-elevated border border-border flex items-center justify-center mb-4">
                <Icon size={22} className={iconColor} />
              </div>
              <h3 className="font-display text-xl font-bold text-text-primary mb-2">{title}</h3>
              <p className="text-text-muted text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Free features */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="p-8 rounded-2xl border border-border bg-bg-secondary">
          <h2 className="font-display text-2xl font-bold text-text-primary mb-6 text-center">
            {t("featuresLabel")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {freeFeatures.map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle size={16} className="text-success shrink-0" />
                <span className="text-sm text-text-secondary">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* All categories */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-3">{t("categoriesLabel")}</p>
          <h2 className="font-display text-3xl font-bold text-text-primary mb-2">{t("categoriesTitle")}</h2>
          <p className="text-text-muted text-sm">{t("categoriesDesc")}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {categories.map(({ icon: Icon, name }) => (
            <div key={name} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-bg-secondary">
              <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                <Icon size={16} className="text-gold" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{name}</p>
                <p className="text-xs text-success font-semibold">{t("catFreeLabel")}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <h2 className="font-display text-2xl font-bold text-text-primary text-center mb-8">
          {t("faqsLabel")}
        </h2>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <div key={faq.q} className="p-5 rounded-xl border border-border bg-bg-secondary">
              <h3 className="font-semibold text-text-primary mb-2">{faq.q}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center p-8 rounded-2xl border border-gold/20 bg-gold-subtle">
          <h3 className="font-display text-2xl font-bold text-text-primary mb-3">
            {t("ctaTitle")}
          </h3>
          <p className="text-text-muted text-sm mb-6">
            {t("ctaDesc")}
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-gold text-bg-primary font-semibold rounded-md hover:bg-gold-light transition-colors"
          >
            {t("ctaPrimary")} <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
