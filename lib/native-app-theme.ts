"use client";

import { useSyncExternalStore } from "react";

type NativeAppTheme = "pure" | "cinema";
const themeAttribute = "data-cg-app-theme";

export function nativeAppThemeSnapshot(): NativeAppTheme {
  return typeof document !== "undefined" && document.documentElement?.getAttribute(themeAttribute) === "pure" ? "pure" : "cinema";
}

export function subscribeNativeAppTheme(onChange: () => void): () => void {
  if (typeof document === "undefined" || !document.documentElement || typeof MutationObserver === "undefined") return () => {};
  let previous = nativeAppThemeSnapshot();
  const observer = new MutationObserver(() => {
    const next = nativeAppThemeSnapshot();
    if (next !== previous) { previous = next; onChange(); }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [themeAttribute] });
  return () => observer.disconnect();
}

const serverSnapshot = (): NativeAppTheme => "cinema";
export function useNativeAppTheme(): NativeAppTheme {
  return useSyncExternalStore(subscribeNativeAppTheme, nativeAppThemeSnapshot, serverSnapshot);
}

/** Appearance only. The installed app's trusted capture owns persistence. */
export function toggleNativeAppTheme(): void {
  if (typeof document === "undefined" || document.documentElement?.getAttribute("data-cg-native-community-appearance") !== "app"
      || document.documentElement.getAttribute("data-cg-native-theme-ready") !== "v1") return;
  document.documentElement.setAttribute(themeAttribute, nativeAppThemeSnapshot() === "pure" ? "cinema" : "pure");
}
