import Link from 'next/link';
import Image from '@/components/MediaImage';
import {getLocale, getTranslations} from 'next-intl/server';
import {organizationDiscovery, latestOrganizationEntries} from '@/lib/organization-discovery';
import {OrganizationCards} from './PublicOrganizationLinks';

export default async function HomeOrganizations() {
 const [t, entryT, locale] = await Promise.all([
  getTranslations('OrganizationDiscovery'), getTranslations('Organizations'), getLocale(),
 ]);
 let organizations, entries;
 try {
  const results = await Promise.all([organizationDiscovery(1, 6), latestOrganizationEntries()]);
  organizations = results[0].organizations;
  entries = results[1];
 } catch {
  console.error('homepage_organization_discovery_unavailable');
  return null;
 }
 if (!organizations.length && !entries.length) return null;
 const dates = new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeZone: 'Europe/Berlin'});
 return <section className="border-b border-border bg-bg-primary py-6 sm:py-8"><div className="site-container">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
   <div><p className="mb-1 text-xs uppercase tracking-widest text-gold">{t('eyebrow')}</p><h2 className="font-serif text-2xl sm:text-3xl">{t('title')}</h2></div>
   <Link href="/news" className="inline-flex min-h-11 items-center text-sm text-gold">{t('allEntries')} →</Link>
  </div>
  {entries.length > 0 && <div className="grid grid-cols-[minmax(0,21rem)] items-start gap-4 sm:grid-cols-[repeat(2,minmax(0,21rem))] lg:grid-cols-[repeat(3,minmax(0,21rem))]">
   {entries.map(entry => {
    const org = (Array.isArray(entry.organization) ? entry.organization[0] : entry.organization) as unknown as {slug:string;name:string};
    const date = entry.entry_type === 'news' ? entry.created_at : entry.starts_at;
    return <article key={entry.id} className="browse-card min-w-0 overflow-hidden">
     <Link href={`/news/${org.slug}/${entry.slug}`} className="block">
      {entry.image_url && <div className="relative aspect-video"><Image src={entry.image_url} alt="" fill sizes="(max-width: 380px) calc(100vw - 32px), 336px" className="object-cover"/></div>}
      <div className="px-4 pt-3">
       <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"><span className="text-gold">{entryT(`entryType.${entry.entry_type}`)}</span>{date && <time dateTime={date} className="text-text-muted">{dates.format(new Date(date))}</time>}</div>
       <h3 className="mt-1.5 line-clamp-2 break-words text-base font-semibold leading-snug">{entry.title}</h3>
       {entry.summary && <p className="mt-1.5 line-clamp-2 break-words text-sm leading-snug text-text-secondary">{entry.summary}</p>}
      </div>
     </Link>
     <Link href={`/organizations/${org.slug}`} className="mx-4 mb-2 mt-1 flex min-h-11 items-center text-xs leading-snug text-gold"><span className="line-clamp-2 break-words">{org.name}</span></Link>
    </article>;
   })}
  </div>}
  {organizations.length > 0 && <div className={entries.length ? 'mt-5' : ''}>
   <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><h3 className="font-serif text-lg">{t('organizations')}</h3><Link href="/organizations" className="inline-flex min-h-11 items-center text-sm text-gold">{t('allOrganizations')} →</Link></div>
   <OrganizationCards organizations={organizations} compact/>
  </div>}
 </div></section>;
}
