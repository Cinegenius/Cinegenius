import Image from "@/components/MediaImage";
import PageHeader from "@/components/PageHeader";
import DirectoryPage from "@/components/DirectoryPage";
import { ownBrowsePlace } from "@/lib/browse-geography-server";
import { approvedEntries,newsFacetRows } from "@/lib/organization-data";
import { isOrganizationEntryType,isOrganizationTopic } from "@/lib/organization-taxonomy";
import { countryCode,countryName } from "@/lib/places/core";
import { getLocale,getTranslations } from "next-intl/server";
import Link from "next/link";
import NewsBrowseControls from "./NewsBrowseControls";

export const dynamic = "force-dynamic";

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ type?: string; topic?: string; q?: string; page?: string; country?: string; geo?: string }> }) {
  const uiText = await getTranslations();

  const t = await getTranslations("Organizations");
  const discoveryT = await getTranslations("OrganizationDiscovery");
  const locale = await getLocale();
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" });
  const params = await searchParams;
  let preferred = null;
  if (!params.country && params.geo !== "off") { try { preferred = (await ownBrowsePlace()).place; } catch { /* Show all ordinary results on preference failure. */ } }
  const geoText = await getTranslations("BrowseGeography");
  const filters = { country: countryCode(params.country ?? ""), geo: params.geo === "off" ? "off" : "", type: isOrganizationEntryType(params.type) ? params.type : undefined,
    topic: isOrganizationTopic(params.topic) ? params.topic : undefined, q: params.q?.trim().slice(0, 120) || "" };
  const [{ entries: filtered, hasMore, page, count }, facets] = await Promise.all([approvedEntries({ ...filters, preferred, page: Number(params.page) || 1 }), newsFacetRows()]);
  const href = (change: { type?: string; topic?: string; page?: number; country?: string; geo?: string } = {}) => {
    const values = { ...filters, ...change };
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) if (value) query.set(key, String(value));
    return `/news?${query}`;
  };

  return <DirectoryPage area="news"><main className="min-h-screen">
    <PageHeader withBackdrop={false} badge={t("eyebrow")} title={t("newsTitle")} description={t("newsDescription")} />
    <NewsBrowseControls key={`${filters.q}:${filters.type}:${filters.topic}:${filters.country}:${filters.geo}`} filters={filters} facets={facets} count={count} preference={<>
      {preferred && <p className="browse-preference  flex flex-wrap items-center gap-x-4 text-xs text-text-secondary">{geoText("preferred", { country: countryName(preferred.country, locale) })}<Link className="inline-flex min-h-11 items-center underline" href={href({ geo: "off", page: 1 })}>{geoText("everywhere")}</Link></p>}
      {filters.geo === "off" && <Link className=" inline-flex min-h-11 items-center text-xs text-text-secondary underline" href={href({ geo: "", page: 1 })}>{geoText("useProfile")}</Link>}
    </>} />
    <section className="site-container py-5 pb-28 sm:py-7 sm:pb-28 xl:pb-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-5 gap-y-1 text-sm">
        <Link href="/organizations" className="inline-flex min-h-11 items-center text-gold">{discoveryT("allOrganizations")} →</Link>
        <Link href="/organization-dashboard" className="inline-flex min-h-11 items-center text-text-secondary hover:text-gold">{t("manageOrganization")} →</Link>
      </div>
      {filtered.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((entry) => <article key={entry.id} className="browse-card overflow-hidden">
          {entry.image_url ? <div className="aspect-[16/9] overflow-hidden bg-bg-elevated"><Image src={entry.image_url} alt="" width={720} height={405} className="h-full w-full object-cover" /></div> : null}
          <div className="p-5">
            <div className="mb-3 flex flex-wrap gap-2 text-xs text-gold"><span>{t(`entryType.${entry.entry_type}`)}</span>{entry.topic && <><span>·</span><span>{t(`topic.${entry.topic}`)}</span></>}</div>
            <h2 className="break-words font-serif text-2xl text-text-primary">{entry.title}</h2>
            {entry.entry_type !== "news" && entry.starts_at && <p className="mt-2 text-sm text-text-secondary"><time dateTime={entry.starts_at}>{dates.format(new Date(entry.starts_at))}</time></p>}
            {(entry.moderation_status === "ended" || (entry.ends_at && new Date(entry.ends_at).getTime() < Date.now())) && <p className="mt-2 text-sm text-gold">{t("status.ended")}</p>}
            {entry.summary && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-text-secondary">{entry.summary}</p>}
            <p className="mt-4 text-sm text-text-muted">{(Array.isArray(entry.organization) ? entry.organization[0] : entry.organization).name}{entry.city ? uiText("Ui.text_f6b53f9c8ab3ef", { value1: String(entry.city) }) : ""}</p>
            <Link className="mt-5 inline-flex min-h-11 items-center font-semibold text-gold" href={`/news/${(Array.isArray(entry.organization) ? entry.organization[0] : entry.organization).slug}/${entry.slug}`}>{t("openEntry")} →</Link>
          </div>
        </article>)}
      </div> : <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-text-muted">{t("empty")}</div>}
      <nav aria-label={t("newsTitle")} className="mt-7 flex justify-between gap-4">
        {page > 1 ? <Link className="min-h-11 rounded-xl border border-border px-4 py-3 text-text-secondary" href={href({ page: page - 1 })}>← {t("previous")}</Link> : <span />}
        {hasMore && <Link className="min-h-11 rounded-xl border border-border px-4 py-3 text-text-secondary" href={href({ page: page + 1 })}>{t("next")} →</Link>}
      </nav>
    </section>
  </main></DirectoryPage>;
}
