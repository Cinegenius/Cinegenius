import Link from "next/link";
import Form from "next/form";
import { Search } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import PageHeader from "@/components/PageHeader";
import Image from "@/components/MediaImage";
import { approvedEntries } from "@/lib/organization-data";
import { ORGANIZATION_ENTRY_TYPES, ORGANIZATION_TOPICS, isOrganizationEntryType, isOrganizationTopic } from "@/lib/organization-taxonomy";

export const dynamic = "force-dynamic";

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ type?: string; topic?: string; q?: string; page?: string }> }) {
  const t = await getTranslations("Organizations");
  const discoveryT = await getTranslations("OrganizationDiscovery");
  const locale = await getLocale();
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" });
  const params = await searchParams;
  const filters = { type: isOrganizationEntryType(params.type) ? params.type : undefined,
    topic: isOrganizationTopic(params.topic) ? params.topic : undefined, q: params.q?.trim().slice(0, 120) || "" };
  const { entries: filtered, hasMore, page } = await approvedEntries({ ...filters, page: Number(params.page) || 1 });
  const href = (change: { type?: string; topic?: string; page?: number } = {}) => {
    const values = { ...filters, ...change };
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) if (value) query.set(key, String(value));
    return `/news?${query}`;
  };

  return <main className="min-h-screen bg-bg-primary">
    <PageHeader badge={t("eyebrow")} title={t("newsTitle")} description={t("newsDescription")} />
    <section className="site-container py-5 pb-28 sm:py-7 sm:pb-28 xl:pb-10">
      <Form action="/news" scroll={false} className="browse-toolbar mb-5 grid grid-cols-2 items-end gap-3 pb-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]" key={`${filters.q}:${filters.type}:${filters.topic}`}>
        <div className="col-span-2 min-w-0 xl:col-span-1">
          <label htmlFor="news-search" className="sr-only">{t("searchLabel")}</label>
          <div className="relative">
            <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input id="news-search" type="search" name="q" defaultValue={filters.q} placeholder={t("searchLabel")} maxLength={120} className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-secondary py-2.5 pl-10 pr-3 text-sm text-text-primary" />
          </div>
        </div>
        <label htmlFor="news-type" className="min-w-0 text-xs text-text-secondary">{t("type")}
          <select id="news-type" name="type" defaultValue={filters.type || ""} className="mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary">
            <option value="">{t("all")}</option>
            {ORGANIZATION_ENTRY_TYPES.map(type => <option key={type} value={type}>{t(`entryType.${type}`)}</option>)}
          </select>
        </label>
        <label htmlFor="news-topic" className="min-w-0 text-xs text-text-secondary">{t("topicLabel")}
          <select id="news-topic" name="topic" defaultValue={filters.topic || ""} className="mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary">
            <option value="">{t("all")}</option>
            {ORGANIZATION_TOPICS.map(topic => <option key={topic} value={topic}>{t(`topic.${topic}`)}</option>)}
          </select>
        </label>
        <button type="submit" className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-bg-primary xl:col-span-1"><Search size={16} aria-hidden="true" />{t("search")}</button>
      </Form>
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
            <p className="mt-4 text-sm text-text-muted">{(Array.isArray(entry.organization) ? entry.organization[0] : entry.organization).name}{entry.city ? ` · ${entry.city}` : ""}</p>
            <Link className="mt-5 inline-flex min-h-11 items-center font-semibold text-gold" href={`/news/${(Array.isArray(entry.organization) ? entry.organization[0] : entry.organization).slug}/${entry.slug}`}>{t("openEntry")} →</Link>
          </div>
        </article>)}
      </div> : <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-text-muted">{t("empty")}</div>}
      <nav aria-label={t("newsTitle")} className="mt-7 flex justify-between gap-4">
        {page > 1 ? <Link className="min-h-11 rounded-xl border border-border px-4 py-3 text-text-secondary" href={href({ page: page - 1 })}>← {t("previous")}</Link> : <span />}
        {hasMore && <Link className="min-h-11 rounded-xl border border-border px-4 py-3 text-text-secondary" href={href({ page: page + 1 })}>{t("next")} →</Link>}
      </nav>
    </section>
  </main>;
}
