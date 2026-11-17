import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import PageHeader from "@/components/PageHeader";
import PublicReportForm from "@/components/PublicReportForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PublicReport");
  return {
    alternates: { canonical: "https://www.cinegenius.co/melden" },
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function PublicReportPage() {
  const t = await getTranslations("PublicReport");
  return (
    <main className="min-h-screen pb-12">
      <PageHeader badge={t("badge")} title={t("title")} description={t("description")} />
      <div className="site-container grid gap-6 py-6 sm:py-9 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="report-form-title" className="min-w-0">
          <h2 id="report-form-title" className="sr-only">{t("formTitle")}</h2>
          <PublicReportForm />
        </section>
        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-bg-secondary p-5">
            <h2 className="text-sm font-semibold text-text-primary">{t("side.title")}</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{t("side.body")}</p>
          </div>
          <div className="rounded-lg border border-border bg-bg-secondary p-5">
            <h2 className="text-sm font-semibold text-text-primary">{t("side.noFilesTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{t("side.noFilesBody")}</p>
          </div>
          <Link href="/impressum" className="inline-flex min-h-11 items-center text-sm font-medium text-gold hover:underline">{t("imprintLink")}</Link>
        </aside>
      </div>
    </main>
  );
}
