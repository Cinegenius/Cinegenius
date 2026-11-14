export const MESSAGE_HISTORY_KEY = "cinegeniusMessageNavigation";
export type MessageDestination = { conversationId?: string | null; recipientId?: string | null; companySlug?: string | null };
type MessageHistoryEntry = { owner: string; current: string; previous: string | null };

const localHref = (url: URL) => url.pathname + url.search + url.hash;

/** One real entry per opened chat. No message bodies or synthetic Back sentinels. */
export function navigateMessageView(browser: Window, owner: string, destination: MessageDestination, replace = false): boolean {
  if (!owner || browser.location.pathname !== "/messages") return false;
  const target = new URL(browser.location.href);
  for (const key of ["conv", "to", "company_slug"]) target.searchParams.delete(key);
  if (destination.conversationId || destination.recipientId) {
    if (inboxView(target.searchParams) === "notices") target.searchParams.delete("view");
    target.searchParams.delete("requests");
  }
  if (destination.conversationId) target.searchParams.set("conv", destination.conversationId);
  if (destination.recipientId) target.searchParams.set("to", destination.recipientId);
  if (destination.recipientId && destination.companySlug) target.searchParams.set("company_slug", destination.companySlug);
  const current = localHref(new URL(browser.location.href));
  const next = localHref(target);
  if (current === next) return false;
  const old = browser.history.state?.[MESSAGE_HISTORY_KEY] as MessageHistoryEntry | undefined;
  const previous = replace ? old?.owner === owner && old.current === current ? old.previous : null : current;
  // Next.js' native History integration copies its own router state. Passing __NA
  // back in would bypass its search-parameter update, so use only our small marker.
  const state = { [MESSAGE_HISTORY_KEY]: { owner, current: next, previous } satisfies MessageHistoryEntry };
  if (replace) browser.history.replaceState(state, "", next);
  else browser.history.pushState(state, "", next);
  return true;
}

/** A deep-linked chat has no list entry to go back to; close it without leaving the site. */
export function backFromMessageView(browser: Window, owner: string) {
  if (!owner || browser.location.pathname !== "/messages") return;
  const current = localHref(new URL(browser.location.href));
  const entry = browser.history.state?.[MESSAGE_HISTORY_KEY] as MessageHistoryEntry | undefined;
  const previous = entry?.previous?.startsWith("/messages") ? new URL(entry.previous, browser.location.href) : null;
  if (entry?.owner === owner && entry.current === current && previous?.origin === browser.location.origin && previous.pathname === "/messages") browser.history.back();
  else navigateMessageView(browser, owner, {}, true);
}

export type InboxView = "chats" | "notices" | "friends" | "groups";

export function inboxView(params: Pick<URLSearchParams, "get">): InboxView {
  // Saved notification links from earlier releases still lead to requests.
  if (params.get("requests") === "1") return "notices";
  const view = params.get("view");
  return view === "notices" || view === "friends" || view === "groups" ? view : "chats";
}

/** Switch just the inbox content, retaining the mounted navigation and real Back entries. */
export function navigateInboxView(browser: Window, view: InboxView): boolean {
  if (browser.location.pathname !== "/messages") return false;
  const target = new URL(browser.location.href);
  for (const key of ["conv", "to", "company_slug", "requests", "view"]) target.searchParams.delete(key);
  if (view !== "chats") target.searchParams.set("view", view);
  const next = localHref(target);
  if (next === localHref(new URL(browser.location.href))) return false;
  browser.history.pushState({}, "", next);
  return true;
}
