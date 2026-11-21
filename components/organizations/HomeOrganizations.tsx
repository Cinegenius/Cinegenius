import { TranslatedText } from "@/components/ContentTranslation";
import Link from 'next/link';
import Image from '@/components/MediaImage';
import ListingImage from '@/components/ListingImage';
import {newsPreviewImage} from '@/lib/news-gallery';
import {Building2} from 'lucide-react';
import {getLocale, getTranslations} from 'next-intl/server';
import {organizationDiscovery, latestOrganizationEntries} from '@/lib/organization-discovery';
import {newsRegion} from '@/lib/news-region-server';
import {homeNewsFacets} from '@/lib/news-discovery';
import {homeNewsTopic} from '@/lib/news-topic-server';
import {isOrganizationTopic, type OrganizationTopic} from '@/lib/organization-taxonomy';
import HomeNewsRegion from './HomeNewsRegion';
import HomeCardRail from '@/components/HomeCardRail';

export default async function HomeOrganizations() {
 const [t, entryT, newsT, galleryT, locale, region] = await Promise.all([
  getTranslations('OrganizationDiscovery'), getTranslations('Organizations'), getTranslations('NewsRegion'), getTranslations('NewsGallery'), getLocale(), newsRegion(),
 ]);
 const topic = await homeNewsTopic(region.cookieName);
 const selectedTopic = topic.selection === 'all' ? '' : topic.selection;
 const newsHref = `/news?${new URLSearchParams({country: region.selection, topic: topic.selection})}`;
 let organizations: Awaited<ReturnType<typeof organizationDiscovery>>['organizations'] = [];
 let entries: Awaited<ReturnType<typeof latestOrganizationEntries>> = [], codes: string[] = [], failed = false;
 let topics: OrganizationTopic[] = [];
 try {
  const results = await Promise.all([organizationDiscovery(1, 6), latestOrganizationEntries(region.country, selectedTopic, 12), homeNewsFacets(region.country, selectedTopic)]);
  organizations = results[0].organizations;
  entries = results[1];
  codes = results[2].codes;
  topics = results[2].topics;
 } catch {
  console.error('homepage_organization_discovery_unavailable');
  failed = true;
 }
 const dates = new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeZone: 'Europe/Berlin'});
 const paired = entries.length > 0 && organizations.length > 0;
 return <section className="home-section-divider home-section-divider--wide py-5 sm:py-7" aria-labelledby="home-industry-title"><div className="site-container">
  <div className="mb-3 flex min-w-0 flex-wrap items-end justify-between gap-x-5 gap-y-1">
   <div className="min-w-0"><p className="mb-1 text-xs uppercase tracking-widest text-gold">{t('eyebrow')}</p><h2 id="home-industry-title" className="break-words font-serif text-xl leading-snug text-text-primary sm:text-2xl">{entryT('newsTitleLead')} <span className="text-gold">{entryT('newsTitleHighlight')}</span></h2></div>
   <Link href={newsHref} className="inline-flex min-h-11 min-w-0 items-center gap-1 text-sm text-gold hover:text-gold-light"><span className="break-words">{t('allEntries')}</span><span aria-hidden="true">→</span></Link>
  </div>
  <div className={`grid min-w-0 items-start gap-3 lg:gap-x-9 ${paired ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : ''}`}>
   <HomeNewsRegion key={region.cookieName} region={region} codes={codes} topic={topic} topics={topics} empty={!entries.length} failed={failed}/>
   {entries.length > 0 && <div className="min-w-0 lg:col-start-1">
   <HomeCardRail id="home-news-rail" labelledBy="home-industry-title" hint={newsT('railHint')} itemCount={Math.ceil(entries.length / 3)} variant="news">
    {Array.from({length: Math.ceil(entries.length / 3)}, (_, page) => <div key={page} className="grid min-w-0 content-start gap-2">
    {entries.slice(page * 3, page * 3 + 3).map(entry => {
     const org = (Array.isArray(entry.organization) ? entry.organization[0] : entry.organization) as unknown as {slug:string;name:string;logo_url:string|null};
     const date = entry.entry_type === 'news' ? entry.created_at : entry.starts_at;
     const photo = newsPreviewImage(entry.image_url, entry.image_gallery);
     return <article key={entry.id} className="min-w-0 rounded-xl border border-border bg-bg-secondary px-3 py-2">
      <Link href={`/news/${org.slug}/${entry.slug}`} className="group flex min-h-11 min-w-0 items-start gap-3 rounded-md py-1 focus-visible:outline-2 focus-visible:outline-gold">
       {photo && <ListingImage src={photo.url} alt="" width={80} height={64} sizes="80px" loading="lazy" className="mt-0.5 h-16 w-20 shrink-0 rounded-md object-contain"/>}
       <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] leading-snug"><span className="break-words text-gold">{entryT(`entryType.${entry.entry_type}`)}{isOrganizationTopic(entry.topic) && <> · {entryT(`topic.${entry.topic}`)}</>}</span>{date && <time dateTime={date} className="text-text-muted">{dates.format(new Date(date))}</time>}</div>
        <h3 className="mt-1 line-clamp-2 break-words text-sm font-semibold leading-snug text-text-primary transition-colors group-hover:text-gold sm:text-base [overflow-wrap:anywhere]"><TranslatedText kind="news" id={entry.id} field="title">{entry.title}</TranslatedText></h3>
        {entry.summary && <p className="mt-1 line-clamp-1 break-words text-xs leading-relaxed text-text-secondary"><TranslatedText kind="news" id={entry.id} field="summary">{entry.summary}</TranslatedText></p>}
        <p className="mt-1 line-clamp-1 break-words text-[11px] leading-snug text-text-muted" title={org.name}>{org.name}</p>
        {photo?.creator && <p className="mt-0.5 line-clamp-1 break-words text-[10px] leading-snug text-text-muted" title={[photo.creator, photo.licenseName, photo.attribution, photo.credit].filter(Boolean).join(' · ')}>{galleryT('creator')}: {photo.creator} · {photo.licenseName}</p>}
       </div>
      </Link>
     </article>;
    })}
    </div>)}
   </HomeCardRail>
   </div>}
   {organizations.length > 0 && <div className={`min-w-0 ${paired ? 'home-section-divider home-section-divider--organizations mt-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:grid lg:grid-rows-subgrid lg:self-stretch' : ''}`}>
    <div className={`mb-1 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 ${paired ? 'lg:mb-0 lg:self-end' : ''}`}><h3 className="font-serif text-lg text-text-primary">{t('organizations')}</h3><Link href="/organizations" className="inline-flex min-h-11 min-w-0 items-center text-xs text-gold hover:text-gold-light"><span className="break-words">{t('allOrganizations')}</span><span className="ml-1" aria-hidden="true">→</span></Link></div>
    <ul className={`grid min-w-0 auto-rows-fr grid-cols-2 gap-2 self-start ${paired ? '' : 'sm:grid-cols-3'}`}>
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
