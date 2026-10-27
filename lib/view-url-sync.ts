/** A delayed filter update must never win over a link click or history traversal. */
export function scheduleViewUrlReplace(
  browser: Window,
  href: string,
  replace: (href: string) => void,
  delay = 300,
): () => void {
  const source = browser.location.href;
  const target = new URL(href, source);
  if (target.origin !== browser.location.origin || target.pathname !== browser.location.pathname || target.href === source) return () => {};

  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    browser.clearTimeout(timer);
    browser.removeEventListener("popstate", cancel);
    browser.removeEventListener("pagehide", cancel);
    browser.document.removeEventListener("click", leave, true);
  };
  const leave = (event: MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href]");
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
    if (new URL(link.href, source).href !== source) cancel();
  };
  browser.addEventListener("popstate", cancel);
  browser.addEventListener("pagehide", cancel);
  browser.document.addEventListener("click", leave, true);
  const timer = browser.setTimeout(() => {
    const canReplace = !cancelled && browser.location.href === source;
    cancel();
    if (canReplace) replace(href);
  }, delay);
  return cancel;
}
