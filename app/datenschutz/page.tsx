import {getTranslations} from "next-intl/server";
import Link from "next/link";
import AnalyticsSettingsButton from "@/components/AnalyticsSettingsButton";
import type { Metadata } from "next";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/datenschutz" },
  title: tMetadata('m_a1235efbc18d'),
  description: tMetadata('m_e31d1ae1dff3'),
};
}

export default async function DatenschutzPage() {
  const uiText = await getTranslations();
  const uiOptionLabels: Record<string, string> = {
    "Clerk": uiText("Ui.text_dd192288ced6e9"),
    "Supabase": uiText("Ui.text_fe7ceb7816ed0e"),
    "Vercel": uiText("Ui.text_68edc75c015e2e"),
    "Stripe": uiText("Ui.text_961a6062ba1ba2"),
    "Sentry": uiText("Ui.text_5ece526b2e72c2"),
    "Resend": uiText("Ui.text_1f94843777aed8"),
    "Vercel Analytics": uiText("Ui.text_3f1ff89269fcea"),
    "Vercel Speed Insights": uiText("Ui.text_52862c368ba698"),
    "OpenStreetMap Nominatim": uiText("Ui.text_8cef47f31aa306"),
    "Authentifizierung / Login": uiText("Ui.text_a5373ffc8409d2"),
    "Datenbank & Dateispeicher": uiText("Ui.text_1cbf6f1bafcd28"),
    "Hosting & CDN": uiText("Ui.text_da77aba39cd821"),
    "Zahlungsabwicklung": uiText("Ui.text_6f48fbdba30ab1"),
    "E-Mail-Versand": uiText("Ui.text_aede0443695428"),
    "Nutzungsstatistiken (cookielos)": uiText("Ui.text_7872cd1b8aa7c3"),
    "Performance-Messung (cookielos)": uiText("Ui.text_888d385c2be74b"),
    "Geocoding von Städtenamen": uiText("Ui.text_9e98ad5683d751"),
    "USA": uiText("Ui.text_aa5ab35a9174c2"),
    "EU (Frankfurt)": uiText("Ui.text_fc3782bd2fd753"),
    "UK / EU": uiText("Ui.text_bbe3aca285ed92"),
    "Profildaten, Inserate und Entwürfe": uiText("Ui.text_6d1e40c0f7a667"),
    "Nachrichten und Supportvorgänge": uiText("Ui.text_2e19e231bca837"),
    "Profilaufrufe, Foto-Likes und Präsenzdaten": uiText("Ui.text_b7b179c958ba80"),
    "Hosting-, Fehler- und E-Mail-Protokolle": uiText("Ui.text_e86a5d6f175ed5"),
    "Vertrags- und Abrechnungsunterlagen": uiText("Ui.text_54643357de0295"),
    "Für die Bereitstellung des Kontos und der gespeicherten Inhalte; Löschanfragen können über die Kontoeinstellungen oder den Support gestellt werden": uiText("Ui.text_b72f03e8ce9080"),
    "Für die Kommunikation und erforderliche Bearbeitung; lokales Ausblenden einer Nachricht löscht nicht automatisch die Empfängerkopie": uiText("Ui.text_f44a4b40ae3a40"),
    "Nur soweit für die jeweiligen Funktionen und erforderlichen Nachweise benötigt": uiText("Ui.text_7301cd37c3fd00"),
    "Nach der tatsächlichen Dienstkonfiguration und dem erforderlichen Betriebszweck": uiText("Ui.text_2235d05ee2c319"),
    "Soweit vorhanden und gesetzlich vorgeschrieben, für die jeweils anwendbare Aufbewahrungsfrist": uiText("Ui.text_d160bfb031e885"),
  };




  const t = await getTranslations("LegalAuditOriginal");
  return (
    <div className="pt-16 min-h-screen min-w-0 bg-bg-primary [overflow-wrap:anywhere]">
      <div className="max-w-2xl mx-auto px-4 py-16">

        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-3">{uiText("Ui.text_0da5374b4c42ae")}</p>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">{uiText("cookie.link")}</h1>
          <p className="text-text-muted text-sm">{t("privacyDate")}</p>
        </div>

        <div className="space-y-10 text-text-secondary text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_ebb2bcce0d2b33")}</h2>
            <p>{uiText.rich("Ui.text_6c75d83671505b", { part1: () => (<br />), part2: () => (<br />), part3: chunks => (<a href="mailto:cinegenius.co@gmail.com" className="text-gold hover:underline">{chunks}</a>), part4: () => (<br />), part5: chunks => (<a href="tel:+491713866624" className="text-gold hover:underline">{chunks}</a>) })}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_5a32db135f8479")}</h2>
            <p className="mb-3">{uiText("Ui.text_f6618e1359baa7")}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-text-primary font-semibold">{uiText("Ui.text_ecc4f77cf21313")}</th>
                    <th className="text-left py-2 pr-4 text-text-primary font-semibold">{uiText("Ui.text_5c123d4febae37")}</th>
                    <th className="text-left py-2 text-text-primary font-semibold">{uiText("Ui.text_48652c16f7639c")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Clerk", "Authentifizierung / Login", "USA"],
                    ["Supabase", "Datenbank & Dateispeicher", "EU (Frankfurt)"],
                    ["Vercel", "Hosting & CDN", "USA"],
                    ["Stripe", "Zahlungsabwicklung", "USA"],
                    ["Sentry", t("sentryPurpose"), "USA"],
                    ["Resend", "E-Mail-Versand", "USA"],
                    ["Vercel Analytics", "Nutzungsstatistiken (cookielos)", "USA"],
                    ["Vercel Speed Insights", "Performance-Messung (cookielos)", "USA"],
                    ["OpenStreetMap Nominatim", "Geocoding von Städtenamen", "UK / EU"],
                    ["OpenFreeMap", uiText("directoryMap.providerPurpose"), uiText("directoryMap.providerRegion")],
                  ].map(([d, z, s]) => (
                    <tr key={d}>
                      <td className="py-2 pr-4 font-medium text-text-primary">{(uiOptionLabels[d] ?? d)}</td>
                      <td className="py-2 pr-4">{(uiOptionLabels[z] ?? z)}</td>
                      <td className="py-2">{(uiOptionLabels[s] ?? s)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-text-muted text-xs">{uiText.rich("directoryMap.providerNotice", { provider: chunks => <a href="https://openfreemap.org/privacy/" target="_blank" rel="noopener noreferrer" className="underline">{chunks}</a> })}</p>
            <p className="mt-3 text-text-muted text-xs">{uiText("Ui.text_f0d2ffad706599")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_fa04380c470bab")}</h2>
            <p>{uiText.rich("Ui.text_0ecf904775ac39", { part1: chunks => (<strong className="text-text-primary">{chunks}</strong>) })}</p>
            <p className="mt-2">{uiText.rich("Ui.text_d495c49dd5837a", { part1: () => (<br />), part2: chunks => (<a href="https://clerk.com/privacy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{chunks}</a>) })}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_611ed3fea6bc0b")}</h2>
            <p>{uiText.rich("Ui.text_0977c086c9faae", { part1: chunks => (<strong className="text-text-primary">{chunks}</strong>) })}</p>
            <p className="mt-2">{uiText.rich("Ui.text_3fb2cb0d3f1da2", { part1: chunks => (<a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{chunks}</a>) })}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_7e7d30e65a87d8")}</h2>
            <p>{uiText("Ui.text_c6f3386a6e0579")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_4b64aeaa56a72b")}</h2>
            <p>{uiText("Ui.text_9ab536f2317d7e")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_2c8eaa209e9a87")}</h2>
            <p>{uiText("Ui.text_a6b7d5bcf43c72")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_13e13e4c86a9ac")}</h2>
            <p>{uiText("Ui.text_f36dfccc3e4bc6")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_2d81e07ce7f7f9")}</h2>
            <p>{uiText("Ui.text_ac80679995e973")}</p>
            <p className="mt-2">{uiText("Ui.text_ead49c8e2ee161")}</p>
            <p className="mt-2">{uiText("Ui.text_c0370dcbb5d3e0")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_f9a9bed03c18b2")}</h2>
            <p>{uiText.rich("Ui.text_3d21c2d6becf05", { part1: chunks => (<strong className="text-text-primary">{chunks}</strong>), part2: () => (<br />), part3: chunks => (<a href="https://stripe.com/de/privacy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{chunks}</a>) })}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_e8909434900434")}</h2>
            <p>{uiText.rich("Ui.text_e671b124557fc3", { part1: chunks => (<strong className="text-text-primary">{chunks}</strong>), part2: () => (<br />), part3: chunks => (<a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{chunks}</a>) })}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_65de63aa494e84")}</h2>
            <p>
              {t("sentryPrepared")}
            </p>
            <p className="mt-2">{uiText.rich("Ui.text_9ea859209bd02b", { value1: () => (t("replayDisabled")), part2: () => (<br />), part3: chunks => (<a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{chunks}</a>) })}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_e966e1c8944555")}</h2>
            <p>{uiText.rich("Ui.text_2f87ba40e8a08c", { value1: () => (t("resendDisclosure")), part2: () => (<br />), part3: chunks => (<a href="https://resend.com/privacy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{chunks}</a>) })}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_3cd4554dd7ab2f")}</h2>
            <p>{uiText.rich("Ui.text_fb3764d3dac6f5", { part1: chunks => (<strong className="text-text-primary">{chunks}</strong>), part2: chunks => (<strong className="text-text-primary">{chunks}</strong>), part3: chunks => (<strong className="text-text-primary">{chunks}</strong>), part4: () => (<br />), part5: chunks => (<a href="https://vercel.com/docs/analytics/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{chunks}</a>) })}</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-text-primary">{uiText("AnalyticsPrivacy.title")}</h2>
            <p>{uiText("AnalyticsPrivacy.disclosure")}</p>
            <a href="https://posthog.com/privacy" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-gold underline">{uiText("AnalyticsPrivacy.providerPrivacy")}</a>
            <div><AnalyticsSettingsButton /></div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_37ef196041cca2")}</h2>
            <p>{uiText.rich("Ui.text_83bd02c2e09311", { part1: chunks => (<strong className="text-text-primary">{chunks}</strong>), part2: () => (<br />), part3: chunks => (<a href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{chunks}</a>) })}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_3f9cc56cdb997b")}</h2>
            <div className="space-y-3">
              <p>{uiText.rich("Ui.text_0401d93941cd17", { part1: chunks => (<strong className="text-text-primary">{chunks}</strong>) })}</p>
              <p>{uiText.rich("Ui.text_e2888ae24dc5fb", { part1: chunks => (<strong className="text-text-primary">{chunks}</strong>), part2: chunks => (<code className="bg-bg-elevated px-1 rounded text-xs">{chunks}</code>) })}</p>
              <p>{t("newsRegionDisclosure")}</p>
              <p>{uiText.rich("Ui.text_041e3e28efd4a6", { part1: chunks => (<strong className="text-text-primary">{chunks}</strong>) })}</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>{uiText.rich("Ui.text_02353b549012bf", { part1: chunks => (<code className="bg-bg-elevated px-1 rounded text-xs">{chunks}</code>) })}</li>
                <li>{uiText.rich("Ui.text_4bdd5c52423155", { part1: chunks => (<code className="bg-bg-elevated px-1 rounded text-xs">{chunks}</code>) })}</li>
              </ul>
              <p>{uiText.rich("Ui.text_a5da57f09fb33f", { part1: chunks => (<strong className="text-text-primary">{chunks}</strong>) })}</p>
            </div>
          </section>

          <section lang="de">
            <h2 className="text-base font-semibold text-text-primary mb-3">{t("genieVoiceTitle")}</h2>
            <p>{t("genieVoiceDisclosure")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_cc51bf12053029")}</h2>
            <p>{uiText("Ui.text_04763d66b1ef33")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_be3bc2432bedee")}</h2>
            <div className="space-y-2 mt-1">
              {[
                ["Profildaten, Inserate und Entwürfe", "Für die Bereitstellung des Kontos und der gespeicherten Inhalte; Löschanfragen können über die Kontoeinstellungen oder den Support gestellt werden"],
                ["Nachrichten und Supportvorgänge", "Für die Kommunikation und erforderliche Bearbeitung; lokales Ausblenden einer Nachricht löscht nicht automatisch die Empfängerkopie"],
                ["Profilaufrufe, Foto-Likes und Präsenzdaten", "Nur soweit für die jeweiligen Funktionen und erforderlichen Nachweise benötigt"],
                ["Hosting-, Fehler- und E-Mail-Protokolle", "Nach der tatsächlichen Dienstkonfiguration und dem erforderlichen Betriebszweck"],
                ["Vertrags- und Abrechnungsunterlagen", "Soweit vorhanden und gesetzlich vorgeschrieben, für die jeweils anwendbare Aufbewahrungsfrist"],
              ].map(([what, when]) => (
                <div key={what} className="flex flex-col sm:flex-row gap-1 sm:gap-3 py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-text-primary font-medium sm:w-52 shrink-0">{(uiOptionLabels[what] ?? what)}</span>
                  <span className="text-text-muted">{(uiOptionLabels[when] ?? when)}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_188abb11361064")}</h2>
            <p>{uiText("Ui.text_5e6d173d294b4f")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_421e74a6d64849")}</h2>
            <p className="mb-3">{uiText("Ui.text_c7bccc84802cbf")}</p>
            <ul className="space-y-2 list-disc list-inside marker:text-gold">
              <li>{uiText.rich("Ui.text_471d3044e1c802", { part1: chunks => (<strong className="text-text-primary">{chunks}</strong>) })}</li>
              <li>{uiText.rich("Ui.text_36d9ab8e2fbb50", { part1: chunks => (<strong className="text-text-primary">{chunks}</strong>) })}</li>
              <li>{uiText.rich("Ui.text_94d0d1954f6b1e", { part1: chunks => (<strong className="text-text-primary">{chunks}</strong>) })}</li>
              <li>{uiText.rich("Ui.text_df657ce9889ac0", { part1: chunks => (<strong className="text-text-primary">{chunks}</strong>) })}</li>
              <li>{uiText.rich("Ui.text_e42f35ebd97f2a", { part1: chunks => (<strong className="text-text-primary">{chunks}</strong>) })}</li>
              <li>{uiText.rich("Ui.text_fc5b657f756222", { part1: chunks => (<strong className="text-text-primary">{chunks}</strong>) })}</li>
              <li>{uiText.rich("Ui.text_351e16f55e9108", { part1: chunks => (<strong className="text-text-primary">{chunks}</strong>) })}</li>
            </ul>
            <p className="mt-3">{uiText.rich("Ui.text_11ecf3b1603bc3", { part1: chunks => (<strong className="text-text-primary">{chunks}</strong>), part2: () => (<br />), part3: chunks => (<a href="mailto:cinegenius.co@gmail.com" className="text-gold hover:underline">{chunks}</a>) })}</p>
            <p className="mt-3">{uiText.rich("Ui.text_dec738ce27179f", { part1: () => (<br />), part2: chunks => (<strong className="text-text-primary">{chunks}</strong>), part3: () => (<br />), part4: chunks => (<a href="https://www.lda.bayern.de" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{chunks}</a>) })}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_3e62bfdd32525c")}</h2>
            <p>{uiText.rich("Ui.text_7fb3434c1d331e", { part1: chunks => (<a href="mailto:cinegenius.co@gmail.com" className="text-gold hover:underline">{chunks}</a>) })}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_dc614761f1d7f7")}</h2>
            <p>{uiText.rich("Ui.text_e8c7a399f8d706", { part1: chunks => (<strong className="text-text-primary">{chunks}</strong>) })}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">{uiText("Ui.text_da1aa5f0d7763e")}</h2>
            <p>{uiText.rich("Ui.text_d47b701f28bc95", { part1: () => (<br />), part2: () => (<br />), part3: chunks => (<a href="mailto:cinegenius.co@gmail.com" className="text-gold hover:underline">{chunks}</a>) })}</p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-6">{uiText.rich("Ui.text_a42d052c401e22", { part1: chunks => (<Link href="/impressum" className="text-sm text-gold hover:underline">{chunks}</Link>), part2: chunks => (<Link href="/agb" className="text-sm text-gold hover:underline">{chunks}</Link>) })}</div>

      </div>
    </div>
  );
}
