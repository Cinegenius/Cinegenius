import 'server-only';
import { createHash } from 'node:crypto';
import { auth } from '@clerk/nextjs/server';
import { cookies, headers } from 'next/headers';
import { ownBrowsePlace } from '@/lib/browse-geography-server';
import { newsCountryChoice, resolvedNewsCountry, type NewsRegion } from '@/lib/news-region';

export async function newsRegion(override?: string): Promise<NewsRegion> {
  const [{userId}, jar, request] = await Promise.all([auth(), cookies(), headers()]);
  const scope = userId ? createHash('sha256').update(userId).digest('hex').slice(0, 16) : 'guest';
  const cookieName = `cg_news_country_${scope}`;
  const selection = newsCountryChoice(override) ?? newsCountryChoice(jar.get(cookieName)?.value) ?? 'auto';
  let profileCountry = '';
  if (selection === 'auto' && userId) {
    try { profileCountry = (await ownBrowsePlace()).place?.country ?? ''; }
    catch { /* Coarse request geography remains available if the profile is unavailable. */ }
  }
  return {selection, cookieName, country: resolvedNewsCountry(selection, profileCountry, request.get('x-vercel-ip-country') ?? '')};
}
