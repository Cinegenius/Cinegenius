import { GENIE_LINKS, GENIE_MAX_HISTORY_CHARS, GENIE_MAX_MESSAGE_CHARS, GENIE_MAX_MESSAGES } from "./genie";

export type SafeLink = { label: string; href: string };
export type Exchange = { id: number; user: string; reply: string; links: SafeLink[] };

const STORAGE_KEY = "cg_genie_conversation_v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_STORED_BYTES = 32 * 1024;
const MAX_EXCHANGES = Math.floor(GENIE_MAX_MESSAGES / 2);

/** Keep whole, recent pairs and leave room for the next user message. */
export function trimExchanges(exchanges: Exchange[], nextUser?: string): Exchange[] {
  const kept = [...exchanges];
  let characters = kept.reduce((count, entry) => count + entry.user.length + entry.reply.length, nextUser?.length ?? 0);
  while (kept.length && (kept.length * 2 + (nextUser ? 1 : 0) > GENIE_MAX_MESSAGES || characters > GENIE_MAX_HISTORY_CHARS)) {
    const removed = kept.shift()!;
    characters -= removed.user.length + removed.reply.length;
  }
  return kept;
}

/** Only catalogue destinations can become clickable links, including on restore. */
export function safeLinks(value: unknown): SafeLink[] {
  if (!Array.isArray(value)) return [];
  const links: SafeLink[] = [];
  for (const entry of value) {
    if (!record(entry) || typeof entry.label !== "string" || !entry.label.trim() || entry.label.length > 100
      || entry.label.includes("\0") || typeof entry.href !== "string"
      || !GENIE_LINKS.some(link => link.href === entry.href) || links.some(link => link.href === entry.href)) continue;
    links.push({ label: entry.label, href: entry.href });
    if (links.length === 4) break;
  }
  return links;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key));
}

function validScope(scope: unknown): scope is string {
  return typeof scope === "string" && Boolean(scope.trim()) && scope.length <= 256 && !scope.includes("\0");
}

function validTime(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validMessage(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim()) && value.length <= GENIE_MAX_MESSAGE_CHARS && !value.includes("\0");
}

function readExchanges(value: unknown): Exchange[] | null {
  if (!Array.isArray(value)) return null;
  const exchanges: Exchange[] = [];
  let previousId = 0;
  for (const entry of value) {
    if (!record(entry) || !hasOnlyKeys(entry, ["id", "user", "reply", "links"])
      || typeof entry.id !== "number" || !Number.isSafeInteger(entry.id) || entry.id <= previousId
      || !validMessage(entry.user) || !validMessage(entry.reply) || !Array.isArray(entry.links)) return null;
    exchanges.push({ id: entry.id, user: entry.user, reply: entry.reply, links: safeLinks(entry.links) });
    previousId = entry.id;
  }
  return exchanges;
}

function fitsStorage(raw: string): boolean {
  return raw.length <= MAX_STORED_BYTES && new TextEncoder().encode(raw).byteLength <= MAX_STORED_BYTES;
}

export function clearConversation(storage: Pick<Storage, "removeItem">): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Browser privacy settings may block storage. The live chat still works.
  }
}

export function readConversation(storage: Pick<Storage, "getItem" | "removeItem">, scope: string, now = Date.now()): Exchange[] {
  try {
    if (!validScope(scope) || !validTime(now)) {
      clearConversation(storage);
      return [];
    }
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    if (!fitsStorage(raw)) {
      clearConversation(storage);
      return [];
    }
    const value: unknown = JSON.parse(raw);
    if (!record(value) || !hasOnlyKeys(value, ["version", "scope", "updatedAt", "exchanges"])
      || value.version !== 1 || value.scope !== scope || !validTime(value.updatedAt)
      || value.updatedAt > now || now - value.updatedAt >= MAX_AGE_MS
      || !Array.isArray(value.exchanges) || !value.exchanges.length || value.exchanges.length > MAX_EXCHANGES) {
      clearConversation(storage);
      return [];
    }
    const exchanges = readExchanges(value.exchanges);
    if (!exchanges || trimExchanges(exchanges).length !== exchanges.length) {
      clearConversation(storage);
      return [];
    }
    return exchanges;
  } catch {
    clearConversation(storage);
    return [];
  }
}

/** Persist completed pairs only; request state and draft text have no storage path. */
export function saveConversation(storage: Pick<Storage, "setItem" | "removeItem">, scope: string, exchanges: Exchange[], now = Date.now()): void {
  try {
    const valid = readExchanges(exchanges);
    if (!validScope(scope) || !validTime(now) || !valid?.length) {
      clearConversation(storage);
      return;
    }
    const kept = trimExchanges(valid);
    while (kept.length) {
      const raw = JSON.stringify({ version: 1, scope, updatedAt: now, exchanges: kept });
      if (fitsStorage(raw)) {
        storage.setItem(STORAGE_KEY, raw);
        return;
      }
      kept.shift();
    }
    clearConversation(storage);
  } catch {
    clearConversation(storage);
  }
}
