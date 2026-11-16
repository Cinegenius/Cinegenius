'use client';
import { useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { ACCOUNT_ACTIVITY_STAGES, type AccountActivityStage } from '@/lib/account-activity';
type Row = { user_id: string; stage: AccountActivityStage; last_activity_at: string; review_after: string | null; issue: string | null };
export default function AdminAccountActivity({ selectAccount }: { selectAccount: (id: string) => void }) {
  const t = useTranslations('AccountActivity');
  const format = useFormatter();
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ page: number; retry: number; enabled: boolean; accounts: Row[]; total: number } | null>(null);
  const [error, setError] = useState(false);
  const loading = result?.page !== page || result.retry !== retry;
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/account-inactivity?page=${page}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => { if (!controller.signal.aborted) { setResult({ ...data, page, retry }); setError(false); } })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [page, retry]);
  const button = 'min-h-11 rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50';
  return <section className="min-w-0 space-y-3 rounded-xl border border-border p-4 [overflow-wrap:anywhere]">
    <h2 className="font-semibold">{t('adminTitle')}</h2><p className="text-sm leading-6 text-text-secondary">{t('adminDescription')}</p>
    {error ? <p role="alert">{t('error')}</p> : loading ? <p role="status">{t('loading')}</p> : !result.enabled ? <p>{t('disabled')}</p> : !result.accounts.length ? <p>{t('empty')}</p> : <ul className="space-y-3">{result.accounts.map(row => <li key={row.user_id} className="flex min-w-0 flex-wrap items-center gap-3 border-t border-border pt-3"><div className="min-w-0 flex-1 basis-44"><p className="break-all text-sm">{row.user_id}</p><p className="text-sm">{t(`states.${ACCOUNT_ACTIVITY_STAGES.includes(row.stage) ? row.stage : 'review'}`)}</p><p className="text-xs text-text-muted">{t('lastActivity', { date: format.dateTime(new Date(row.last_activity_at), { dateStyle: 'medium' }) })}</p>{row.issue && <p className="text-xs text-gold">{t(row.issue === 'retention_review' ? 'retentionReview' : 'deliveryProblem')}</p>}</div><button className={button} onClick={() => selectAccount(row.user_id)}>{t('inspect')}</button></li>)}</ul>}
    <div className="flex flex-wrap gap-2"><button className={button} onClick={() => { setError(false); setRetry(value => value + 1); }}>{t('retry')}</button><button className={button} disabled={page === 1} onClick={() => { setError(false); setPage(value => value - 1); }}>{t('previous')}</button><button className={button} disabled={loading || page * 25 >= (result?.total ?? 0)} onClick={() => { setError(false); setPage(value => value + 1); }}>{t('next')}</button></div>
  </section>;
}
