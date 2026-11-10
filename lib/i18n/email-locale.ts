import { clerkClient } from '@clerk/nextjs/server';
import { appLocale, DEFAULT_LOCALE, type AppLocale } from './locales';

/** Resolve language for this recipient only; never use the sender's UI language. */
export async function recipientEmailLocale(email: string, userId?: string | null, hint?: unknown): Promise<AppLocale> {
  const explicit = appLocale(hint);
  if (explicit) return explicit;
  const client = await clerkClient();
  const user = userId
    ? await client.users.getUser(userId)
    : (await client.users.getUserList({emailAddress: [email], limit: 1})).data[0];
  return appLocale(user?.locale) ?? appLocale(user?.privateMetadata?.cinegeniusLocale)
    ?? appLocale(user?.unsafeMetadata?.cinegeniusLocale) ?? DEFAULT_LOCALE;
}
