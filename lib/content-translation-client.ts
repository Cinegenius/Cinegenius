import { contentReferenceKey, isContentReference, MAX_TRANSLATION_BATCH, type ContentReference, type ContentTranslation } from "@/lib/content-translation";
import type { AppLocale } from "@/lib/i18n/locales";

type Entry = { ref: ContentReference; value?: ContentTranslation; listeners: Set<() => void>; attempts: number; queued: boolean };
/** Ephemeral, scoped to one mounted page/account/language. It is not an authorization cache. */
export function createContentTranslationClient(locale: AppLocale, request: typeof fetch = fetch) {
  const entries = new Map<string, Entry>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let controller: AbortController | null = null;
  let generation = 0, stopped = false, disabled = false;
  const later = (callback: () => void, ms: number) => {
    const timer = setTimeout(() => { timers.delete(timer); callback(); }, ms); timers.add(timer);
  };
  const notify = (entry: Entry) => entry.listeners.forEach(listener => listener());
  const flush = async () => {
    if (stopped || disabled || controller) return;
    const batch = [...entries.values()].filter(entry => entry.queued && entry.listeners.size > 0).slice(0, MAX_TRANSLATION_BATCH);
    if (!batch.length) return;
    batch.forEach(entry => { entry.queued = false; entry.attempts++; });
    const current = new AbortController(); controller = current;
    const version = generation;
    try {
      const response = await request("/api/content-translations", {method: "POST", credentials: "same-origin", cache: "no-store",
        headers: {"Content-Type": "application/json"}, body: JSON.stringify({locale, items: batch.map(entry => entry.ref)}),
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(50000)])});
      if (stopped || generation !== version) return;
      if (response.status === 429 || response.status === 503) disabled = true;
      if (!response.ok) throw new Error("translation_unavailable");
      const data: unknown = await response.json();
      if (stopped || generation !== version) return;
      const payload = data as {locale?: unknown; items?: unknown};
      if (payload.locale !== locale || !Array.isArray(payload.items)) throw new Error("translation_unavailable");
      for (const entry of batch) {
        if (entries.get(contentReferenceKey(entry.ref)) !== entry) continue;
        const value = payload.items.find(item => isContentReference(item) && contentReferenceKey(item) === contentReferenceKey(entry.ref)) as ContentTranslation | undefined;
        if (value && value.locale === locale && ["translated", "original", "pending", "unavailable"].includes(value.status) &&
          typeof value.fields === "object" && value.fields !== null && typeof value.originals === "object" && value.originals !== null) entry.value = value;
        else entry.value = {...entry.ref, locale, fingerprint: "", fields: {}, originals: {}, status: "unavailable"};
        notify(entry);
        if (entry.value.status === "pending" && entry.attempts < 3) later(() => {
          if (entries.get(contentReferenceKey(entry.ref)) === entry && entry.listeners.size) { entry.queued = true; void flush(); }
        }, entry.attempts * 3000);
      }
    } catch {
      if (!stopped && generation === version && !current.signal.aborted) for (const entry of batch) {
        if (entries.get(contentReferenceKey(entry.ref)) !== entry) continue;
        entry.value = {...entry.ref, locale, fingerprint: "", fields: {}, originals: {}, status: "unavailable"}; notify(entry);
      }
    } finally {
      if (controller === current) { controller = null; if (!stopped) later(() => void flush(), 80); }
    }
  };
  return {
    get(ref: ContentReference) { return entries.get(contentReferenceKey(ref))?.value; },
    subscribe(ref: ContentReference, listener: () => void) {
      if (!isContentReference(ref) || stopped) return () => {};
      const key = contentReferenceKey(ref);
      let entry = entries.get(key);
      if (!entry) { entry = {ref, listeners: new Set(), attempts: 0, queued: true}; entries.set(key, entry); }
      entry.listeners.add(listener);
      later(() => void flush(), 80);
      return () => { entry!.listeners.delete(listener); if (!entry!.listeners.size) entries.delete(key); };
    },
    refresh() {
      generation++; controller?.abort(); controller = null; disabled = false;
      timers.forEach(clearTimeout); timers.clear();
      entries.forEach(entry => { entry.value = undefined; entry.attempts = 0; entry.queued = true; notify(entry); });
      later(() => void flush(), 80);
    },
    dispose() { stopped = true; generation++; controller?.abort(); timers.forEach(clearTimeout); timers.clear(); entries.clear(); },
  };
}
