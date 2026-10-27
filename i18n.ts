import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { resolveLocale } from "@/lib/i18n/locales";
import { loadMessages } from "@/lib/i18n/messages";

export default getRequestConfig(async () => {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale(cookieStore.get('cg_locale')?.value, requestHeaders.get('accept-language') ?? '');
  const messages = await loadMessages(locale);
  return {locale, messages, onError: error => console.warn("Translation error", error.code), getMessageFallback: () => String((messages.common as Record<string,unknown>).translationUnavailable)};
});
