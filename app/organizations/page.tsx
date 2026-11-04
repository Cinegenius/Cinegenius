import Link from 'next/link';
import {getTranslations} from 'next-intl/server';
import PageHeader from '@/components/PageHeader';
import {OrganizationCards} from '@/components/organizations/PublicOrganizationLinks';
import {organizationDiscovery} from '@/lib/organization-discovery';
export const dynamic='force-dynamic';
export default async function OrganizationsPage({searchParams}:{searchParams:Promise<{page?:string}>}) {
 const [params,t]=await Promise.all([searchParams,getTranslations('OrganizationDiscovery')]);
 const {organizations,hasMore,page}=await organizationDiscovery(Number(params.page)||1);
 return <main className="min-h-screen bg-bg-primary"><PageHeader badge={t("eyebrow")} title={t('organizations')} description={t('description')}/><section className="site-container py-8"><Link href="/news" className="mb-6 inline-block py-3 text-gold">{t('allEntries')} →</Link>
 {organizations.length?<OrganizationCards organizations={organizations}/>:<p className="text-text-muted">{t('empty')}</p>}
 <nav className="mt-6 flex flex-wrap gap-6" aria-label={t('pages')}>{page>1&&<Link className="py-3 text-gold" href={`/organizations?page=${page-1}`}>{t('previous')}</Link>}{hasMore&&<Link className="py-3 text-gold" href={`/organizations?page=${page+1}`}>{t('next')}</Link>}</nav></section></main>;
}
