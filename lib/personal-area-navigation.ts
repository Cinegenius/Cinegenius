/** Saved links keep working while each task has a single canonical screen. */
export function dashboardLegacyDestination(params: Pick<URLSearchParams, "get">): string | null {
  const tab = params.get("tab");
  if (tab === "profil") return "/profile";
  if (tab === "favorites") return "/favorites";
  if (tab === "friends") return "/messages?view=friends";
  if (tab === "firma") return "/company-dashboard";
  if (tab === "messages") {
    const conversation = params.get("conversation") ?? params.get("conv");
    return conversation ? `/messages?conv=${encodeURIComponent(conversation)}` : "/messages";
  }
  return null;
}
