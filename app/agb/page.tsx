import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { legalTextLinks } from "@/components/LegalTextLinks";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { alternates: { canonical: "https://www.cinegenius.co/agb" }, title: t("m_ef0fe873bb68"), description: t("m_571a8f0d6386") };
}

export default async function LegalPage() {
  // Legal translations need separate review; keep one authoritative German original.
  const t = await getTranslations({ locale: "de", namespace: "LegalTerms" });
  const support = await getTranslations({ locale: "de", namespace: "SupportMediation" });
  return <div lang="de" className="pt-16 min-h-screen min-w-0 bg-bg-primary [overflow-wrap:anywhere]">
    <div className="max-w-2xl mx-auto px-4 py-16">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-3">{t("badge")}</p>
        <h1 className="font-display text-3xl font-bold text-text-primary mb-2">{t("title")}</h1>
        <p className="text-text-muted text-sm">{t("date")}</p>
      </div>
      <div className="space-y-8 text-text-secondary text-sm leading-relaxed">
          <section id="section-1">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s1.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s1.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s1.p2", legalTextLinks)}</p>
          </section>
          <section id="section-2">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s2.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s2.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s2.p2", legalTextLinks)}</p>
          </section>
          <section id="section-3">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s3.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s3.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s3.p2", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s3.p3", legalTextLinks)}</p>
          </section>
          <section id="section-4">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s4.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s4.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s4.p2", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s4.p3", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s4.p4", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s4.p5", legalTextLinks)}</p>
          </section>
          <section id="section-5">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s5.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s5.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s5.p2", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s5.p3", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s5.p4", legalTextLinks)}</p>
          </section>
          <section id="section-6">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s6.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s6.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s6.p2", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s6.p3", legalTextLinks)}</p>
          </section>
          <section id="section-7">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s7.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s7.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s7.p2", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s7.p3", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s7.p4", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s7.p5", legalTextLinks)}</p>
          </section>
          <section id="section-8">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s8.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s8.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s8.p2", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s8.p3", legalTextLinks)}</p>
          </section>
          <section id="section-9">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s9.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s9.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s9.p2", legalTextLinks)}</p>
          </section>
          <section id="section-10">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s10.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s10.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s10.p2", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s10.p3", legalTextLinks)}</p>
          </section>
          <section id="section-11">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s11.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s11.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s11.p2", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{support("mediation")}</p>
            <p className="text-sm leading-relaxed mt-3">{support("example")}</p>
            <p className="text-sm leading-relaxed mt-3">{support("additional")}</p>
            <p className="text-sm leading-relaxed mt-3">{support("agreement")}</p>
          </section>
          <section id="section-12">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s12.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s12.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s12.p2", legalTextLinks)}</p>
          </section>
          <section id="section-13">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s13.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s13.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s13.p2", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s13.p3", legalTextLinks)}</p>
          </section>
          <section id="section-14">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s14.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s14.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s14.p2", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s14.p3", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s14.p4", legalTextLinks)}</p>
          </section>
          <section id="section-15">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s15.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s15.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s15.p2", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s15.p3", legalTextLinks)}</p>
          </section>
          <section id="section-16">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s16.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s16.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s16.p2", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s16.p3", legalTextLinks)}</p>
          </section>
          <section id="section-17">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s17.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s17.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s17.p2", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s17.p3", legalTextLinks)}</p>
          </section>
          <section id="section-18">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s18.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s18.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s18.p2", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s18.p3", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s18.p4", legalTextLinks)}</p>
          </section>

      </div>
      <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-6">
        <Link href="/impressum" className="text-sm text-gold hover:underline">{t("imprint")}</Link>
        <Link href="/datenschutz" className="text-sm text-gold hover:underline">{t("privacy")}</Link>
        <Link href="/ki-transparenz" className="text-sm text-gold hover:underline">{t("ai")}</Link>
      </div>
    </div>
  </div>;
}
