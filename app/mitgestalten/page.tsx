import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import { getCurrentUser, isAdminSession } from '@/lib/auth';
import { isAppLocale } from '@/lib/i18n/locales';
import { COUNTRY_CODES } from '@/lib/places/countries';
import PageHeader from '@/components/PageHeader';
import CommunityFeedback from '@/components/CommunityFeedback';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function FeedbackPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params = await searchParams;
  const language = isAppLocale(params.lang) ? params.lang : await getLocale();
  const country = typeof params.country === 'string' && (COUNTRY_CODES as readonly string[]).includes(params.country) ? params.country : '';
  const query = new URLSearchParams({lang:language,...(country ? {country} : {})});
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?redirect_url=${encodeURIComponent('/mitgestalten?'+query)}`);
  const t = await getTranslations('Feedback');
  const admin = await isAdminSession();
  const conversationCopy = await getTranslations({locale:language,namespace:'Feedback'});
  return <main className="min-h-screen pb-[calc(7rem+env(safe-area-inset-bottom))]">
    <PageHeader badge="CineGenius" title={t('title')} description={t('intro')} withBackdrop={false} />
    <div className="site-container py-6">
      {admin && <div className="mx-auto mb-4 max-w-3xl"><Link href="/mitgestalten/koordination" className="inline-flex min-h-11 items-center text-sm text-text-muted hover:text-gold">{t('overview')}</Link></div>}
      <CommunityFeedback key={user.userId} accountId={user.userId} initialLanguage={language} initialCountry={country} initialOpening={conversationCopy("opening")} />
    </div>
  </main>;
}
