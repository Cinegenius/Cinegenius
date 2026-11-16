import { getLocale, getTranslations } from "next-intl/server";

/** The legal surface keeps the German original; other surfaces use localized copy. */
export async function SupportServiceNotice({ compact = false, legalOriginal = false }: { compact?: boolean; legalOriginal?: boolean }) {
  const locale = legalOriginal ? "de" : await getLocale();
  const t = await getTranslations({ locale, namespace: "SupportMediation" });
  const body = (
    <div lang={locale} className="space-y-3 text-sm leading-relaxed text-text-secondary [overflow-wrap:anywhere]">
      {!compact && <p>{t("startup")}</p>}
      <p>{t("free")}</p>
      <p>{t("mediation")}</p>
      <p>{t("providerPrices")}</p>
      <p>{t("additional")}</p>
      <p>{t("agreement")}</p>
      <p>{t("existingAgreements")}</p>
      {!compact && <p>{t("communityClosing")}</p>}
    </div>
  );
  if (compact) return body;
  return (
    <section id="support-mediation" aria-labelledby="support-mediation-heading" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-16 scroll-mt-24">
      <div className="rounded-2xl border border-border bg-bg-secondary p-6 sm:p-8">
        <h2 id="support-mediation-heading" className="font-display text-2xl font-bold text-text-primary mb-4">{t("heading")}</h2>
        {body}
      </div>
    </section>
  );
}
