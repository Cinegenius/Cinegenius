import Link from 'next/link';
import Image from '@/components/MediaImage';
import {Building2} from 'lucide-react';
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
 const paired = entries.length > 0 && organizations.length > 0;
 return <section className="py-5 sm:py-7" aria-labelledby="home-industry-title"><div className="site-container">
  <div className="mb-3 flex min-w-0 flex-wrap items-end justify-between gap-x-5 gap-y-1">
   <div className="min-w-0"><p className="mb-1 text-xs uppercase tracking-widest text-gold">{t('eyebrow')}</p><h2 id="home-industry-title" className="break-words font-serif text-xl leading-snug text-text-primary sm:text-2xl">{t('title')}</h2></div>
   <Link href="/news" className="inline-flex min-h-11 min-w-0 items-center gap-1 text-sm text-gold hover:text-gold-light"><span className="break-words">{t('allEntries')}</span><span aria-hidden="true">→</span></Link>
  </div>
  <div className={`grid min-w-0 items-start gap-6 lg:gap-9 ${paired ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : ''}`}>
   {entries.length > 0 && <div className="min-w-0 space-y-2">
    {entries.map(entry => {
     const org = (Array.isArray(entry.organization) ? entry.organization[0] : entry.organization) as unknown as {slug:string;name:string;logo_url:string|null};
     const date = entry.entry_type === 'news' ? entry.created_at : entry.starts_at;
     return <article key={entry.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_6rem] items-start gap-x-3 rounded-xl border border-border bg-bg-secondary px-3 py-1 sm:grid-cols-[minmax(0,1fr)_8rem] lg:grid-cols-[minmax(0,1fr)_9rem]">
      <Link href={`/news/${org.slug}/${entry.slug}`} className="group flex min-h-11 min-w-0 items-start gap-3 py-1">
       {entry.image_url && <Image src={entry.image_url} alt="" width={80} height={56} sizes="80px" className="mt-0.5 hidden h-14 w-20 shrink-0 rounded-md object-cover sm:block"/>}
       <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] leading-snug"><span className="break-words text-gold">{entryT(`entryType.${entry.entry_type}`)}</span>{date && <time dateTime={date} className="text-text-muted">{dates.format(new Date(date))}</time>}</div>
        <h3 className="mt-1 line-clamp-2 break-words text-sm font-semibold leading-snug text-text-primary transition-colors group-hover:text-gold sm:text-base [overflow-wrap:anywhere]">{entry.title}</h3>
        {entry.summary && <p className="mt-1 line-clamp-1 break-words text-xs leading-relaxed text-text-secondary">{entry.summary}</p>}
       </div>
      </Link>
      <Link href={`/organizations/${org.slug}`} aria-label={org.name} title={org.name} className="inline-flex min-h-11 min-w-0 items-center justify-center self-center py-1 text-xs leading-snug text-text-muted hover:text-gold">
       {org.logo_url ? <Image src={org.logo_url} alt="" width={64} height={48} sizes="64px" className="h-12 w-16 shrink-0 object-contain"/> : <span className="line-clamp-2 min-w-0 break-words [overflow-wrap:anywhere]">{org.name}</span>}
      </Link>
     </article>;
    })}
   </div>}
   {organizations.length > 0 && <div className="min-w-0">
    <div className="mb-1 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1"><h3 className="font-serif text-lg text-text-primary">{t('organizations')}</h3><Link href="/organizations" className="inline-flex min-h-11 min-w-0 items-center text-xs text-gold hover:text-gold-light"><span className="break-words">{t('allOrganizations')}</span><span className="ml-1" aria-hidden="true">→</span></Link></div>
    <ul className={`grid min-w-0 auto-rows-fr grid-cols-2 gap-2 ${paired ? '' : 'sm:grid-cols-3'}`}>
     {organizations.map(org => <li key={org.id} className="min-w-0">
      <Link href={`/organizations/${org.slug}`} className="group flex h-full min-h-11 min-w-0 items-center gap-2 rounded-xl border border-border bg-bg-secondary px-2 py-3 transition-colors hover:border-gold/40 hover:bg-bg-elevated">
       <span className="flex h-11 w-11 shrink-0 items-center justify-center">
        {org.logo_url ? <Image src={org.logo_url} alt="" width={44} height={44} sizes="44px" className="h-11 w-11 object-contain"/> : <Building2 size={22} aria-hidden="true" className="text-text-muted"/>}
       </span>
       <span className="min-w-0 flex-1"><span className="line-clamp-2 break-words text-sm font-semibold leading-snug text-text-secondary transition-colors group-hover:text-gold [overflow-wrap:anywhere]">{org.name}</span>{org.city && <span className="mt-0.5 line-clamp-1 break-words text-xs leading-snug text-text-muted">{org.city}</span>}</span>
      </Link>
     </li>)}
    </ul>
   </div>}
  </div>
 </div></section>;
}
