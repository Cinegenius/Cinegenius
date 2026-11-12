"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { analyticsPage, analyticsProperties } from "@/lib/analytics-policy";
import { readAnalyticsConsent, subscribeAnalyticsConsent } from "@/lib/analytics-consent";
import type { PostHog } from "posthog-js";

let client: PostHog | null = null;
let loading: Promise<PostHog> | null = null;
let lastPage: string | null = null;
const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

async function getClient() {
  if (client) return client;
  loading ??= import("posthog-js").then(({ default: posthog }) => posthog);
  const posthog = await loading;
  if (!client && readAnalyticsConsent() === "accepted" && analyticsPage(window.location.pathname) && token) {
    posthog.init(token, {
      api_host: "https://eu.i.posthog.com",
      ui_host: "https://eu.posthog.com",
      persistence: "memory",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_exceptions: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_conversations: true,
      disable_product_tours: true,
      disable_external_dependency_loading: true,
      advanced_disable_flags: true,
      capture_performance: false,
      capture_heatmaps: false,
      capture_dead_clicks: false,
      rageclick: false,
      opt_out_capturing_persistence_type: "localStorage",
      advanced_disable_feature_flags: true,
      advanced_disable_feature_flags_on_first_load: true,
      person_profiles: "never",
      ip: false,
      save_referrer: false,
      save_campaign_params: false,
      before_send(event) {
        if (!event || readAnalyticsConsent() !== "accepted") return null;
        const page = analyticsPage(window.location.pathname);
        if (!page || event.event !== "$pageview") return null;
        // Replace SDK-enriched properties to exclude titles, referrers, queries and IDs.
        return { event: event.event, uuid: event.uuid, timestamp: event.timestamp, properties: { ...analyticsProperties(page), token, distinct_id: posthog.get_distinct_id(), $process_person_profile: false } };
      },
    });
    client = posthog;
  }
  return client;
}

export default function ProductAnalytics() {
  const pathname = usePathname();
  const consent = useSyncExternalStore(subscribeAnalyticsConsent, readAnalyticsConsent, () => null);
  useEffect(() => {
    let cancelled = false;
    const page = analyticsPage(pathname ?? "");
    if (consent !== "accepted") {
      client?.opt_out_capturing();
      lastPage = null;
      return;
    }
    if (!token || !page) { lastPage = null; return; }
    void getClient().then(instance => {
      if (cancelled || !instance || readAnalyticsConsent() !== "accepted") return;
      if (instance.has_opted_out_capturing()) instance.opt_in_capturing({ captureEventName: false });
      if (lastPage === page) return;
      lastPage = page;
      instance.capture("$pageview", analyticsProperties(page));
    }).catch(() => { lastPage = null; });
    return () => { cancelled = true; };
  }, [pathname, consent]);
  return null;
}
