/** Default in the existing, centrally editable support template system. */
export const STARTED_OFFER_TEMPLATE_KEY = "started_offer";
export function startedOfferTemplate(t: (key: string) => string) {
  return { template_key: STARTED_OFFER_TEMPLATE_KEY, label: t("templateLabel"), body: t("templateBody"), enabled: true };
}
