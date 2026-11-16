// Fixed policy dates, never a rolling one-year promise on every page load.
// Before the FIRST production publication, align these dates with that release.
// Later deployments must preserve the published promise, not shorten it.
export const COMMUNITY_POLICY_PUBLISHED_ON = "2026-11-16";
export const COMMUNITY_FREE_THROUGH = "2027-11-16";

export function communityPolicyDates(locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "long", timeZone: "UTC",
  });
  return {
    start: formatter.format(new Date(`${COMMUNITY_POLICY_PUBLISHED_ON}T00:00:00Z`)),
    end: formatter.format(new Date(`${COMMUNITY_FREE_THROUGH}T00:00:00Z`)),
  };
}
