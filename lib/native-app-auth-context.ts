export const NATIVE_APP_AUTH_CONTEXT = "data-native-app-auth-context";

let activeClaim: symbol | undefined;

/** Ephemeral SDK-scope equality/revocation signal, never authentication or permission. */
export function installNativeAppAuthContext(): () => void {
  const root = document.documentElement, claim = Symbol();
  activeClaim = claim;
  root.removeAttribute(NATIVE_APP_AUTH_CONTEXT);
  const cleanup = () => {
    if (activeClaim !== claim) return;
    root.removeAttribute(NATIVE_APP_AUTH_CONTEXT);
    activeClaim = undefined;
  };
  // No storage, identity-derived value, native message, request, or weak RNG fallback.
  // Presentation events deliberately do not change this separate scope marker.
  if (window.top !== window.self || location.protocol !== "https:") return cleanup;
  try {
    const bytes = window.crypto.getRandomValues(new Uint8Array(16));
    root.setAttribute(NATIVE_APP_AUTH_CONTEXT, Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join(""));
  } catch {
    // Missing/failed crypto leaves native without a context, so it must fail closed.
  }
  return cleanup;
}
