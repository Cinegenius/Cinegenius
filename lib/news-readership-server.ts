import "server-only";
import {createHash} from "node:crypto";
import {newsReadershipQuery, parseReadershipResponse, readershipWindow, type NewsReadershipCount} from "@/lib/news-readership";

const cached = new Map<string, {until: number; counts: NewsReadershipCount[]}>();
/** Aggregates only. The fixed EU project and query cannot be chosen by the caller. */
export async function readNewsReadership(ids: string[], window = readershipWindow()): Promise<NewsReadershipCount[] | null> {
  const key = process.env.POSTHOG_NEWS_READ_KEY;
  if (!key) return null;
  const query = newsReadershipQuery(ids, window);
  const cacheKey = createHash("sha256").update(query).update(key).digest("hex");
  const hit = cached.get(cacheKey);
  if (hit && hit.until > Date.now()) return hit.counts;
  try {
    const response = await fetch("https://eu.posthog.com/api/projects/346367/query/", {method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12_000),
      headers: {Authorization: `Bearer ${key}`, "Content-Type": "application/json"},
      body: JSON.stringify({query: {kind: "HogQLQuery", query}, name: "CineGenius editorial aggregate readership"})});
    if (!response.ok) return null;
    const counts = parseReadershipResponse(await response.json(), ids);
    if (!counts) return null;
    for (const [id, item] of cached) if (item.until < Date.now() || cached.size >= 20) cached.delete(id);
    cached.set(cacheKey, {until: Date.now() + 15 * 60_000, counts});
    return counts;
  } catch { return null; }
}
