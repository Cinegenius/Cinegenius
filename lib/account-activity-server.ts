import 'server-only';
import { randomUUID } from 'node:crypto';
import { clerkClient } from '@clerk/nextjs/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { db } from '@/lib/db';
import { isConfiguredAdmin } from '@/lib/admin-policy';
import { appLocale, DEFAULT_LOCALE } from '@/lib/i18n/locales';
import { localizedNotification } from '@/lib/i18n/notification-copy';
import { accountActivityEnabled, activityMonthDate, type AccountActivityNotice, type AccountActivityStatus } from '@/lib/account-activity';
import { buildAccountActivityEmail } from '@/lib/account-activity-email';
import { getListingReminderDeliveryStatus as deliveryStatus, isFrozenListingReminderEmail, sendListingReminderEmail as sendEmail } from '@/lib/listing-freshness-email';

const HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store' };
export const ACCOUNT_ACTIVITY_HEADERS = HEADERS;
function checked<T>(result: {data: T; error: unknown}): T {
  if (result.error) throw new Error('account_activity_unavailable');
  return result.data;
}
function invalidate() {
  revalidateTag('listings', { expire: 0 });
  revalidateTag('profiles', { expire: 0 });
  revalidatePath('/', 'layout');
}
export async function recordAccountActivity(userId: string, at = new Date().toISOString()) {
  if (!accountActivityEnabled()) return { reactivated: false };
  const result = checked(await db.rpc('record_account_activity', {
    p_user_id: userId, p_at: at, p_exempt: isConfiguredAdmin(userId, process.env.ADMIN_USER_IDS),
  }));
  if (result?.reactivated) invalidate();
  return { reactivated: result?.reactivated === true };
}
/** Erase this feature's private data after a verified account deletion, even if
 * reminders have since been disabled. Outbox payloads cascade with the account. */
export async function removeAccountActivity(userId: string) {
  checked(await db.from('account_activity').delete().eq('user_id', userId));
}
export async function getAccountActivity(userId: string): Promise<AccountActivityStatus> {
  if (!accountActivityEnabled()) return { enabled: false, state: null };
  const row = checked(await db.from('account_activity').select('stage,last_activity_at,review_after,exempt').eq('user_id', userId).maybeSingle());
  if (!row) return { enabled: true, state: null };
  return { enabled: true, state: { stage: row.stage, lastActivityAt: row.last_activity_at,
    reminderAt: activityMonthDate(row.last_activity_at, 12), warningAt: activityMonthDate(row.last_activity_at, 15),
    pauseAt: activityMonthDate(row.last_activity_at, 18), deletionNoticeAt: activityMonthDate(row.last_activity_at, 24),
    reviewAfter: row.review_after, exempt: row.exempt } };
}

/** One bounded daily run shared by website and app. No account deletion API is called. */
export async function runAccountActivityWorker() {
  const stats = { status: 'completed', enrolled: 0, checked: 0, sent: 0, errors: 0 };
  if (!accountActivityEnabled()) return { ...stats, status: 'disabled' };
  if (!process.env.RESEND_API_KEY) return { ...stats, status: 'not_configured' };
  const started = Date.now();
  const hasTime = () => Date.now() - started < 42_000;
  const lease = randomUUID();
  const offset = checked(await db.rpc('claim_account_activity_worker', { p_lease: lease }));
  if (offset === null) return { ...stats, status: 'busy' };
  let nextOffset = Number(offset);
  try {
    const clerk = await clerkClient();
    // Stable bounded discovery, including members without a public profile.
    const page = await clerk.users.getUserList({ limit: 100, offset: nextOffset, orderBy: '+created_at' });
    for (const user of page.data) {
      if (!hasTime()) break;
      await recordAccountActivity(user.id, new Date(user.lastSignInAt ?? user.createdAt).toISOString());
      stats.enrolled += 1;
      nextOffset += 1;
    }
    if (nextOffset >= page.totalCount) nextOffset = 0;
    const due = checked(await db.from('account_activity').select('user_id,cycle,stage,last_activity_at')
      .eq('exempt', false).lte('next_check_at', new Date().toISOString())
      .order('next_check_at').limit(40));
    for (const candidate of due ?? []) {
      if (!hasTime()) break;
      stats.checked += 1;
      try {
        const user = await clerk.users.getUser(candidate.user_id).catch(async error => {
          // Only a confirmed missing Clerk account authorizes cleanup. Temporary
          // provider failures must never be mistaken for an account deletion.
          if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
            await removeAccountActivity(candidate.user_id);
            return null;
          }
          throw error;
        });
        if (!user) continue;
        // A real sign-in protects the account even if the client activity request failed.
        // lastActiveAt is an additional conservative guard for older app versions.
        const observed = Math.max(user.lastSignInAt ?? 0, user.lastActiveAt ?? 0);
        if (observed > Date.parse(candidate.last_activity_at) || isConfiguredAdmin(user.id, process.env.ADMIN_USER_IDS)) {
          await recordAccountActivity(user.id, new Date(Math.max(observed, Date.now())).toISOString());
          // Already-active accounts can still receive their initial policy or
          // return notice. Recent provider activity must not starve that outbox.
          if (candidate.stage !== 'active' || isConfiguredAdmin(user.id, process.env.ADMIN_USER_IDS)) continue;
        }
        const primary = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId);
        if (!primary || primary.verification?.status !== 'verified') {
          checked(await db.from('account_activity').update({ issue: 'email_unverified', next_check_at: new Date(Date.now() + 86400000).toISOString() }).eq('user_id', user.id).eq('cycle', candidate.cycle));
          continue;
        }
        // Confirm the current recipient and provider outcome before consequences.
        const receipts = ['reminder', 'warning', 'deletion_pending'].includes(candidate.stage)
          ? checked(await db.from('account_activity_outbox').select('*')
            .eq('user_id', user.id).eq('cycle', candidate.cycle).eq('stage', candidate.stage).in('status', ['sent', 'delivered'])) : [];
        let verifiedDelivery = false;
        for (const receipt of receipts ?? []) {
          if (!hasTime()) break;
          const outcome = receipt.payload?.to?.toLowerCase() === primary.emailAddress.toLowerCase()
            ? await deliveryStatus(receipt.provider_id, primary.emailAddress) : 'recipient_changed';
          checked(await db.rpc('confirm_account_activity_delivery', { p_id: receipt.id, p_cycle: candidate.cycle, p_outcome: outcome, p_recipient: primary.emailAddress }));
          verifiedDelivery = outcome === 'delivered';
        }
        // Unavailable receipt lookups cannot hide or queue deletion of an account.
        if (!['reminder', 'warning', 'deletion_pending'].includes(candidate.stage) || verifiedDelivery) {
          const advanced = checked(await db.rpc('advance_account_activity', { p_user_id: user.id, p_cycle: candidate.cycle }));
          if (advanced?.changed) invalidate();
        } else {
          checked(await db.from('account_activity').update({ next_check_at: new Date(Date.now() + 86400000).toISOString() }).eq('user_id', user.id).eq('cycle', candidate.cycle));
        }
        const notices = checked(await db.from('account_activity_outbox').select('*').eq('user_id', user.id).eq('cycle', candidate.cycle).in('status', ['queued', 'sending']).order('created_at').limit(1));
        for (const notice of notices ?? []) {
          if (!hasTime()) break;
          if (notice.payload && notice.payload.to !== primary.emailAddress) {
            checked(await db.from('account_activity_outbox').update({ status: 'unknown', payload: null }).eq('id', notice.id).eq('cycle', candidate.cycle));
            checked(await db.from('account_activity').update({ issue: 'recipient_changed' }).eq('user_id', user.id).eq('cycle', candidate.cycle));
            continue;
          }
          const stage = notice.stage as AccountActivityNotice;
          const locale = appLocale(user.locale) ?? appLocale(user.privateMetadata?.cinegeniusLocale) ?? DEFAULT_LOCALE;
          const payload = notice.payload ?? await buildAccountActivityEmail(primary.emailAddress, locale, stage);
          const notification = localizedNotification({ title: { key: `activity_${stage}_title` }, body: { key: `activity_${stage}_body` } });
          const operatorNotices = stage === 'review'
            ? [...new Set((process.env.ADMIN_USER_IDS ?? '').split(',').map(id => id.trim()).filter(Boolean))]
              .map(id => ({ userId: id, ...localizedNotification({
                title: { key: 'activity_admin_title' }, body: { key: 'activity_admin_body', values: { accountId: user.id } },
              }) })) : [];
          const bound = checked(await db.rpc('bind_account_activity_mail', {
            p_id: notice.id, p_cycle: candidate.cycle, p_payload: payload,
            p_notification: notification, p_admin_notifications: operatorNotices,
          }));
          if (!bound || !isFrozenListingReminderEmail(bound.payload)) continue;
          // Recheck after rendering/binding; asynchronous returns cannot revive an old cycle.
          const current = checked(await db.from('account_activity').select('cycle,exempt').eq('user_id', user.id).single());
          if (!current || Number(current.cycle) !== Number(candidate.cycle) || current.exempt) continue;
          const result = await sendEmail(bound.payload, `account-activity/${notice.id}`);
          if (result.ok) {
            checked(await db.rpc('finish_account_activity_mail', { p_id: notice.id, p_cycle: candidate.cycle, p_provider_id: result.id }));
            stats.sent += 1;
          } else stats.errors += 1;
        }
      } catch {
        stats.errors += 1;
        // No addresses, private records, email bodies or provider errors in logs.
        checked(await db.from('account_activity').update({ issue: 'provider_unavailable', next_check_at: new Date(Date.now() + 86400000).toISOString() }).eq('user_id', candidate.user_id).eq('cycle', candidate.cycle));
      }
    }
    // Canceled cycles no longer need recipient addresses or rendered email copies.
    checked(await db.from('account_activity_outbox').delete().is('payload', null).in('status', ['canceled', 'sent', 'delivered', 'unknown']).lt('created_at', new Date(Date.now() - 90 * 86400000).toISOString()));
  } finally {
    checked(await db.rpc('finish_account_activity_worker', { p_lease: lease, p_offset: nextOffset }));
  }
  return stats;
}
