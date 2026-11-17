import { isOrganizationTopic, type OrganizationTopic } from '@/lib/organization-taxonomy';

export type NewsTopicChoice = 'all' | OrganizationTopic;
export type HomeNewsTopic = {selection: NewsTopicChoice; cookieName: string};

export function newsTopicChoice(value: unknown): NewsTopicChoice | undefined {
  return value === 'all' || isOrganizationTopic(value) ? value : undefined;
}

/** Shares the country preference's account boundary, without storing profile data. */
export function newsTopicCookieName(countryCookieName: string) {
  if (!/^cg_news_country_(guest|[a-f0-9]{16})$/.test(countryCookieName)) throw new Error('invalid_news_scope');
  return countryCookieName.replace('cg_news_country_', 'cg_news_topic_');
}

export function rememberNewsTopic(cookieName: string, selection: string) {
  const choice = newsTopicChoice(selection);
  if (!/^cg_news_topic_(guest|[a-f0-9]{16})$/.test(cookieName) || !choice) return false;
  try {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${cookieName}=${choice}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    return document.cookie.split(';').some(cookie => cookie.trim() === `${cookieName}=${choice}`);
  } catch { return false; }
}
