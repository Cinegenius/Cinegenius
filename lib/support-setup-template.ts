/** A default in the existing template system. Admins may override it in the usual template editor. */
export const SETUP_TEMPLATE_KEY = "profile_setup";
export function setupSupportTemplate(t: (key: string) => string) {
  return { template_key: SETUP_TEMPLATE_KEY, label: t("setupTemplateLabel"), body: t("setupTemplateBody"), enabled: true };
}
