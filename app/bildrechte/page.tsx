import { getTranslations } from "next-intl/server";
import PageHeader from "@/components/PageHeader";

export async function generateMetadata() {
  const t = await getTranslations("ProjectMediaRights");
  return { title: `${t("pageTitle")} — CineGenius`, description: t("pageDescription") };
}
export default async function ImageRightsPage() {
  const t = await getTranslations("ProjectMediaRights");
  return <main className="min-h-screen pb-12">
    <PageHeader badge={t("pageTitle")} title={t("pageHeading")} description={t("pageDescription")} />
    <div className="site-container space-y-5 py-6 sm:py-9">
      <p className="max-w-3xl text-sm leading-7 text-text-secondary">{t("pageBody")}</p>
      <p className="max-w-3xl text-sm leading-7 text-text-secondary">{t("limitBody")}</p>
      <section className="rounded-xl border border-border bg-bg-secondary p-5 sm:p-6"><h2 className="font-display text-xl text-text-primary">{t("reportTitle")}</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary">{t("reportBody")}</p><a href="mailto:cinegenius.co@gmail.com" className="mt-3 inline-flex min-h-11 items-center break-all text-sm text-gold hover:underline">{t("email")}</a></section>
    </div>
  </main>;
}
