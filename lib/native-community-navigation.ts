import type { NativeAppArea } from "./native-app-navigation";

export const NATIVE_COMMUNITY_NAVIGATION_EVENT = "cinegenius:native-area-navigation";
export const NATIVE_COMMUNITY_ROUTER_READY = "data-native-app-area-router";
export type NativeCommunityArea = Exclude<NativeAppArea, "workspace">;
const areas: readonly string[] = ["shots", "news", "smart", "projects"];

/** Presentation only: four public tabs, no URLs, account values or permission. */
export function installNativeCommunityNavigation(nav: HTMLElement, choose: (area: NativeCommunityArea) => void): () => void {
  const previous = nav.getAttribute(NATIVE_COMMUNITY_ROUTER_READY);
  const event = (value: Event) => {
    const host = window as Window & { webkit?: { messageHandlers?: { cinegeniusWorkplace?: { postMessage?: unknown } } } };
    if (!(value instanceof CustomEvent) || !value.cancelable || value.target !== window || typeof value.detail !== "string"
      || !areas.includes(value.detail) || window.top !== window.self || location.protocol !== "https:"
      || typeof host.webkit?.messageHandlers?.cinegeniusWorkplace?.postMessage !== "function"
      || document.documentElement.getAttribute("data-cg-native-community-appearance") !== "app"
      || !nav.isConnected || nav.getAttribute(NATIVE_COMMUNITY_ROUTER_READY) !== "v1"
      || nav.getAttribute("data-native-app-gesture-ready") !== "v1") return;
    // Claim a recognized native intent before the existing draft/modal checks.
    // A blocked or delayed leave must never trigger a document-load fallback.
    value.preventDefault();
    choose(value.detail as NativeCommunityArea);
  };
  window.addEventListener(NATIVE_COMMUNITY_NAVIGATION_EVENT, event);
  nav.setAttribute(NATIVE_COMMUNITY_ROUTER_READY, "v1");
  return () => {
    window.removeEventListener(NATIVE_COMMUNITY_NAVIGATION_EVENT, event);
    if (previous === null) nav.removeAttribute(NATIVE_COMMUNITY_ROUTER_READY);
    else nav.setAttribute(NATIVE_COMMUNITY_ROUTER_READY, previous);
  };
}
