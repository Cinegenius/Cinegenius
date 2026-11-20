import Link from 'next/link';
import {getLocale,getTranslations} from 'next-intl/server';
import PageHeader from '@/components/PageHeader';
import {OrganizationCards} from '@/components/organizations/PublicOrganizationLinks';
import {organizationDirectory} from '@/lib/organization-directory';
import {browseCountryChoice} from '@/lib/browse-country';
import {organizationDirectoryHref} from '@/lib/organization-directory-filters';
import NativeOrganizations from '@/components/app/NativeOrganizations';
export const dynamic='force-dynamic';
export default async function OrganizationsPage({searchParams}:{searchParams:Promise<{page?:string;country?:string|string[];city?:string;q?:string}>}) {
 const [params,t,locale]=await Promise.all([searchParams,getTranslations('OrganizationDiscovery'),getLocale()]);
 // Invalid legacy URLs use the visibly selected All countries fallback.
 const country=browseCountryChoice(params.country)??'';
 const page=Math.min(10000,Math.max(1,Math.floor(Number(params.page)||1)));
 const data=await organizationDirectory({country,page,city:typeof params.city==='string'?params.city.slice(0,220):'',q:typeof params.q==='string'?params.q.trim().slice(0,120):''},locale,AbortSignal.timeout(20_000));
 const {organizations,hasMore}=data;
 const newsHref=country?`/news?${new URLSearchParams({country})}`:'/news';
 return <NativeOrganizations data={data}><main className="min-h-screen bg-bg-primary"><PageHeader badge={t("eyebrow")} title={t('organizations')} description={t('description')}/><section className="site-container py-8"><Link href={newsHref} className="mb-6 inline-block py-3 text-gold">{t('allEntries')} →</Link>
 {organizations.length?<OrganizationCards organizations={organizations}/>:<p className="text-text-muted">{t('empty')}</p>}
 <nav className="mt-6 flex flex-wrap gap-6" aria-label={t('pages')}>{page>1&&<Link className="py-3 text-gold" href={organizationDirectoryHref({...data.filters,page:page-1})}>{t('previous')}</Link>}{hasMore&&<Link className="py-3 text-gold" href={organizationDirectoryHref({...data.filters,page:page+1})}>{t('next')}</Link>}</nav></section></main></NativeOrganizations>;
}
