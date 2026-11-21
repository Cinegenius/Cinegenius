'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import MediaImage from '@/components/MediaImage';
import { TranslatedText } from '@/components/ContentTranslation';
import NewsObservation from '@/components/organizations/NewsObservation';
import { entryCountry, entrySource } from '@/lib/organization-entry-browser';
import { countryName } from '@/lib/places/core';
import type { publicOrganizationEntries } from '@/lib/public-organization-entries-server';

type Props = { slug: string; entries: Awaited<ReturnType<typeof publicOrganizationEntries>>['entries'] };
export default function OrganizationNewsCards({ slug, entries }: Props) {
  const t = useTranslations('Organizations'), browser = useTranslations('OrganizationBrowser');
  const locale = useLocale();
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'Europe/Berlin' });
  return <div className="grid min-w-0 gap-4 md:grid-cols-2">{entries.map(entry => {
    const country = entryCountry(entry), source = entrySource(entry.external_url);
    const image = entry.image, href = `/news/${encodeURIComponent(slug)}/${encodeURIComponent(entry.slug)}`;
    return <article key={entry.id} data-news-observation className="browse-card min-w-0 p-4 sm:p-5">
      <NewsObservation id={entry.id} />
      <div className="flex min-w-0 items-start gap-3">
        {image && <figure className="w-20 min-w-0 shrink-0 sm:w-28"><Link href={href} tabIndex={-1} aria-hidden="true" className="block h-16 overflow-hidden rounded-lg bg-bg-elevated sm:h-20"><MediaImage src={image.url} alt={image.altText || ''} width={224} height={160} sizes="(min-width:640px) 112px,80px" className="h-full w-full object-contain" /></Link>{(image.creator || image.credit || image.attribution || image.licenseName) && <figcaption className="mt-1 break-words text-[10px] leading-4 text-text-muted">{[image.creator || image.credit || image.attribution, image.licenseName].filter(Boolean).join(' · ')}</figcaption>}</figure>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-gold"><span>{t(`entryType.${entry.entry_type}`)}</span>{entry.topic && <span>{t(`topic.${entry.topic}`)}</span>}</div>
          <h3 className="mt-2 break-words text-base font-semibold leading-6 text-text-primary"><Link href={href} className="block min-h-11 hover:text-gold"><TranslatedText kind="news" id={entry.id} field="title">{entry.title}</TranslatedText></Link></h3>
          <p className="mt-1 break-words text-xs leading-5 text-text-muted">{country === 'none' ? browser('unassigned') : countryName(country, locale)} · <time dateTime={entry.created_at}>{dates.format(new Date(entry.created_at))}</time></p>
        </div>
      </div>
      {entry.summary && <p className="mt-3 line-clamp-2 break-words text-sm leading-6 text-text-secondary"><TranslatedText kind="news" id={entry.id} field="summary">{entry.summary}</TranslatedText></p>}
      <p className="mt-3 break-all text-xs leading-5 text-text-muted">{browser('source')}: {source || browser('noSource')}</p>
    </article>;
  })}</div>;
}
