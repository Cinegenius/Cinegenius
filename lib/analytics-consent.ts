export const ANALYTICS_CONSENT_KEY = "cg_analytics_consent_v1";
export const ANALYTICS_CONSENT_EVENT = "cg-analytics-consent-change";
export const ANALYTICS_SETTINGS_EVENT = "cg-analytics-settings";
export type AnalyticsConsent = "accepted" | "rejected" | null;

export function readAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch { return null; }
}

export function writeAnalyticsConsent(value: Exclude<AnalyticsConsent, null>): boolean {
  try { window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value); }
  catch { return false; }
  // Legacy key controls the Genie launcher's clearance of the notice only.
  // It is never read as analytics consent.
  try { window.localStorage.setItem("cg_cookies_ok", "1"); } catch { /* Nonessential UI compatibility. */ }
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
  window.dispatchEvent(new Event("cg-cookie-preference-change"));
  return true;
}

export function subscribeAnalyticsConsent(callback: () => void) {
  window.addEventListener(ANALYTICS_CONSENT_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(ANALYTICS_CONSENT_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function openAnalyticsSettings() {
  window.dispatchEvent(new Event(ANALYTICS_SETTINGS_EVENT));
}
