export const NEWS_READERSHIP_CONTRACT = "news-readership-v1";
export const NEWS_READERSHIP_THRESHOLDS = {impressions: 20, views: 5, minimumAgeHours: 48} as const;
export type NewsReadershipCount = {id: string; impressions: number; views: number};
export function readershipWindow(now = new Date()) {
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return {from: new Date(until.getTime() - 28 * 86_400_000).toISOString(), until: until.toISOString(), timeZone: "UTC" as const};
}
export function newsReadershipQuery(ids: string[], window: ReturnType<typeof readershipWindow>) {
  if (!ids.length || ids.length > 100 || ids.some(id => !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))) throw new Error("news_readership_ids");
  if (![window.from, window.until].every(value => /^\d{4}-\d\d-\d\dT00:00:00\.000Z$/.test(value))) throw new Error("news_readership_window");
  // One bounded aggregate scan; no person, session, IP, title, locale or query projection.
  return `SELECT properties.article_id AS article_id,
    countIf(event = 'news_impression') AS impressions,
    countIf(event = 'news_view') AS views
  FROM events
  WHERE timestamp >= toDateTime('${window.from.slice(0, 10)} 00:00:00', 'UTC')
    AND timestamp < toDateTime('${window.until.slice(0, 10)} 00:00:00', 'UTC')
    AND event IN ('news_impression', 'news_view')
    AND properties.measurement_version = 1
    AND properties.article_id IN (${ids.map(id => `'${id}'`).join(", ")})
  GROUP BY article_id
  ORDER BY article_id
  LIMIT 100`;
}
export function parseReadershipResponse(value: unknown, ids: string[]): NewsReadershipCount[] | null {
  if (!value || typeof value !== "object" || !("results" in value) || !Array.isArray(value.results) || value.results.length > ids.length) return null;
  if (("error" in value && value.error) || ("is_partial" in value && value.is_partial) ||
    ("hasMore" in value && value.hasMore) || ("query_status" in value && value.query_status &&
      typeof value.query_status === "object" && "complete" in value.query_status && value.query_status.complete !== true)) return null;
  const rows: NewsReadershipCount[] = [], seen = new Set<string>();
  for (const row of value.results) {
    if (!Array.isArray(row) || row.length !== 3 || !ids.includes(row[0]) || seen.has(row[0]) ||
      !row.slice(1).every(count => typeof count === "number" && Number.isSafeInteger(count) && count >= 0)) return null;
    seen.add(row[0]); rows.push({id: row[0], impressions: row[1], views: row[2]});
  }
  return rows;
}
export function readershipSignals(entries: {id: string; topic: string | null; published_at: string | null; created_at: string}[], counts: NewsReadershipCount[], now = new Date()) {
  return entries.map(entry => {
    const count = counts.find(row => row.id === entry.id);
    const impressions = count?.impressions ?? 0, views = count?.views ?? 0;
    const enough = impressions >= NEWS_READERSHIP_THRESHOLDS.impressions && views >= NEWS_READERSHIP_THRESHOLDS.views;
    const age = now.getTime() - Date.parse(entry.published_at ?? entry.created_at);
    const learningEligible = enough && Number.isFinite(age) && age >= NEWS_READERSHIP_THRESHOLDS.minimumAgeHours * 3_600_000;
    return {id: entry.id, topic: entry.topic, state: learningEligible ? "ready" : !impressions && !views ? "cold_start" : "insufficient_data",
      impressions: impressions >= NEWS_READERSHIP_THRESHOLDS.impressions ? impressions : null,
      views: views >= NEWS_READERSHIP_THRESHOLDS.views ? views : null, learningEligible};
  });
}
