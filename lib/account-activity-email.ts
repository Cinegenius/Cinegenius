import 'server-only';
import { getTranslations } from 'next-intl/server';
import { type AppLocale } from '@/lib/i18n/locales';
import { type AccountActivityNotice } from '@/lib/account-activity';
import { type FrozenListingReminderEmail, isFrozenListingReminderEmail } from '@/lib/listing-freshness-email';

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export async function buildAccountActivityEmail(to: string, locale: AppLocale, stage: AccountActivityNotice): Promise<FrozenListingReminderEmail> {
  const t = await getTranslations({ locale, namespace: 'AccountActivity' });
  const heading = t(`notices.${stage}.title`);
  const body = t(`notices.${stage}.body`);
  const href = 'https://cinegenius.co/dashboard?tab=settings';
  const action = t('openAccount');
  const note = t('emailNote');
  const payload = {
    from: 'CineGenius <noreply@cinegenius.co>', to, replyTo: 'cinegenius.co@gmail.com', locale,
    subject: heading.replace(/[\r\n]/g, ' '),
    text: `${heading}\n\n${body}\n\n${action}: ${href}\n\n${note}`,
    html: `<!doctype html><html lang="${escape(locale)}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;padding:20px 12px;background:#10131b;color:#f4f5f7;font:16px/1.6 Arial,sans-serif"><main style="max-width:560px;margin:auto"><p>CineGenius</p><h1 style="font-size:24px">${escape(heading)}</h1><p>${escape(body)}</p><p><a href="${href}" style="display:inline-block;padding:14px 20px;background:#c2f135;color:#10131b;border-radius:8px">${escape(action)}</a></p><p>${escape(note)}</p></main></body></html>`,
  };
  if (!isFrozenListingReminderEmail(payload)) throw new Error('invalid_activity_email');
  return payload;
}
