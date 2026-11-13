"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useViewState } from "@/lib/use-view-state";
import { subscribeToProfileUpdated } from "@/lib/profile-update-events";
import { browsePlace, type BrowsePlace } from "@/lib/browse-geography";

export function useBrowseGeography(eligible = true) {
  const { userId, isLoaded, sessionId } = useAuth();
  const [enabled, setEnabled] = useViewState("browse.preferProfilePlace", true);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ owner: string; session: string | null | undefined; place: BrowsePlace | null; error: boolean } | null>(null);
  useEffect(() => subscribeToProfileUpdated(detail => { if (detail.userId === userId) setRevision(value => value + 1); }), [userId]);
  useEffect(() => {
    if (!isLoaded || !userId) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => { controller.abort(); setResult({ owner: userId, session: sessionId, place: null, error: true }); }, 10000);
    void fetch("/api/browse-preference", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("preference_unavailable");
      const data = await response.json();
      if (controller.signal.aborted || data.userId !== userId) return;
      const place = data.place ? browsePlace({ place_country_code: data.place.country, place_region_id: data.place.region, place_city_id: data.place.city }) : null;
      setResult({ owner: userId, session: sessionId, place, error: false });
    }).catch(() => { if (!controller.signal.aborted) setResult({ owner: userId, session: sessionId, place: null, error: true }); })
      .finally(() => window.clearTimeout(timeout));
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [userId, sessionId, isLoaded, revision]);
  const current = isLoaded && userId && result?.owner === userId && result.session === sessionId ? result : null;
  const preferred = enabled && eligible ? current?.place ?? null : null;
  return { preferred, place: current?.place ?? null, enabled, setEnabled, eligible,
    error: current?.error ?? false, retry: () => setRevision(value => value + 1),
    key: JSON.stringify([userId ?? "guest", sessionId ?? "", preferred]) };
}
