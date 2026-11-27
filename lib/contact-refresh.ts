/** Refresh shared contacts on return, without background polling or duplicate wake-up requests. */
export function watchContactRefresh(browser: Window, refresh: () => void) {
  let lastRefresh = -Infinity;
  const resume = () => {
    if (browser.document.visibilityState === "hidden") return;
    const now = Date.now();
    if (now - lastRefresh < 500) return;
    lastRefresh = now;
    refresh();
  };
  const events = ["focus", "pageshow", "cinegenius:app-resume"];
  events.forEach(event => browser.addEventListener(event, resume));
  browser.document.addEventListener("visibilitychange", resume);
  return () => {
    events.forEach(event => browser.removeEventListener(event, resume));
    browser.document.removeEventListener("visibilitychange", resume);
  };
}
