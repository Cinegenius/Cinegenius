"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { captureSetup } from "@/components/ProductAnalytics";
import { readAnalyticsConsent, subscribeAnalyticsConsent } from "@/lib/analytics-consent";
import type { SetupAnalyticsContext, SetupAnalyticsError, SetupAnalyticsEvent } from "@/lib/setup-analytics";

/** Best-effort observations; never await analytics in a save or navigation. */
export function useSetupAnalytics({flow, step, area, ready, errorCode = null}: SetupAnalyticsContext & {ready: boolean; errorCode?: SetupAnalyticsError | null}) {
  const consent = useSyncExternalStore(subscribeAnalyticsConsent, readAnalyticsConsent, () => null);
  const seen = useRef(new Set<string>());
  const lastError = useRef<string | null>(null);
  const capture = useCallback((event: SetupAnalyticsEvent) => {
    void captureSetup(event, {flow, step, area});
  }, [flow, step, area]);
  useEffect(() => {
    if (consent !== "accepted") { seen.current.clear(); lastError.current = null; return; }
    if (!ready) return;
    let active = true;
    const key = `${flow}:${step}:${area}`;
    if (!seen.current.has(key)) {
      void captureSetup("setup_step_viewed", {flow, step, area}, () => active).then(sent => {
        if (sent && active) seen.current.add(key);
      });
    }
    if (!errorCode) lastError.current = null;
    else if (lastError.current !== key) {
      void captureSetup("setup_error", {flow, step, area, error_code: errorCode}, () => active).then(sent => {
        if (sent && active) lastError.current = key;
      });
    }
    return () => { active = false; };
  }, [consent, ready, flow, step, area, errorCode]);
  return capture;
}
