import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import PageHeader from "@/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AiTransparency");
  return { title: `${t("title")} — CineGenius`, description: t("description") };
}

export default async function AiTransparencyPage() {
  const t = await getTranslations("AiTransparency");
  return <main className="min-h-screen pb-12">
    <PageHeader badge={t("badge")} title={t("title")} description={t("description")} />
    <div className="site-container space-y-6 py-6 sm:py-9">
      <section aria-labelledby="ai-development" className="rounded-xl border border-border bg-bg-secondary p-5 sm:p-6">
        <h2 id="ai-development" className="font-display text-xl font-bold text-text-primary">{t("developmentTitle")}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary">{t("developmentBody")}</p>
      </section>
      <section id="bilder" aria-labelledby="ai-images" className="scroll-mt-24 rounded-xl border border-border bg-bg-secondary p-5 sm:p-6">
        <h2 id="ai-images" className="font-display text-xl font-bold text-text-primary">{t("imagesTitle")}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary">{t("imagesBody")}</p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary">{t("membersBody")}</p>
      </section>
      <section aria-labelledby="ai-contact" className="rounded-xl border border-border bg-bg-secondary p-5 sm:p-6">
        <h2 id="ai-contact" className="font-display text-xl font-bold text-text-primary">{t("contactTitle")}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary">{t("contactBody")}</p>
        <a href="mailto:cinegenius.co@gmail.com" className="mt-2 inline-flex min-h-11 items-center break-all text-sm font-medium text-gold hover:underline">{t("contactEmail")}</a>
      </section>
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-medium text-gold hover:underline">{t("backHome")}</Link>
    </div>
  </main>;
}
