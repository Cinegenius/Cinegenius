export const ACCOUNT_ACTIVITY_STAGES = ['active', 'reminder', 'warning', 'paused', 'deletion_pending', 'review'] as const;
export type AccountActivityStage = typeof ACCOUNT_ACTIVITY_STAGES[number];
export type AccountActivityNotice = Exclude<AccountActivityStage, 'active'> | 'reactivated' | 'policy';
export type AccountActivityStatus = {
  enabled: boolean;
  state: null | {
    stage: AccountActivityStage;
    lastActivityAt: string;
    reminderAt: string;
    warningAt: string;
    pauseAt: string;
    deletionNoticeAt: string;
    reviewAfter: string | null;
    exempt: boolean;
  };
  reactivated?: boolean;
};

/** Calendar months, clamped to the last day; matches Postgres UTC intervals. */
export function activityMonthDate(iso: string, months: number): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime()) || !Number.isInteger(months)) throw new Error('invalid_activity_date');
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString();
}

export function accountActivityEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === 'production' && env.ACCOUNT_INACTIVITY_ENABLED === 'true';
}
