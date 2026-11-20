import { validateGenieRequest } from './genie';
import { isAppLocale } from './i18n/locales';
import { COUNTRY_CODES } from './places/countries';

export type FeedbackMessage = { role: 'user' | 'assistant'; content: string };
export type FeedbackItem = {
  title: string; problem: string; suggestion: string;
  titleDe: string; problemDe: string; suggestionDe: string;
  priority: 'high' | 'normal' | 'idea'; source: number; quote: string;
};
export type FeedbackAdvice = { reply: string; items: FeedbackItem[] };
export type FeedbackInput = { locale: string; country: string; messages: FeedbackMessage[] };
export const FEEDBACK_DRAFT_KEY = 'feedback:compose';
export const FEEDBACK_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && v.length <= max && !v.includes('\0');
const normalized = (v: string) => v.replace(/\s+/g, ' ').trim();

/** Reuse Genie's bounds and secret rejection; no arbitrary assistant/system roles. */
export function readFeedbackInput(value: unknown): FeedbackInput | null {
  if (!record(value) || !isAppLocale(value.locale) || typeof value.country !== 'string'
    || (value.country !== '' && !(COUNTRY_CODES as readonly string[]).includes(value.country))) return null;
  if (!Array.isArray(value.messages) || !value.messages.length || value.messages.length > 41 || value.messages.length % 2 !== 1) return null;
  const messages: FeedbackMessage[] = [];
  let total = 0;
  for (const [index, message] of value.messages.entries()) {
    const role = index % 2 ? 'assistant' : 'user';
    if (!record(message) || message.role !== role || Object.keys(message).some(key => !['role','content'].includes(key))) return null;
    // Reuse the established credential screening and per-message limit, including for assistant history.
    const checked = validateGenieRequest({area:'general',locale:value.locale,messages:[{role:'user',content:message.content}]});
    if (!checked.ok) return null;
    const content = checked.value.messages[0].content;
    total += content.length;
    if (total > 18000) return null;
    messages.push({role,content});
  }
  return {locale:value.locale,country:value.country,messages};
}

/** Model suggestions are unverified. Each item must cite an actual member message. */
export function readFeedbackAdvice(value: unknown, messages: FeedbackMessage[]): FeedbackAdvice | null {
  if (!record(value) || Object.keys(value).some(k => !['reply', 'items'].includes(k)) || !text(value.reply, 1000)
    || !Array.isArray(value.items) || value.items.length > 5) return null;
  const items: FeedbackItem[] = [];
  for (const item of value.items) {
    if (!record(item) || Object.keys(item).some(k => !['title','problem','suggestion','titleDe','problemDe','suggestionDe','priority','source','quote'].includes(k))
      || !text(item.title, 100) || !text(item.titleDe, 100) || !text(item.problem, 300) || !text(item.problemDe, 300)
      || !text(item.suggestion, 300) || !text(item.suggestionDe, 300) || !text(item.quote, 200)
      || !['high','normal','idea'].includes(String(item.priority)) || !Number.isInteger(item.source)) return null;
    const source = messages[Number(item.source)];
    if (source?.role !== 'user' || !normalized(source.content).includes(normalized(item.quote))) return null;
    items.push(item as FeedbackItem);
  }
  const rank = { high: 0, normal: 1, idea: 2 };
  return { reply: value.reply, items: items.sort((a,b) => rank[a.priority] - rank[b.priority]) };
}

export type FeedbackSubmission = FeedbackInput & { advice: FeedbackAdvice; requestKey: string; confirmed: true };
export function readFeedbackSubmission(value: unknown): FeedbackSubmission | null {
  const input = readFeedbackInput(value);
  if (!input || !record(value) || typeof value.requestKey !== 'string' || !FEEDBACK_UUID.test(value.requestKey) || value.confirmed !== true) return null;
  const advice = readFeedbackAdvice(value.advice, input.messages);
  return advice?.items.length ? { ...input, advice, requestKey: value.requestKey, confirmed: true } : null;
}

export type FeedbackReportLabels = { title: string; unreviewed: string; original: string; conversation: string; member: string; country: string; language: string; high: string; normal: string; idea: string; opening: string };
export function feedbackDocument(input: FeedbackSubmission, labels: FeedbackReportLabels): string {
  const items = input.advice.items.map((item, index) => `${index + 1}. [${labels[item.priority]}] ${item.titleDe}\n${item.problemDe}\n→ ${item.suggestionDe}\n\n[${input.locale}] ${item.title}\n${item.problem}\n→ ${item.suggestion}\n\n${labels.original}: “${item.quote}”`).join('\n\n');
  const original = input.messages.map((m, i) => `[${i}: ${m.role === 'user' ? labels.member : 'Genie'}]\n${m.content}`).join('\n\n');
  return `CineGenius · ${labels.title}\n${input.requestKey}\n${labels.country}: ${input.country || '—'} · ${labels.language}: ${input.locale}\n\n${labels.unreviewed}\n\n${items}\n\n${labels.conversation}\nGenie: ${labels.opening}\n\n${original}\n\nGenie:\n${input.advice.reply}`;
}

/** Machine envelope is stable; human-readable report labels come from the catalogs. */
export function feedbackParts(input: FeedbackSubmission, labels: FeedbackReportLabels): string[] {
  const chunks: string[] = [];
  let chunk = '';
  for (const char of Array.from(feedbackDocument(input, labels))) {
    if (chunk.length + char.length > 4500) { chunks.push(chunk); chunk = ''; }
    chunk += char;
  }
  if (chunk) chunks.push(chunk);
  return chunks.map((part, index) => `CG_FEEDBACK_V1 ${index === chunks.length - 1 ? 'END' : 'PART'} ${input.requestKey}\n${JSON.stringify({country:input.country,locale:input.locale,title:input.advice.items[0].titleDe,index:index+1,total:chunks.length})}\n\n${part}`);
}
export function feedbackEnvelope(content: unknown) {
  if (typeof content !== 'string') return null;
  const lines = content.split('\n');
  const match = /^CG_FEEDBACK_V1 END ([0-9a-f-]{36})$/.exec(lines[0]);
  if (!match || !FEEDBACK_UUID.test(match[1])) return null;
  try {
    const meta = JSON.parse(lines[1]);
    if (!record(meta) || !isAppLocale(meta.locale) || typeof meta.country !== 'string' || (meta.country !== '' && !(COUNTRY_CODES as readonly string[]).includes(meta.country))
      || !text(meta.title,100) || !Number.isInteger(meta.total) || Number(meta.total)<1 || Number(meta.total)>8 || meta.index!==meta.total) return null;
    return {requestKey:match[1],country:meta.country,locale:meta.locale,title:meta.title};
  } catch { return null; }
}
