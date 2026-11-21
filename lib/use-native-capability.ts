"use client";
import { useCallback, useSyncExternalStore } from "react";

const attributes = { workspace: "data-cg-native-workspace-ready", "push-settings": "data-cg-native-push-settings-ready", "appearance-toggle": "data-cg-native-theme-ready", "background-picker": "data-cg-native-background-ready" } as const;
type Capability = keyof typeof attributes;
const serverSnapshot = () => false;

/** Presentation of installed native controls only; never identity, permission or provider readiness. */
export function useNativeCapability(capability: Capability): boolean {
  const attribute = attributes[capability];
  const snapshot = useCallback(() => typeof document !== "undefined" && document.documentElement?.getAttribute(attribute) === "v1", [attribute]);
  const subscribe = useCallback((changed: () => void) => {
    if (typeof document === "undefined" || !document.documentElement || typeof MutationObserver === "undefined") return () => {};
    const observer = new MutationObserver(changed);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [attribute] });
    return () => observer.disconnect();
  }, [attribute]);
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
