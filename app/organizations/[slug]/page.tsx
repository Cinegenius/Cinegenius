import { TranslatedText } from "@/components/ContentTranslation";
import Link from "next/link";
import { db } from "@/lib/db";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Image from "@/components/MediaImage";
import NativeNewsSections from "@/components/app/NativeNewsSections";
import PageHeader from "@/components/PageHeader";
import { approvedOrganizationBySlug } from "@/lib/organization-data";
import { parsePublicEntryFilters, publicEntryHref } from '@/lib/public-organization-entries';
import { publicOrganizationEntries } from '@/lib/public-organization-entries-server';
import PublicOrganizationEntries from '@/components/organizations/PublicOrganizationEntries';
import OrganizationNewsCards from '@/components/organizations/OrganizationNewsCards';

export const dynamic = "force-dynamic";

export default async function OrganizationPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) if (typeof value === 'string') query.set(key, value);
  const filters = parsePublicEntryFilters(query);
  const result = await approvedOrganizationBySlug(slug, false);
  if (!result) notFound();
  const { organization } = result;
  if (organization.slug !== slug) permanentRedirect(publicEntryHref(`/organizations/${encodeURIComponent(organization.slug)}`, filters));
  const [{ entries, total, page, pages, available, facets }, t, accessT, linked] = await Promise.all([
    publicOrganizationEntries(organization.id, filters),
    getTranslations("Organizations"), getTranslations("OrganizationAccess"),
    db.from("organization_company_links")
      .select("company:companies!inner(name,slug,published)").eq("organization_id", organization.id)
      .eq("status", "accepted").eq("company.published", true).maybeSingle(),
  ]);
  const browse = { total, page, pages, available, facets };
  if (linked.error) throw new Error("organization_company_link_load_failed");
  const company = linked.data?.company as unknown as {name:string;slug:string}|null;
  return <main className="min-h-screen bg-bg-primary">
    <NativeNewsSections section="organizations" country={organization.place_country_code ?? ""} />
    <PageHeader
      badge={t("organization")}
      title={organization.name}
      description={[organization.city, organization.region].filter(Boolean).join(" · ") || t("organizationFallbackDescription")}
      leading={organization.logo_url ? (
        <div className="mb-4 flex h-24 w-48 max-w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-white p-3 sm:h-28 sm:w-56">
          <Image src={organization.logo_url} alt={organization.name} width={448} height={224} className="h-full w-full object-contain" />
        </div>
      ) : undefined}
    >
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">{organization.topics.map((topic: string) => <span key={topic} className="rounded-full border border-border px-3 py-2 text-xs text-text-secondary">{t(`topic.${topic}`)}</span>)}</div>
          {company && <p className="mt-5 text-sm text-text-secondary">{accessT("companyLinks")}: <Link className="text-gold" href={`/companies/${company.slug}`}>{company.name}</Link></p>}
          <div className="mt-5 flex flex-wrap gap-3">
            {organization.website_url && <a className="inline-flex min-h-11 items-center rounded-xl border border-border px-5 py-3 text-sm text-text-secondary" href={organization.website_url} target="_blank" rel="noopener noreferrer">{t("website")}</a>}
            {organization.public_contact_email && <a className="inline-flex min-h-11 items-center rounded-xl border border-border px-5 py-3 text-sm text-text-secondary" href={`mailto:${organization.public_contact_email}`}>{t("contact")}</a>}
          </div>
        </div>
    </PageHeader>
    <section className="site-container py-6 pb-28 sm:py-8 sm:pb-28 xl:pb-10">
      {organization.description && (
        <section className="mb-8 max-w-3xl" aria-labelledby="organization-description">
          <h2 id="organization-description" className="mb-3 font-serif text-xl text-text-primary sm:text-2xl">{t("description")}</h2>
          <p className="whitespace-pre-line break-words text-sm leading-7 text-text-secondary sm:text-base"><TranslatedText kind="organization" id={organization.id} field="description">{organization.description}</TranslatedText></p>
        </section>
      )}
      <PublicOrganizationEntries filters={{ ...filters, page: browse.page }} result={browse}>
        <OrganizationNewsCards slug={organization.slug} entries={entries} />
      </PublicOrganizationEntries>
    </section>
  </main>;
}
