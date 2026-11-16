import 'server-only';
import { cookies } from 'next/headers';
import { newsTopicChoice, newsTopicCookieName, type HomeNewsTopic } from '@/lib/news-topic';

export async function homeNewsTopic(countryCookieName: string): Promise<HomeNewsTopic> {
  const cookieName = newsTopicCookieName(countryCookieName);
  return {cookieName, selection: newsTopicChoice((await cookies()).get(cookieName)?.value) ?? 'all'};
}
