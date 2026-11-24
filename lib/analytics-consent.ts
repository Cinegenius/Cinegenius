// Setup measurement expands the previous public-pages/news purpose. Ask again;
// an older acceptance or notice dismissal never enables the new events.
export const ANALYTICS_CONSENT_KEY = "cg_analytics_consent_v3";
export const ANALYTICS_CONSENT_EVENT = "cg-analytics-consent-change";
export const ANALYTICS_SETTINGS_EVENT = "cg-analytics-settings";
export type AnalyticsConsent = "accepted" | "rejected" | null;
let consentRevision = 0;
export function analyticsConsentRevision() { return consentRevision; }

export function readAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (value === "accepted" || value === "rejected") return value;
    // A previous refusal remains a refusal; only an expanded opt-in needs renewal.
    return ["cg_analytics_consent_v2", "cg_analytics_consent_v1"].some(key => window.localStorage.getItem(key) === "rejected") ? "rejected" : null;
  } catch { return null; }
}

export function writeAnalyticsConsent(value: Exclude<AnalyticsConsent, null>): boolean {
  try { window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value); }
  catch { return false; }
  consentRevision++;
  // Legacy key controls the Genie launcher's clearance of the notice only.
  // It is never read as analytics consent.
  try { window.localStorage.setItem("cg_cookies_ok", "1"); } catch { /* Nonessential UI compatibility. */ }
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
  window.dispatchEvent(new Event("cg-cookie-preference-change"));
  return true;
}

export function subscribeAnalyticsConsent(callback: () => void) {
  const onStorage = () => { consentRevision++; callback(); };
  window.addEventListener(ANALYTICS_CONSENT_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(ANALYTICS_CONSENT_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function openAnalyticsSettings() {
  window.dispatchEvent(new Event(ANALYTICS_SETTINGS_EVENT));
}
