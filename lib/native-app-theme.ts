"use client";

import { useSyncExternalStore } from "react";

type NativeAppTheme = "pure" | "cinema";
const themeAttribute = "data-cg-app-theme";
const backgroundAttribute = "data-cg-app-background";
const backgroundCapability = "data-cg-native-background-ready";
export const NATIVE_APP_BACKGROUNDS = ["graphite", "midnight", "sage", "rose", "sand", "terracotta", "black"] as const;
export type NativeAppBackground = typeof NATIVE_APP_BACKGROUNDS[number];

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

function backgroundRoot(): HTMLElement | null {
  if (typeof document === "undefined" || document.documentElement?.getAttribute("data-cg-native-community-appearance") !== "app"
      || document.documentElement.getAttribute(backgroundCapability) !== "v1") return null;
  return document.documentElement;
}

/** Null preserves the installed Mauve default until the member chooses a color. */
export function nativeAppBackgroundSnapshot(): NativeAppBackground | null {
  const value = backgroundRoot()?.getAttribute(backgroundAttribute);
  return NATIVE_APP_BACKGROUNDS.find(background => background === value) ?? null;
}

export function subscribeNativeAppBackground(onChange: () => void): () => void {
  if (typeof document === "undefined" || !document.documentElement || typeof MutationObserver === "undefined") return () => {};
  let previous = nativeAppBackgroundSnapshot();
  const observer = new MutationObserver(() => {
    const next = nativeAppBackgroundSnapshot();
    if (next !== previous) { previous = next; onChange(); }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [backgroundAttribute, backgroundCapability, "data-cg-native-community-appearance"] });
  return () => observer.disconnect();
}

const serverBackgroundSnapshot = () => null;
export function useNativeAppBackground(): NativeAppBackground | null {
  return useSyncExternalStore(subscribeNativeAppBackground, nativeAppBackgroundSnapshot, serverBackgroundSnapshot);
}

/** Presentation only. The installed app owns rendering and persistence. */
export function selectNativeAppBackground(value: unknown): boolean {
  const root = backgroundRoot();
  if (!root || !NATIVE_APP_BACKGROUNDS.some(background => background === value)) return false;
  root.setAttribute(backgroundAttribute, value as NativeAppBackground);
  return true;
}
