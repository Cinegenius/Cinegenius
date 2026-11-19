import type { ShotFormat, ShotLook, ShotPhoto } from "./shots-photo";
import { SHOT_EXPORT_BYTES } from "./shots-photo";
import { SHOTS_CONTRACT, SHOT_LIFETIME_MS, SHOT_PAGE_SIZE, isShotId, isShotTimestamp } from "./shots";
import type { Shot, ShotAudience as WireShotAudience } from "./shots";

export const SHOTS_CLIENT_CONTRACT = SHOTS_CONTRACT;
export const SHOTS_CLIENT_LIFETIME = SHOT_LIFETIME_MS;
export type ShotAudience = WireShotAudience;
export type ClientShot = Shot;
export type ShotsFeed = { items: ClientShot[]; nextCursor: string | null; serverNow: string; capabilities: { read: boolean; publish: boolean; homiesRead: boolean } };
export type ShotsRequest = { status: "absent" | "pending" | "published" | "expired" | "deleted"; requestId: string; item: ClientShot | null; serverNow: string; retryAllowed: boolean };
export type ShotPublication = { requestId: string; photo: ShotPhoto; audience: ShotAudience; format: ShotFormat; look: ShotLook; grain: number };
export class ShotsClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly uncertain: boolean;
  constructor(code: string, status = 0, uncertain = false) { super(code); this.name = "ShotsClientError"; this.code = code; this.status = status; this.uncertain = uncertain; }
}
const uuid = isShotId;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const stamp = isShotTimestamp;
const invalid = (): never => { throw new ShotsClientError("invalid_response"); };

export function parseClientShot(value: unknown, serverNow: string): ClientShot {
  if (!stamp(serverNow) || !record(value) || !uuid(value.id) || !stamp(value.createdAt) || !stamp(value.expiresAt)
      || Date.parse(value.expiresAt) - Date.parse(value.createdAt) !== SHOTS_CLIENT_LIFETIME
      || Date.parse(value.createdAt) > Date.parse(serverNow) + 5000 || Date.parse(value.expiresAt) <= Date.parse(serverNow)
      || !["community", "homies"].includes(String(value.audience)) || !["portrait", "landscape"].includes(String(value.format))
      || !["original", "film", "photo", "bw"].includes(String(value.look)) || !Number.isInteger(value.grain) || Number(value.grain) < 0 || Number(value.grain) > 100
      || typeof value.isMine !== "boolean" || (value.isMine ? !uuid(value.requestId) : value.requestId !== null)
      || !Number.isInteger(value.width) || !Number.isInteger(value.height) || Number(value.width) < 1 || Number(value.height) < 1
      || Math.max(Number(value.width), Number(value.height)) > 1600 || !record(value.media)
      || value.media.full !== `/api/shots/${value.id}/media/full` || value.media.thumbnail !== `/api/shots/${value.id}/media/thumbnail`) return invalid();
  return value as unknown as ClientShot;
}

function envelope(value: unknown, accountId: string): Record<string, unknown> {
  if (!record(value) || value.contract !== SHOTS_CLIENT_CONTRACT || value.accountId !== accountId || !stamp(value.serverNow)) return invalid();
  return value;
}

export function parseShotsFeed(value: unknown, accountId: string): ShotsFeed {
  const data = envelope(value, accountId);
  if (!record(data.capabilities) || data.capabilities.read !== true || typeof data.capabilities.publish !== "boolean" || typeof data.capabilities.homiesRead !== "boolean"
      || !Array.isArray(data.items) || data.items.length > SHOT_PAGE_SIZE || !(data.nextCursor === null || typeof data.nextCursor === "string" && data.nextCursor.length > 0 && data.nextCursor.length <= 2048)) return invalid();
  const items = data.items.map(item => parseClientShot(item, data.serverNow as string));
  if (new Set(items.map(item => item.id)).size !== items.length) return invalid();
  return { items, nextCursor: data.nextCursor as string | null, serverNow: data.serverNow as string, capabilities: data.capabilities as ShotsFeed["capabilities"] };
}

export function parseShotsRequest(value: unknown, accountId: string, requestId: string, requireRetryFlag = false): ShotsRequest {
  const data = envelope(value, accountId);
  if (!uuid(requestId) || data.requestId !== requestId || !["absent", "pending", "published", "expired", "deleted"].includes(String(data.status))) return invalid();
  const item = data.status === "published" ? parseClientShot(data.item, data.serverNow as string) : null;
  if (item ? item.requestId !== requestId || !item.isMine : data.item !== null) return invalid();
  if ((requireRetryFlag || data.retryAllowed !== undefined) && typeof data.retryAllowed !== "boolean") return invalid();
  if (data.retryAllowed === true && data.status !== "absent" && data.status !== "pending") return invalid();
  return { status: data.status as ShotsRequest["status"], requestId, item, serverNow: data.serverNow as string, retryAllowed: data.retryAllowed === true };
}

/** One current-account client. Callers additionally bind every result to their active session/generation. */
export function createShotsClient(accountId: string, fetcher: typeof fetch = fetch) {
  if (!accountId) throw new ShotsClientError("unauthorized");
  async function request(path: string, init: RequestInit, signal?: AbortSignal): Promise<unknown> {
    const controller = new AbortController(), cancel = () => controller.abort();
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    signal?.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(cancel, init.method === "POST" ? 45_000 : 15_000);
    try {
      const response = await fetcher(path, { ...init, cache: "no-store", credentials: "same-origin", redirect: "error", signal: controller.signal,
        headers: { "X-Shots-Account": accountId, "X-CineGenius-Shots-Contract": SHOTS_CLIENT_CONTRACT, ...init.headers } });
      const data: unknown = await response.json();
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if (!response.ok) {
        const code = record(data) && record(data.error) && typeof data.error.code === "string" ? data.error.code : "request_failed";
        throw new ShotsClientError(code, response.status);
      }
      return data;
    } catch (cause) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if (cause instanceof ShotsClientError) throw cause;
      throw new ShotsClientError("network", 0, init.method === "POST");
    } finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); }
  }
  return {
    async feed(audience: ShotAudience, cursor: string | null, signal?: AbortSignal) {
      const query = new URLSearchParams({ audience }); if (cursor) query.set("cursor", cursor);
      const result = parseShotsFeed(await request(`/api/shots?${query}`, {}, signal), accountId);
      if (result.items.some(item => item.audience !== audience)) return invalid();
      return result;
    },
    async detail(id: string, signal?: AbortSignal) {
      if (!uuid(id)) return invalid();
      const data = envelope(await request(`/api/shots/${id}`, {}, signal), accountId), item = parseClientShot(data.item, data.serverNow as string);
      if (item.id !== id) return invalid();
      return { item, serverNow: data.serverNow as string };
    },
    async status(requestId: string, signal?: AbortSignal) {
      if (!uuid(requestId)) return invalid();
      return parseShotsRequest(await request(`/api/shots/requests/${requestId}`, {}, signal), accountId, requestId, true);
    },
    async publish(publication: ShotPublication, signal?: AbortSignal) {
      if (!uuid(publication.requestId) || publication.photo.blob.type !== "image/jpeg" || !publication.photo.blob.size || publication.photo.blob.size > SHOT_EXPORT_BYTES) throw new ShotsClientError("invalid");
      const form = new FormData();
      form.append("photo", publication.photo.blob, "shot.jpg");
      for (const key of ["requestId", "audience", "format", "look", "grain"] as const) form.append(key, String(publication[key]));
      const data = await request("/api/shots", { method: "POST", body: form }, signal);
      try {
        const result = parseShotsRequest(data, accountId, publication.requestId);
        if (result.status !== "published" && result.status !== "pending") return invalid();
        if (result.item && (result.item.audience !== publication.audience || result.item.format !== publication.format || result.item.look !== publication.look || result.item.grain !== publication.grain)) return invalid();
        return result;
      } catch { throw new ShotsClientError("invalid_response", 0, true); }
    },
    async remove(id: string, signal?: AbortSignal) {
      if (!uuid(id)) return invalid();
      const data = envelope(await request(`/api/shots/${id}`, { method: "DELETE" }, signal), accountId);
      if (data.id !== id || data.deleted !== true || typeof data.purgePending !== "boolean") return invalid();
      return { id, deleted: true as const };
    },
  };
}

export function mergeShotsPage(previous: ClientShot[], incoming: ClientShot[], serverNow: string): ClientShot[] {
  const byId = new Map(previous.filter(item => Date.parse(item.expiresAt) > Date.parse(serverNow)).map(item => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].slice(0, 120);
}
