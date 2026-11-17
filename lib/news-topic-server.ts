import 'server-only';
import { createHash } from 'node:crypto';
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { newsTopicChoice, newsTopicCookieName, type HomeNewsTopic } from '@/lib/news-topic';
import { profileNewsTopic } from '@/lib/profile-news-topic';

export async function homeNewsTopic(countryCookieName: string, override?: string): Promise<HomeNewsTopic> {
  const cookieName = newsTopicCookieName(countryCookieName);
  const explicit = newsTopicChoice(override) ?? newsTopicChoice((await cookies()).get(cookieName)?.value);
  if (explicit) return {cookieName, selection: explicit};
  if (cookieName.endsWith('_guest')) return {cookieName, selection: 'all'};

  try {
    const {userId} = await auth();
    if (!userId || cookieName !== `cg_news_topic_${createHash('sha256').update(userId).digest('hex').slice(0, 16)}`) {
      return {cookieName, selection: 'all'};
    }
    // Private, current-account read only. Do not serialize the occupations or
    // cache this decision between requests; job changes take effect next visit.
    const {data, error} = await db.from('profiles').select('positions,role,crew').eq('user_id', userId).maybeSingle();
    if (error) throw new Error('news_topic_profile_unavailable');
    return {cookieName, selection: profileNewsTopic(data)};
  } catch {
    // A temporary profile failure must not break public news or save a fallback.
    console.error('news_topic_profile_unavailable');
    return {cookieName, selection: 'all'};
  }
}
