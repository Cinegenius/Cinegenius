'use client';

import { useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { ACTIVITY_UPDATED_EVENT, requestAccountActivity, type AccountActivityStatus } from '@/lib/account-activity-client';

type LoadState = { kind: 'loading' | 'error' } | { kind: 'ready'; data: AccountActivityStatus };

function ActivityStatus({ data }: { data: AccountActivityStatus }) {
  const t = useTranslations('AccountActivity');
  const format = useFormatter();
  if (!data.enabled) return <p role="status" className="mt-4 text-sm text-text-muted">{t('disabled')}</p>;
  if (!data.state) return <p role="status" className="mt-4 text-sm text-text-muted">{t('pending')}</p>;
  if (data.state.exempt) return <p role="status" className="mt-4 text-sm text-text-muted">{t('exempt')}</p>;
  const state = data.state;
  const dates = [
    ['lastActivityAt', state.lastActivityAt], ['reminderAt', state.reminderAt],
    ['warningAt', state.warningAt], ['pauseAt', state.pauseAt],
    ['deletionNoticeAt', state.deletionNoticeAt],
    ...(state.reviewAfter ? [['reviewAfter', state.reviewAfter]] : []),
  ];
  return <>
    <p role="status" className="mt-4 text-sm font-semibold text-text-primary">{t('states.' + state.stage)}</p>
    <dl className="mt-3 grid min-w-0 gap-3 text-sm sm:grid-cols-2">
      {dates.map(([key, value]) => <div key={key} className="min-w-0">
        <dt className="text-text-muted">{t('dates.' + key)}</dt>
        <dd className="mt-1 text-text-primary"><time dateTime={value}>{format.dateTime(new Date(value), { dateStyle: 'medium' })}</time></dd>
      </div>)}
    </dl>
    <p className="mt-4 text-xs leading-5 text-text-muted">{t('dateNotice')}</p>
  </>;
}

function AccountActivityPanel() {
  const t = useTranslations('AccountActivity');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    let request: AbortController | null = null;
    async function load() {
      request?.abort();
      const controller = new AbortController(); request = controller;
      setState({ kind: 'loading' });
      try {
        const data = await requestAccountActivity('GET', controller.signal);
        if (!disposed && !controller.signal.aborted && request === controller) setState({ kind: 'ready', data });
      } catch {
        if (!disposed && !controller.signal.aborted && request === controller) setState({ kind: 'error' });
      }
    }
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const events = [ACTIVITY_UPDATED_EVENT, 'cinegenius:app-resume', 'online'];
    for (const event of events) window.addEventListener(event, refresh);
    document.addEventListener('visibilitychange', refresh);
    void load();
    return () => {
      disposed = true; request?.abort();
      for (const event of events) window.removeEventListener(event, refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [attempt]);
  return <section className="min-w-0 rounded-xl border border-border bg-bg-secondary p-5 [overflow-wrap:anywhere]" aria-busy={state.kind === 'loading'}>
    <h3 className="font-semibold text-text-primary">{t('title')}</h3>
    <p className="mt-2 text-sm leading-6 text-text-secondary">{t('schedule')}</p>
    <p className="mt-2 text-sm leading-6 text-text-muted">{t('preserved')}</p>
    {state.kind === 'loading' && <p role="status" className="mt-4 text-sm text-text-muted">{t('loading')}</p>}
    {state.kind === 'error' && <div role="alert" className="mt-4 text-sm text-text-secondary">
      <p>{t('error')}</p>
      <button type="button" className="mt-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border px-4 py-2" onClick={() => setAttempt(value => value + 1)}>{t('retry')}</button>
    </div>}
    {state.kind === 'ready' && <ActivityStatus data={state.data} />}
  </section>;
}

export default function AccountActivitySettings({ accountId }: { accountId: string | null }) {
  // A->B->A also starts a fresh panel; no former account's data is briefly reused.
  return accountId ? <AccountActivityPanel key={accountId} /> : null;
}
