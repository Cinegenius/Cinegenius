/** Client contract only. Account identity, deadlines and activity time belong to the server. */
export const ACTIVITY_STAGES = ['active', 'reminder', 'warning', 'paused', 'deletion_pending', 'review'] as const;
export type ActivityStage = typeof ACTIVITY_STAGES[number];
export type AccountActivityStatus = {
  enabled: boolean;
  state: null | {
    stage: ActivityStage;
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

const DATE_KEYS = ['lastActivityAt', 'reminderAt', 'warningAt', 'pauseAt', 'deletionNoticeAt'] as const;
export const ACTIVITY_UPDATED_EVENT = 'cg:account-activity-updated';
export const ACTIVITY_INTERVAL_MS = 60 * 60 * 1000;
const RETRY_MS = 60_000;

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function utcDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 19) === value.slice(0, 19);
}

export function isAccountActivityStatus(value: unknown): value is AccountActivityStatus {
  if (!record(value) || typeof value.enabled !== 'boolean' || !Object.hasOwn(value, 'state')) return false;
  if (value.reactivated !== undefined && typeof value.reactivated !== 'boolean') return false;
  if (!value.enabled) return value.state === null && value.reactivated !== true;
  if (value.state === null) return value.reactivated !== true;
  const state = value.state;
  if (!record(state) || !ACTIVITY_STAGES.includes(state.stage as ActivityStage) || typeof state.exempt !== 'boolean') return false;
  if (!DATE_KEYS.every(key => utcDate(state[key])) || !(state.reviewAfter === null || utcDate(state.reviewAfter))) return false;
  return value.reactivated !== true || state.stage === 'active';
}

export class AccountActivityError extends Error {
  readonly status: number;
  readonly retryMs: number;
  constructor(status = 0, retryMs = RETRY_MS) {
    super('account_activity_unavailable');
    this.status = status;
    this.retryMs = retryMs;
  }
}

function retryDelay(value: string | null) {
  if (!value) return RETRY_MS;
  const delay = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(delay) ? Math.max(RETRY_MS, Math.min(delay, 24 * ACTIVITY_INTERVAL_MS)) : RETRY_MS;
}

export async function requestAccountActivity(method: 'GET' | 'POST', signal: AbortSignal): Promise<AccountActivityStatus> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) controller.abort();
  const timeout = setTimeout(abort, 12_000);
  try {
    const response = await fetch('/api/account/activity', {
      method, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: { Accept: 'application/json' }, signal: controller.signal,
      // Intentionally no body, account ID, timestamp, bearer token or background delivery.
    });
    if (!response.ok) throw new AccountActivityError(response.status, retryDelay(response.headers.get('retry-after')));
    if (response.redirected || !response.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new AccountActivityError();
    const body: unknown = await response.json();
    if (!isAccountActivityStatus(body)) throw new AccountActivityError();
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    return body;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}

type ActivityEnvironment = {
  page: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
  events: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  online: () => boolean;
  now: () => number;
  request: typeof requestAccountActivity;
  confirmed: (status: AccountActivityStatus) => void;
};

/** One instance per confirmed Clerk session. Dispose before accepting another account. */
export function trackAccountActivity(environment: ActivityEnvironment): () => void {
  let disposed = false;
  let nextAttempt = -Infinity;
  let pending: AbortController | null = null;
  const foreground = () => environment.page.visibilityState === 'visible' && environment.online();
  async function send() {
    if (disposed || pending || !foreground() || environment.now() < nextAttempt) return;
    const controller = new AbortController();
    pending = controller;
    try {
      const status = await environment.request('POST', controller.signal);
      if (disposed || controller.signal.aborted || pending !== controller) return;
      // Disabled is a valid capability response, never an activity acknowledgement.
      const active = status.enabled && status.state?.stage === 'active';
      nextAttempt = environment.now() + (!status.enabled || active ? ACTIVITY_INTERVAL_MS : RETRY_MS);
      if (active) environment.confirmed(status);
    } catch (error) {
      if (!disposed && !controller.signal.aborted && pending === controller) {
        nextAttempt = environment.now() + (error instanceof AccountActivityError ? error.retryMs : RETRY_MS);
      }
    } finally {
      if (pending === controller) pending = null;
    }
  }
  const resume = () => { void send(); };
  const visibility = () => {
    if (environment.page.visibilityState !== 'visible') {
      pending?.abort(); pending = null;
    } else resume();
  };
  const interaction = (event: Event) => { if (event.isTrusted) resume(); };
  const entryEvents = ['pageshow', 'online', 'cinegenius:app-resume'];
  for (const event of entryEvents) environment.events.addEventListener(event, resume);
  environment.page.addEventListener('visibilitychange', visibility);
  environment.page.addEventListener('pointerdown', interaction, { passive: true });
  environment.page.addEventListener('keydown', interaction);
  resume();
  return () => {
    disposed = true; pending?.abort(); pending = null;
    for (const event of entryEvents) environment.events.removeEventListener(event, resume);
    environment.page.removeEventListener('visibilitychange', visibility);
    environment.page.removeEventListener('pointerdown', interaction);
    environment.page.removeEventListener('keydown', interaction);
  };
}
