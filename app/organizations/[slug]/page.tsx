import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Image from "@/components/MediaImage";
import PageHeader from "@/components/PageHeader";
import { approvedOrganizationBySlug } from "@/lib/organization-data";

export const dynamic = "force-dynamic";

export default async function OrganizationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await approvedOrganizationBySlug(slug);
  if (!result) notFound();
  const { organization, entries } = result;
  const t = await getTranslations("Organizations");
  return <main className="min-h-screen bg-bg-primary">
    <PageHeader badge={t("organization")} title={organization.name} description={organization.description || t("organizationFallbackDescription")} />
    <section className="site-container py-8 sm:py-12">
      <div className={`mb-10 grid gap-6 ${organization.logo_url ? "lg:grid-cols-[220px_1fr]" : ""}`}>
        {organization.logo_url ? <div className="flex aspect-square w-full max-w-[220px] items-center justify-center rounded-2xl border border-border bg-white p-5"><Image src={organization.logo_url} alt={organization.name} width={360} height={360} className="max-h-full max-w-full object-contain" /></div> : null}
        <div>
          <div className="flex flex-wrap gap-2">{organization.topics.map((topic: string) => <span key={topic} className="rounded-full border border-border px-3 py-2 text-xs text-text-secondary">{t(`topic.${topic}`)}</span>)}</div>
          <p className="mt-5 text-text-secondary">{[organization.city, organization.region].filter(Boolean).join(" · ")}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {organization.website_url && <a className="inline-flex min-h-11 items-center rounded-xl border border-border px-5 py-3 text-sm text-text-secondary" href={organization.website_url} target="_blank" rel="noopener noreferrer">{t("website")}</a>}
            {organization.public_contact_email && <a className="inline-flex min-h-11 items-center rounded-xl border border-border px-5 py-3 text-sm text-text-secondary" href={`mailto:${organization.public_contact_email}`}>{t("contact")}</a>}
          </div>
        </div>
      </div>
      <h2 className="font-serif text-3xl text-text-primary">{t("organizationEntries")}</h2>
      {entries.length ? <div className="mt-6 grid gap-4 md:grid-cols-2">{entries.map((entry) => <Link key={entry.id} href={`/news/${organization.slug}/${entry.slug}`} className="browse-card p-5"><span className="text-xs text-gold">{t(`entryType.${entry.entry_type}`)}</span><h3 className="mt-2 text-xl font-semibold text-text-primary">{entry.title}</h3>{entry.summary && <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{entry.summary}</p>}</Link>)}</div> : <p className="mt-4 text-text-muted">{t("emptyOrganization")}</p>}
    </section>
  </main>;
}
