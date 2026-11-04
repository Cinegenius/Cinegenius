import Link from 'next/link';
import Image from '@/components/MediaImage';
import {getTranslations} from 'next-intl/server';
import {organizationDiscovery,latestOrganizationEntries} from '@/lib/organization-discovery';
import {OrganizationCards} from './PublicOrganizationLinks';
export default async function HomeOrganizations() {
 const [t,entryT]=await Promise.all([getTranslations('OrganizationDiscovery'),getTranslations('Organizations')]);
 let organizations,entries;
 try {const results=await Promise.all([organizationDiscovery(1,6),latestOrganizationEntries()]);organizations=results[0].organizations;entries=results[1];}
 catch {console.error('homepage_organization_discovery_unavailable');return null;}
 if(!organizations.length&&!entries.length)return null;
 return <section className="border-b border-border bg-bg-primary py-10 sm:py-14"><div className="site-container">
 <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs uppercase tracking-widest text-gold">{t('eyebrow')}</p><h2 className="font-serif text-2xl sm:text-3xl">{t('title')}</h2></div><Link href="/news" className="min-h-11 py-3 text-gold">{t('allEntries')} →</Link></div>
 <div className="grid gap-4 md:grid-cols-3">{entries.map(entry=>{const org=(Array.isArray(entry.organization)?entry.organization[0]:entry.organization) as unknown as {slug:string;name:string};return <article key={entry.id} className="browse-card overflow-hidden">
 <Link href={`/news/${org.slug}/${entry.slug}`} className="block">{entry.image_url&&<div className="relative aspect-[16/9]"><Image src={entry.image_url} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover"/></div>}<div className="p-5"><p className="text-xs text-gold">{entryT(`entryType.${entry.entry_type}`)}</p><h3 className="mt-2 break-words text-lg font-semibold">{entry.title}</h3>{entry.summary&&<p className="mt-2 line-clamp-2 text-sm text-text-secondary">{entry.summary}</p>}</div></Link>
 <Link href={`/organizations/${org.slug}`} className="mx-5 mb-4 block break-words py-2 text-sm text-gold">{org.name}</Link></article>;})}</div>
 {organizations.length>0&&<div className="mt-8"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-serif text-xl">{t('organizations')}</h3><Link href="/organizations" className="min-h-11 py-3 text-sm text-gold">{t('allOrganizations')} →</Link></div><OrganizationCards organizations={organizations}/></div>}
 </div></section>;
}
