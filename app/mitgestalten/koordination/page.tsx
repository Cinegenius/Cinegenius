import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser, isAdminSession } from '@/lib/auth';
import PageHeader from '@/components/PageHeader';
import FeedbackCoordination from '@/components/FeedbackCoordination';
export const dynamic = 'force-dynamic';
export const metadata = { robots: {index:false,follow:false} };
export default async function FeedbackCoordinationPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in?redirect_url=%2Fmitgestalten%2Fkoordination');
  if (!await isAdminSession()) redirect('/mitgestalten');
  const t = await getTranslations('Feedback');
  return <main className="min-h-screen pb-[calc(7rem+env(safe-area-inset-bottom))]">
    <PageHeader badge="CineGenius" title={t('overview')} description={t('inviteHint')} withBackdrop={false} />
    <div className="site-container py-6"><FeedbackCoordination accountId={user.userId} key={user.userId} /></div>
  </main>;
}
