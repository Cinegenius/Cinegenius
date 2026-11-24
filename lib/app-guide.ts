export const APP_GUIDE_KEY = "cg_app_guide_v1";
let completedInMemory = false;

/** Device-local UI preference only; no identity, chat, permission or server state. */
export function appGuideCompleted(): boolean {
  if (completedInMemory) return true;
  try { return window.localStorage.getItem(APP_GUIDE_KEY) === "done"; }
  catch { return false; }
}

export function completeAppGuide(): void {
  completedInMemory = true;
  try { window.localStorage.setItem(APP_GUIDE_KEY, "done"); } catch { /* Still usable with storage disabled. */ }
}

export function appGuideCanOpen(): boolean {
  const root = document.documentElement;
  if (window.top !== window.self || document.visibilityState === "hidden"
    || root.getAttribute("data-cg-native-community-appearance") !== "app"
    || root.getAttribute("data-native-app-boot-ready") !== "v1"
    || /^\/(?:sign-in|sign-up|profile-setup|work)(?:\/|$)/.test(location.pathname)
    || ["/agb", "/datenschutz", "/impressum", "/app/workspace"].includes(location.pathname)
    || document.body.inert || document.querySelector("main[inert]")) return false;
  const active = document.activeElement as HTMLElement | null;
  if (active?.isContentEditable || active?.closest("input,textarea,select,[contenteditable='true']")) return false;
  return !Array.from(document.querySelectorAll('dialog[open],[aria-modal="true"],[data-genie-panel-open="true"]'))
    .some(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
}

/** Wait for an actually visible community surface, never open over native Work. */
export function observeFirstAppGuide(onOpen: () => void): () => void {
  let opened = false, frame = 0;
  const check = () => {
    frame = 0;
    if (!opened && !appGuideCompleted() && appGuideCanOpen()) { opened = true; onOpen(); }
  };
  const schedule = () => { if (!opened && !frame) frame = requestAnimationFrame(check); };
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true,
    attributeFilter: ["data-native-app-boot-ready", "data-cg-native-community-appearance", "open", "inert", "hidden"] });
  document.addEventListener("visibilitychange", schedule);
  document.addEventListener("focusout", schedule);
  window.addEventListener("cinegenius:app-resume", schedule);
  schedule();
  return () => {
    cancelAnimationFrame(frame); observer.disconnect();
    document.removeEventListener("visibilitychange", schedule);
    document.removeEventListener("focusout", schedule);
    window.removeEventListener("cinegenius:app-resume", schedule);
  };
}
