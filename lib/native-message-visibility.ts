"use client";
import {useSyncExternalStore} from "react";

export const NATIVE_WORKSPACE_COVERED = "data-native-workspace-covered";
const events = ["cinegenius:native-workspace-presented", "cinegenius:native-workspace-dismissed"];
/** Visibility only. Neither an attribute nor an event authorizes a message read. */
export function nativeMessageVisibleSnapshot() {
  return typeof document === "undefined" || document.visibilityState !== "hidden"
    && !document.documentElement?.hasAttribute(NATIVE_WORKSPACE_COVERED);
}
export function subscribeNativeMessageVisibility(changed: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  let previous = nativeMessageVisibleSnapshot();
  const update = () => {const next = nativeMessageVisibleSnapshot();if (next !== previous) {previous = next;changed();}};
  const observer = new MutationObserver(update);
  observer.observe(document.documentElement, {attributes:true,attributeFilter:[NATIVE_WORKSPACE_COVERED]});
  document.addEventListener("visibilitychange", update);
  events.forEach(event => window.addEventListener(event, update));
  return () => {observer.disconnect();document.removeEventListener("visibilitychange",update);events.forEach(event => window.removeEventListener(event,update));};
}
const serverSnapshot = () => true;
const noSubscribe = () => () => {};
export function useNativeMessageVisibility(active: boolean) {
  const visible = useSyncExternalStore(active ? subscribeNativeMessageVisibility : noSubscribe,active ? nativeMessageVisibleSnapshot : serverSnapshot,serverSnapshot);
  return !active || visible;
}
