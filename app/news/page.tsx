import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import PageHeader from "@/components/PageHeader";
import Image from "@/components/MediaImage";
import { approvedEntries } from "@/lib/organization-data";
import { ORGANIZATION_ENTRY_TYPES, ORGANIZATION_TOPICS, isOrganizationEntryType, isOrganizationTopic } from "@/lib/organization-taxonomy";

export const dynamic = "force-dynamic";

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ type?: string; topic?: string; q?: string; page?: string }> }) {
  const t = await getTranslations("Organizations");
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
    <section className="site-container py-8 sm:py-10">
      <form action="/news" className="mb-6 flex flex-wrap items-end gap-3">
        {filters.type && <input type="hidden" name="type" value={filters.type} />}
        {filters.topic && <input type="hidden" name="topic" value={filters.topic} />}
        <label className="min-w-0 basis-full text-sm text-text-secondary sm:flex-1">{t("searchLabel")}<input name="q" defaultValue={filters.q} maxLength={120} className="mt-2 w-full rounded-xl border border-border bg-bg-secondary px-4 py-3 text-text-primary" /></label>
        <button className="min-h-11 rounded-xl bg-gold px-5 py-3 font-semibold text-bg-primary">{t("search")}</button>
        <Link href="/organization-dashboard" className="py-3 text-sm text-gold">{t("manageOrganization")} →</Link>
      </form>
      <div className="browse-toolbar mb-7 flex flex-wrap gap-2">
        <Link href="/news" className={`inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm font-semibold ${!filters.type && !filters.topic ? "border-gold bg-gold text-bg-primary" : "border-border text-text-secondary"}`}>{t("all")}</Link>
        {ORGANIZATION_ENTRY_TYPES.map((type) => <Link key={type} href={href({ type: filters.type === type ? undefined : type })} className={`inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm font-semibold ${filters.type === type ? "border-gold bg-gold text-bg-primary" : "border-border text-text-secondary"}`}>{t(`entryType.${type}`)}</Link>)}
      </div>
      <div className="mb-8 flex flex-wrap gap-2">
        {ORGANIZATION_TOPICS.map((topic) => <Link key={topic} href={href({ topic: filters.topic === topic ? undefined : topic })} className={`inline-flex min-h-11 items-center rounded-full border px-3 py-2 text-xs ${filters.topic === topic ? "border-gold text-gold" : "border-border text-text-secondary"}`}>{t(`topic.${topic}`)}</Link>)}
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
      </div> : <div className="rounded-xl border border-dashed border-border py-16 text-center text-text-muted">{t("empty")}</div>}
      <nav aria-label={t("newsTitle")} className="mt-7 flex justify-between gap-4">
        {page > 1 ? <Link className="min-h-11 rounded-xl border border-border px-4 py-3 text-text-secondary" href={href({ page: page - 1 })}>← {t("previous")}</Link> : <span />}
        {hasMore && <Link className="min-h-11 rounded-xl border border-border px-4 py-3 text-text-secondary" href={href({ page: page + 1 })}>{t("next")} →</Link>}
      </nav>
    </section>
  </main>;
}
