export const BEFORE_FORM_NAVIGATION_EVENT = "cinegenius:before-form-navigation";

/** Dismiss top-layer navigation before the existing private-draft guard takes focus. */
export function announceFormNavigation() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(BEFORE_FORM_NAVIGATION_EVENT));
}
