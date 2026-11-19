"use client";

import { useSyncExternalStore } from "react";

const APPEARANCE_ATTRIBUTE = "data-cg-native-community-appearance";

/** A presentation signal only. Authentication and permissions stay with Clerk/server APIs. */
export function nativeAppAppearanceSnapshot(): boolean {
  return typeof document !== "undefined"
    && document.documentElement?.getAttribute(APPEARANCE_ATTRIBUTE) === "app";
}

export function nativeAppAppearanceServerSnapshot(): boolean {
  return false;
}

export function subscribeNativeAppAppearance(onChange: () => void): () => void {
  if (typeof document === "undefined" || !document.documentElement || typeof MutationObserver === "undefined") return () => {};
  let previous = nativeAppAppearanceSnapshot();
  const observer = new MutationObserver(() => {
    const next = nativeAppAppearanceSnapshot();
    if (next !== previous) {
      previous = next;
      onChange();
    }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [APPEARANCE_ATTRIBUTE] });
  return () => observer.disconnect();
}

export function useNativeAppAppearance(): boolean {
  return useSyncExternalStore(subscribeNativeAppAppearance, nativeAppAppearanceSnapshot, nativeAppAppearanceServerSnapshot);
}
