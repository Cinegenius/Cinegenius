import NewsObservation from "@/components/organizations/NewsObservation";
import { TranslatedText, ContentTranslationNotice } from "@/components/ContentTranslation";
import Image from "@/components/MediaImage";
import PageHeader from "@/components/PageHeader";
import DirectoryPage from "@/components/DirectoryPage";
import { newsRegion } from '@/lib/news-region-server';
import { homeNewsTopic } from '@/lib/news-topic-server';
import { approvedEntries,newsFacetRows } from "@/lib/organization-data";
import { isOrganizationEntryType,isOrganizationTopic } from "@/lib/organization-taxonomy";
import { getLocale,getNow,getTranslations } from "next-intl/server";
import Link from "next/link";
import NativeNews, { type NativeNewsEntry } from "@/components/app/NativeNews";
import { publicMapPoint } from "@/lib/places/public-map-point";
import { organizationDiscovery } from "@/lib/organization-discovery";
import { organizationsCountryHref } from "@/lib/browse-country";

export const dynamic = "force-dynamic";

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ type?: string; topic?: string; q?: string; page?: string; country?: string; geo?: string }> }) {
  const uiText = await getTranslations();

  const t = await getTranslations("Organizations");
  const discoveryT = await getTranslations("OrganizationDiscovery");
  const locale = await getLocale();
  const now = await getNow();
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" });
  const params = await searchParams;
  const region = await newsRegion(params.country || (params.geo === 'off' ? 'all' : undefined));
  const topic = await homeNewsTopic(region.cookieName, params.topic);
  const filters = { country: region.selection, type: isOrganizationEntryType(params.type) ? params.type : undefined,
    topic: isOrganizationTopic(topic.selection) ? topic.selection : undefined, q: params.q?.trim().slice(0, 120) || "" };
  const [{ entries: filtered, hasMore, page, count }, facets, organizationPage] = await Promise.all([
    approvedEntries({ ...filters, country: region.country, page: Number(params.page) || 1 }), newsFacetRows(),
    organizationDiscovery(1, 12, region.country).catch(() => null),
  ]);
  const href = (change: { type?: string; topic?: string; page?: number; country?: string; geo?: string } = {}) => {
    const values = { ...filters, ...change };
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) if (value) query.set(key, String(value));
    query.set('topic', values.topic || 'all');
    return `/news?${query}`;
  };


  const nativeEntries: NativeNewsEntry[] = filtered.map(entry => {
    // Selected by approvedEntries already. Only this entry's own public place;
    // an organization's source country/seat is never a news/event location.
    const own = entry as typeof entry & { format?: string; place_city_name?: string | null };
    const organization = Array.isArray(entry.organization) ? entry.organization[0] : entry.organization;
    const point = own.format === "online" ? { lat: null, lng: null } : publicMapPoint(own);
    return {
      id: entry.id, href: `/news/${organization.slug}/${entry.slug}`, title: entry.title, summary: entry.summary,
      image: entry.image_url, typeLabel: t(`entryType.${entry.entry_type}`), topicLabel: entry.topic ? t(`topic.${entry.topic}`) : "",
      organization: organization.name, city: own.place_city_name || entry.city || "",
      startsAt: entry.entry_type !== "news" ? entry.starts_at : null,
      dateLabel: entry.entry_type !== "news" && entry.starts_at ? dates.format(new Date(entry.starts_at)) : "",
      ended: entry.moderation_status === "ended" || !!(entry.ends_at && new Date(entry.ends_at).getTime() < now.getTime()),
      lat: point.lat, lng: point.lng,
    };
  });

  return <DirectoryPage area="news"><main className="min-h-screen">
    <PageHeader withBackdrop={false} badge={t("eyebrow")} title={t("newsTitleLead")} titleHighlight={t("newsTitleHighlight")} description={t("newsDescription")} />
    <div className="site-container"><ContentTranslationNotice /></div>
    <NativeNews key={`${region.cookieName}:${filters.q}:${filters.type}:${filters.topic}:${filters.country}:${region.country}`}
      controls={{ filters, facets, count, region, topicCookieName: topic.cookieName }} entries={nativeEntries} page={page}
      organizations={organizationPage?.organizations ?? []} organizationsUnavailable={organizationPage === null}
      organizationsHref={organizationsCountryHref(region.country)}
      previousHref={page > 1 ? href({ page: page - 1 }) : null} nextHref={hasMore ? href({ page: page + 1 }) : null}>
    <section className="site-container py-5 pb-28 sm:py-7 sm:pb-28 xl:pb-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-5 gap-y-1 text-sm">
        <Link href="/organizations" className="inline-flex min-h-11 items-center text-gold">{discoveryT("allOrganizations")} →</Link>
        <Link href="/organization-dashboard" className="inline-flex min-h-11 items-center text-text-secondary hover:text-gold">{t("manageOrganization")} →</Link>
      </div>
      {filtered.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((entry) => <article key={entry.id} data-news-observation className="browse-card overflow-hidden"><NewsObservation id={entry.id} />
          {entry.image_url ? <div className="aspect-[16/9] overflow-hidden bg-bg-elevated"><Image src={entry.image_url} alt="" width={720} height={405} className="h-full w-full object-cover" /></div> : null}
          <div className="p-5">
            <div className="mb-3 flex flex-wrap gap-2 text-xs text-gold"><span>{t(`entryType.${entry.entry_type}`)}</span>{entry.topic && <><span>·</span><span>{t(`topic.${entry.topic}`)}</span></>}</div>
            <h2 className="break-words font-serif text-2xl text-text-primary"><TranslatedText kind="news" id={entry.id} field="title">{entry.title}</TranslatedText></h2>
            {entry.entry_type !== "news" && entry.starts_at && <p className="mt-2 text-sm text-text-secondary"><time dateTime={entry.starts_at}>{dates.format(new Date(entry.starts_at))}</time></p>}
            {(entry.moderation_status === "ended" || (entry.ends_at && new Date(entry.ends_at).getTime() < now.getTime())) && <p className="mt-2 text-sm text-gold">{t("status.ended")}</p>}
            {entry.summary && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-text-secondary"><TranslatedText kind="news" id={entry.id} field="summary">{entry.summary}</TranslatedText></p>}
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
    </NativeNews>
  </main></DirectoryPage>;
}
