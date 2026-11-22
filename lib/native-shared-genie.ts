/** Presentation only. No identity, source data, requests or permissions cross this contract. */
export const SHARED_GENIE_PRESENTATION = "data-native-genie-presentation";
export const SHARED_GENIE_OWNER = "data-native-genie-owner-ready";
export const SHARED_GENIE_VERSION = "uikit-v1";
export const SHARED_GENIE_AVAILABILITY = "data-native-genie-availability";
export const SHARED_GENIE_LABEL = "data-native-genie-label";
export const SHARED_GENIE_OPEN = "cinegenius:native-genie-open";
export type NativeGenieAvailability = "available" | "blocked" | "hidden" | "open";

export function nativeGenieOwnerSnapshot(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined" || window.top !== window.self) return false;
  const host = window as unknown as { webkit?: { messageHandlers?: { bridge?: { postMessage?: unknown } } } };
  return typeof host.webkit?.messageHandlers?.bridge?.postMessage === "function"
    && document.documentElement?.getAttribute(SHARED_GENIE_OWNER) === SHARED_GENIE_VERSION;
}

export function nativeGenieEmbeddedSnapshot(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined" || window.top !== window.self) return false;
  const host = window as unknown as { webkit?: { messageHandlers?: { bridge?: { postMessage?: unknown } } } };
  return typeof host.webkit?.messageHandlers?.bridge?.postMessage === "function"
    && document.documentElement?.getAttribute(SHARED_GENIE_PRESENTATION) === "embedded-v1";
}

export function nativeGenieOwnerServerSnapshot(): null { return null; }

export function subscribeNativeGenieOwner(changed: () => void): () => void {
  if (typeof document === "undefined" || !document.documentElement) return () => {};
  const observer = new MutationObserver(changed);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [SHARED_GENIE_OWNER, SHARED_GENIE_PRESENTATION] });
  window.addEventListener("pageshow", changed);
  return () => { observer.disconnect(); window.removeEventListener("pageshow", changed); };
}

function visible(element: Element): boolean {
  const style = getComputedStyle(element);
  return element.getClientRects().length > 0 && style.display !== "none"
    && style.visibility !== "hidden" && Number(style.opacity || "1") > 0;
}

export function nativeGeniePresentation({ eligible, open }: { eligible: boolean; open: boolean }): NativeGenieAvailability {
  if (!nativeGenieOwnerSnapshot() || !eligible || document.visibilityState === "hidden"
    || /^\/(sign-in|sign-up|profile-setup)(\/|$)/.test(window.location.pathname)
    || ["/agb", "/datenschutz", "/impressum", "/offline.html"].includes(window.location.pathname)) return "hidden";
  if (open) return "open";
  if (document.body?.inert || document.querySelector("main[inert],header[inert],nav[data-native-app-bottom-nav][inert]")) return "blocked";
  return [...document.querySelectorAll('dialog[open],[aria-modal="true"],[data-genie-panel-open="true"]')].some(visible)
    ? "blocked" : "available";
}

export function publishNativeGeniePresentation(state: NativeGenieAvailability, label: string): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!root || !nativeGenieOwnerSnapshot()) return;
  const safeLabel = label.trim();
  const control = Array.from(safeLabel).some(character => { const code = character.codePointAt(0) ?? 0; return code < 32 || code === 127; });
  const nextLabel = safeLabel && safeLabel.length <= 120 && !control ? safeLabel : "Genie";
  if (root.getAttribute(SHARED_GENIE_AVAILABILITY) !== state) root.setAttribute(SHARED_GENIE_AVAILABILITY, state);
  if (root.getAttribute(SHARED_GENIE_LABEL) !== nextLabel) root.setAttribute(SHARED_GENIE_LABEL, nextLabel);
}
