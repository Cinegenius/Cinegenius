export type ErasureState = 'pending' | 'running' | 'needs_review' | 'waiting' | 'completed';
export type ErasureSummary = {id: string; state: ErasureState; requestedAt: string};
export const ERASURE_HEADERS = {'Cache-Control': 'private, no-store, max-age=0', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store'};
export function erasureId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function erasureSummary(value: unknown): value is ErasureSummary {
  if (!value || typeof value !== 'object') return false;
  const v=value as Record<string, unknown>;
  return erasureId(v.id) && ['pending','running','needs_review','waiting','completed'].includes(String(v.state)) && typeof v.requestedAt==='string' && Number.isFinite(Date.parse(v.requestedAt));
}
