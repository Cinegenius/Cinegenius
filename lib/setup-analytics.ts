/** Closed values only: never pass a draft, form input, account ID or error text. */
export const SETUP_ANALYTICS_EVENTS = ["setup_step_viewed", "setup_submitted", "setup_error", "setup_completed"] as const;
export type SetupAnalyticsEvent = (typeof SETUP_ANALYTICS_EVENTS)[number];
export type SetupAnalyticsFlow = "registration" | "profile_setup";
export type SetupAnalyticsArea = "unselected" | "crew" | "talent" | "company" | "location" | "equipment" | "search" | "multiple";
export type SetupAnalyticsError = "validation_or_request" | "load_failed" | "rate_limited" | "required_fields";
export type SetupAnalyticsContext = { flow: SetupAnalyticsFlow; step: string; area: SetupAnalyticsArea };
const areas = new Set(["unselected", "crew", "talent", "company", "location", "equipment", "search", "multiple"]);
const steps = {
  registration: new Set(["credentials", "verify"]),
  profile_setup: new Set(["loading", "welcome", "name", "goals", "location", "details", "intro", "review"]),
};
const errors = new Set(["validation_or_request", "load_failed", "rate_limited", "required_fields"]);

export function setupAnalyticsArea(intents: readonly string[]): SetupAnalyticsArea {
  if (!intents.length) return "unselected";
  if (intents.length > 1) return "multiple";
  return areas.has(intents[0]) ? intents[0] as SetupAnalyticsArea : "unselected";
}

export function setupAnalyticsFlow(path: string): SetupAnalyticsFlow | null {
  return path === "/sign-up" ? "registration" : path === "/profile-setup" ? "profile_setup" : null;
}

export function setupAnalyticsProperties(event: string, values: Record<string, unknown>, path: string) {
  const flow = setupAnalyticsFlow(path);
  if (!flow || values.flow !== flow || !(SETUP_ANALYTICS_EVENTS as readonly string[]).includes(event)
    || typeof values.step !== "string" || !steps[flow].has(values.step)
    || typeof values.area !== "string" || !areas.has(values.area)
    || (flow === "registration" && values.area !== "unselected")
    || (event === "setup_completed" && flow === "profile_setup" && values.step !== "review")) return null;
  if (event === "setup_error" && (typeof values.error_code !== "string" || !errors.has(values.error_code))) return null;
  // Intentionally no URL/path, even on the two explicitly allowed setup routes.
  return { flow, step: values.step, area: values.area, measurement_version: 1, $ip: null,
    ...(event === "setup_error" ? {error_code: values.error_code as SetupAnalyticsError} : {}) };
}
