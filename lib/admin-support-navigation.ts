import { VIEW_STATE_KEY, viewRecord } from "./navigation-context";

export const ADMIN_SUPPORT_HISTORY_KEY = "cinegeniusAdminSupportNavigation";
type Entry = { owner: string; current: string; previous: string | null };
const href = (url: URL) => url.pathname + url.search + url.hash;

/** Each opened support thread is a real view, containing routing IDs only. */
export function navigateAdminSupportThread(browser: Window, owner: string, threadId: string | null, replace = false): boolean {
  if (!owner || browser.location.pathname !== "/admin") return false;
  const target = new URL(browser.location.href);
  target.searchParams.delete("supportThread");
  if (threadId) target.searchParams.set("supportThread", threadId);
  const current = href(new URL(browser.location.href));
  const next = href(target);
  if (current === next) return false;
  const old = browser.history.state?.[ADMIN_SUPPORT_HISTORY_KEY] as Entry | undefined;
  const previous = replace ? old?.owner === owner && old.current === current ? old.previous : null : current;
  const view = viewRecord(browser.history.state, "/admin", owner);
  // Next's native History wrapper supplies router internals. Retain admin controls,
  // never copy __NA or fetched support messages into a history entry.
  const state = {
    [VIEW_STATE_KEY]: { ...view, fields: { ...view.fields, "admin.activeTab": "support" } },
    [ADMIN_SUPPORT_HISTORY_KEY]: { owner, current: next, previous } satisfies Entry,
  };
  if (replace) browser.history.replaceState(state, "", next);
  else browser.history.pushState(state, "", next);
  return true;
}

export function backFromAdminSupportThread(browser: Window, owner: string) {
  if (!owner || browser.location.pathname !== "/admin") return;
  const current = href(new URL(browser.location.href));
  const entry = browser.history.state?.[ADMIN_SUPPORT_HISTORY_KEY] as Entry | undefined;
  const previous = entry?.previous?.startsWith("/admin") ? new URL(entry.previous, browser.location.href) : null;
  if (entry?.owner === owner && entry.current === current && previous?.origin === browser.location.origin && previous.pathname === "/admin") browser.history.back();
  else navigateAdminSupportThread(browser, owner, null, true);
}
