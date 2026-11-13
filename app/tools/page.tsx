import { getTranslations } from "next-intl/server";
import PageHeader from "@/components/PageHeader";

export async function generateMetadata() {
  const t = await getTranslations("AiTools");
  return { title: t("title"), description: t("description") };
}

export default async function ToolsPage() {
  const [t, nav] = await Promise.all([getTranslations("AiTools"), getTranslations("nav")]);
  return <main className="mobile-bottom-nav-clear min-h-screen bg-bg-primary">
    <PageHeader badge={nav("comingSoon")} title={t("title")} description={t("description")} />
    <div className="site-container space-y-8 py-6 sm:py-8">
      <section className="max-w-2xl border-t border-border pt-6" aria-labelledby="room-scan-title">
        <p className="mb-2 text-xs font-medium text-text-muted">{t("planned")}</p>
        <h2 id="room-scan-title" className="mb-2 text-lg font-semibold text-text-primary">{t("roomScanTitle")}</h2>
        <p className="text-sm leading-relaxed text-text-secondary">{t("roomScanDescription")}</p>
      </section>
    </div>
  </main>;
}
