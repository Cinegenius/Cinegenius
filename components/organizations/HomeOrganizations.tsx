import Link from 'next/link';
import Image from '@/components/MediaImage';
import {getLocale, getTranslations} from 'next-intl/server';
import {organizationDiscovery, latestOrganizationEntries} from '@/lib/organization-discovery';

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
 return <section className="border-b border-border bg-bg-primary py-4 sm:py-6"><div className="site-container">
  <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
   <div><p className="mb-1 text-xs uppercase tracking-widest text-gold">{t('eyebrow')}</p><h2 className="font-serif text-xl sm:text-2xl">{t('title')}</h2></div>
   <Link href="/news" className="inline-flex min-h-11 items-center text-sm text-gold">{t('allEntries')} →</Link>
  </div>
  {entries.length > 0 && <div className="grid grid-cols-[repeat(2,minmax(0,21rem))] items-start gap-3 lg:grid-cols-[repeat(3,minmax(0,21rem))]">
   {entries.map(entry => {
    const org = (Array.isArray(entry.organization) ? entry.organization[0] : entry.organization) as unknown as {slug:string;name:string};
    const date = entry.entry_type === 'news' ? entry.created_at : entry.starts_at;
    return <article key={entry.id} className="browse-card min-w-0 overflow-hidden">
     <Link href={`/news/${org.slug}/${entry.slug}`} className="block min-h-11">
      {entry.image_url && <div className="relative aspect-[5/2]"><Image src={entry.image_url} alt="" fill sizes="(max-width: 639px) calc((100vw - 44px) / 2), 336px" className="object-cover"/></div>}
      <div className="px-3 pt-2.5">
       <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]"><span className="text-gold">{entryT(`entryType.${entry.entry_type}`)}</span>{date && <time dateTime={date} className="text-text-muted">{dates.format(new Date(date))}</time>}</div>
       <h3 className="mt-1 line-clamp-2 break-words text-sm font-semibold leading-snug">{entry.title}</h3>
       {entry.summary && <p className="mt-1 line-clamp-2 break-words text-xs leading-snug text-text-secondary">{entry.summary}</p>}
      </div>
     </Link>
     <Link href={`/organizations/${org.slug}`} className="mx-3 mb-1 mt-0.5 flex min-h-11 items-center text-xs leading-snug text-gold"><span className="line-clamp-2 break-words">{org.name}</span></Link>
    </article>;
   })}
  </div>}
  {organizations.length > 0 && <div className={entries.length ? 'mt-4' : ''}>
   <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><h3 className="font-serif text-base">{t('organizations')}</h3><Link href="/organizations" className="inline-flex min-h-11 items-center text-sm text-gold">{t('allOrganizations')} →</Link></div>
   <ul className="grid min-w-0 grid-cols-[repeat(2,minmax(0,21rem))] gap-2 sm:gap-3 lg:grid-cols-[repeat(3,minmax(0,21rem))]">{organizations.map(org => <li key={org.id} className="min-w-0">
    <Link href={`/organizations/${org.slug}`} className="browse-card flex h-full min-h-11 min-w-0 items-center gap-2 px-2.5 py-2">
     {org.logo_url && <Image src={org.logo_url} alt="" width={64} height={48} className="h-8 w-10 shrink-0 object-contain"/>}
     <span className="min-w-0 break-words"><span className="line-clamp-2 text-sm font-semibold leading-snug">{org.name}</span>{org.city && <span className="block text-xs leading-snug text-text-muted">{org.city}</span>}</span>
    </Link>
   </li>)}</ul>
  </div>}
 </div></section>;
}
