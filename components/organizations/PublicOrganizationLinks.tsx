import Link from 'next/link';
import Image from '@/components/MediaImage';
import {getTranslations} from 'next-intl/server';
import {publicOrganizationLinks, type PublicOrganization} from '@/lib/organization-discovery';
export function OrganizationCards({organizations, compact = false}:{organizations:PublicOrganization[]; compact?:boolean}) {
 return <ul className={compact ? "grid min-w-0 grid-cols-[minmax(0,21rem)] gap-3 sm:grid-cols-[repeat(2,minmax(0,21rem))] lg:grid-cols-[repeat(3,minmax(0,21rem))]" : "grid min-w-0 gap-3 sm:grid-cols-2"}>{organizations.map(org=><li key={org.id}><Link href={`/organizations/${org.slug}`} className={`browse-card flex h-full min-w-0 items-center gap-3 ${compact ? "p-3" : "p-4"}`}>
 {org.logo_url&&<Image src={org.logo_url} alt="" width={96} height={72} className={`${compact ? "h-12 w-16" : "h-16 w-20"} shrink-0 object-contain`}/>}
 <span className="min-w-0 break-words"><span className={compact ? "line-clamp-2 text-sm font-semibold leading-snug" : "block font-semibold"}>{org.name}</span>{org.city&&<span className="text-sm text-text-muted">{org.city}</span>}</span>
 </Link></li>)}</ul>;
}
export default async function PublicOrganizationLinks(props:{userId:string}|{companyId:string}) {
 const t=await getTranslations('OrganizationDiscovery');
 let organizations: PublicOrganization[];
 try { organizations=await publicOrganizationLinks(props); }
 catch { console.error('Public organization links unavailable'); return null; }
 if(!organizations.length)return null;
 return <section className="my-6 min-w-0"><h2 className="mb-4 font-serif text-xl">{t('profileTitle')}</h2><OrganizationCards organizations={organizations}/></section>;
}
