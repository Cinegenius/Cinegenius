import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import Image from "@/components/MediaImage";
import PageHeader from "@/components/PageHeader";
import { approvedEntryBySlugs } from "@/lib/organization-data";

export const dynamic = "force-dynamic";

export default async function EntryPage({ params }: { params: Promise<{ organizationSlug: string; entrySlug: string }> }) {
  const { organizationSlug, entrySlug } = await params;
  const result = await approvedEntryBySlugs(organizationSlug, entrySlug);
  if (!result) notFound();
  const { entry, organization } = result;
  const t = await getTranslations("Organizations");
  const locale = await getLocale();
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Berlin" });
  const ended = entry.moderation_status === "ended" || (entry.ends_at && new Date(entry.ends_at).getTime() < Date.now());
  return <main className="min-h-screen bg-bg-primary">
    <PageHeader badge={t(`entryType.${entry.entry_type}`)} title={entry.title} description={entry.summary || t("entryFallbackDescription")} />
    <article className="site-container max-w-4xl py-8 sm:py-12">
      {entry.image_url ? <div className="mb-8 aspect-[16/9] overflow-hidden rounded-2xl border border-border bg-bg-secondary"><Image src={entry.image_url} alt="" width={1200} height={675} className="h-full w-full object-cover" /></div> : null}
      <div className="mb-8 flex flex-wrap gap-3 text-sm text-text-secondary">
        {entry.topic && <span>{t(`topic.${entry.topic}`)}</span>}
        {entry.entry_type !== "news" && <span>{t(`format.${entry.format}`)}</span>}
        {entry.city && <><span>·</span><span>{entry.city}</span></>}
      </div>
      {entry.entry_type !== "news" && <div className="mb-7 space-y-2 text-text-secondary">
        {ended && <p className="font-semibold text-gold">{t("status.ended")}</p>}
        {entry.starts_at && <p>{t("startsAt")}: <time dateTime={entry.starts_at}>{dates.format(new Date(entry.starts_at))}</time></p>}
        {entry.ends_at && <p>{t("endsAt")}: <time dateTime={entry.ends_at}>{dates.format(new Date(entry.ends_at))}</time></p>}
        {(entry.starts_at || entry.ends_at) && <p className="text-xs text-text-muted">{t("timeZoneNotice")}</p>}
        {entry.venue && <p className="break-words">{t("venue")}: {entry.venue}</p>}
      </div>}
      {entry.description && <div className="whitespace-pre-wrap break-words text-base leading-8 text-text-secondary">{entry.description}</div>}
      <div className="mt-10 flex flex-wrap gap-3">
        {entry.registration_url && !ended && <a href={entry.registration_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-bg-primary">{t("registerExternal")}</a>}
        {entry.external_url && <a href={entry.external_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-border px-5 py-3 text-sm text-text-secondary">{t("moreInformation")}</a>}
        <Link href={`/organizations/${organization.slug}`} className="inline-flex min-h-11 items-center rounded-xl border border-border px-5 py-3 text-sm text-text-secondary">{organization.name}</Link>
      </div>
    </article>
  </main>;
}
