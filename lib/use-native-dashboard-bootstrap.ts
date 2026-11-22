"use client";

import { useSyncExternalStore } from "react";

/** The native cold-entry intermediary contains no account data or page effects. */
export function nativeDashboardBootstrapSnapshot(): "bootstrap" | "content" {
  return typeof document !== "undefined" && typeof location !== "undefined"
    && location.pathname === "/dashboard" && !location.search && !location.hash
    && document.documentElement.getAttribute("data-native-app-startup") === "v1" ? "bootstrap" : "content";
}

export function subscribeNativeDashboardBootstrap(changed: () => void): () => void {
  const observer = new MutationObserver(changed);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-native-app-startup"] });
  window.addEventListener("popstate", changed); window.addEventListener("hashchange", changed);
  return () => { observer.disconnect(); window.removeEventListener("popstate", changed); window.removeEventListener("hashchange", changed); };
}

const serverSnapshot = () => "pending" as const;

export function useNativeDashboardBootstrap(query: string): boolean {
  // The first hydration render must not mount DashboardContent before the
  // document-start native signal is read. No timeout or request is involved.
  const phase = useSyncExternalStore<"pending" | "bootstrap" | "content">(subscribeNativeDashboardBootstrap, nativeDashboardBootstrapSnapshot, serverSnapshot);
  return !query && phase !== "content";
}
