import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { legalTextLinks } from "@/components/LegalTextLinks";
import AnalyticsSettingsButton from "@/components/AnalyticsSettingsButton";
export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { alternates: { canonical: "https://www.cinegenius.co/datenschutz" }, title: t("m_a1235efbc18d"), description: t("m_e31d1ae1dff3") };
}

export default async function LegalPage() {
  // Legal translations need separate review; keep one authoritative German original.
  const t = await getTranslations({ locale: "de", namespace: "LegalPrivacy" });

  return <div lang="de" className="pt-16 min-h-screen min-w-0 bg-bg-primary [overflow-wrap:anywhere]">
    <div className="max-w-2xl mx-auto px-4 py-16">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-3">{t("badge")}</p>
        <h1 className="font-display text-3xl font-bold text-text-primary mb-2">{t("title")}</h1>
        <p className="text-text-muted text-sm">{t("date")}</p>
      </div>
      <div className="space-y-10 text-text-secondary text-sm leading-relaxed">
          <section id="section-1">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s1.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s1.p1", legalTextLinks)}</p>
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
          </section>
          <section id="section-4">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s4.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s4.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s4.p2", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s4.p3", legalTextLinks)}</p>
          </section>
          <section id="section-5">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s5.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s5.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s5.p2", legalTextLinks)}</p>
          </section>
          <section id="section-6">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s6.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s6.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s6.p2", legalTextLinks)}</p>
          </section>
          <section id="section-7">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s7.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s7.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s7.p2", legalTextLinks)}</p>
          </section>
          <section id="section-8">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s8.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s8.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s8.p2", legalTextLinks)}</p>
          </section>
          <section id="section-9">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s9.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s9.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s9.p2", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s9.p3", legalTextLinks)}</p>
          </section>
          <section id="section-10">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s10.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s10.p1", legalTextLinks)}</p>
          </section>
          <section id="section-11">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s11.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s11.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s11.p2", legalTextLinks)}</p>
          </section>
          <section id="section-12">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s12.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s12.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s12.p2", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s12.p3", legalTextLinks)}</p>
          </section>
          <section id="section-13">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s13.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s13.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s13.p2", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s13.p3", legalTextLinks)}</p>
            <AnalyticsSettingsButton />
          </section>
          <section id="section-14">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s14.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s14.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s14.p2", legalTextLinks)}</p>
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
          </section>
          <section id="section-19">
            <h2 className="text-base font-semibold text-text-primary mb-2">{t("s19.title")}</h2>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s19.p1", legalTextLinks)}</p>
            <p className="text-sm leading-relaxed mt-3">{t.rich("s19.p2", legalTextLinks)}</p>
          </section>
        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">{t("providerTitle")}</h2>
          <div className="overflow-x-auto"><table className="w-full text-xs border-collapse">
            <thead><tr className="border-b border-border"><th className="text-left py-2 pr-4">{t("provider")}</th><th className="text-left py-2">{t("purpose")}</th></tr></thead>
            <tbody className="divide-y divide-border">
              <tr><td className="py-2 pr-4"><a href="https://clerk.com/privacy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{t("providers.clerk.name")}</a></td><td className="py-2">{t("providers.clerk.purpose")}</td></tr>
              <tr><td className="py-2 pr-4"><a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{t("providers.supabase.name")}</a></td><td className="py-2">{t("providers.supabase.purpose")}</td></tr>
              <tr><td className="py-2 pr-4"><a href="https://vercel.com/legal/privacy-notice" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{t("providers.vercel.name")}</a></td><td className="py-2">{t("providers.vercel.purpose")}</td></tr>
              <tr><td className="py-2 pr-4"><a href="https://resend.com/privacy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{t("providers.resend.name")}</a></td><td className="py-2">{t("providers.resend.purpose")}</td></tr>
              <tr><td className="py-2 pr-4"><a href="https://posthog.com/privacy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{t("providers.posthog.name")}</a></td><td className="py-2">{t("providers.posthog.purpose")}</td></tr>
              <tr><td className="py-2 pr-4"><a href="https://openai.com/policies/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{t("providers.openai.name")}</a></td><td className="py-2">{t("providers.openai.purpose")}</td></tr>
              <tr><td className="py-2 pr-4"><a href="https://openfreemap.org/privacy/" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{t("providers.openfreemap.name")}</a></td><td className="py-2">{t("providers.openfreemap.purpose")}</td></tr>
              <tr><td className="py-2 pr-4"><a href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{t("providers.osm.name")}</a></td><td className="py-2">{t("providers.osm.purpose")}</td></tr>
              <tr><td className="py-2 pr-4"><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{t("providers.google.name")}</a></td><td className="py-2">{t("providers.google.purpose")}</td></tr>
              <tr><td className="py-2 pr-4"><a href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{t("providers.microsoft.name")}</a></td><td className="py-2">{t("providers.microsoft.purpose")}</td></tr>
            </tbody>
          </table></div>
        </section>
      </div>
      <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-6">
        <Link href="/impressum" className="text-sm text-gold hover:underline">{t("imprint")}</Link>
        <Link href="/agb" className="text-sm text-gold hover:underline">{t("terms")}</Link>
        <Link href="/ki-transparenz" className="text-sm text-gold hover:underline">{t("ai")}</Link>
      </div>
    </div>
  </div>;
}
