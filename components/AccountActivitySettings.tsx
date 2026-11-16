'use client';
import { useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import type { AccountActivityStatus } from '@/lib/account-activity';

export default function AccountActivitySettings({ accountId }: { accountId: string | null }) {
  const t = useTranslations('AccountActivity');
  const format = useFormatter();
  const [result, setResult] = useState<{ account: string; data?: AccountActivityStatus; error?: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!accountId) return;
    const controller = new AbortController();
    fetch('/api/account/activity', { cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => { if (!controller.signal.aborted) setResult({ account: accountId, data }); })
      .catch(() => { if (!controller.signal.aborted) setResult({ account: accountId, error: true }); });
    const refresh = () => setRetry(value => value + 1);
    window.addEventListener('cg:account-reactivated', refresh);
    return () => { controller.abort(); window.removeEventListener('cg:account-reactivated', refresh); };
  }, [accountId, retry]);
  if (!accountId) return null;
  const current = result?.account === accountId ? result : null;
  const date = current?.data?.state?.lastActivityAt;
  return <section className="min-w-0 rounded-xl border border-border bg-bg-secondary p-5 [overflow-wrap:anywhere]">
    <h3 className="font-semibold text-text-primary">{t('title')}</h3>
    <p className="mt-2 text-sm leading-6 text-text-secondary">{t('schedule')}</p>
    <p className="mt-2 text-sm leading-6 text-text-muted">{t('preserved')}</p>
    {!current ? <p role="status" className="mt-3 text-sm">{t('loading')}</p> : current.error ? <div role="alert" className="mt-3 text-sm"><p>{t('error')}</p><button type="button" className="mt-2 min-h-11 rounded-lg border border-border px-4 py-2" onClick={() => { setResult(null); setRetry(value => value + 1); }}>{t('retry')}</button></div> : <p role="status" className="mt-3 text-sm text-text-secondary">{!current.data?.enabled ? t('disabled') : current.data.state?.exempt ? t('exempt') : date ? t('lastActivity', { date: format.dateTime(new Date(date), { dateStyle: 'medium' }) }) : t('pending')}</p>}
  </section>;
}
