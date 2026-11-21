/** Finish setup only after the choice is confirmed, before creating a public profile.
 * Saving this preference neither publishes a profile nor changes other audiences.
 */
export async function saveHomeCrewPreference(accountId: string, visible: boolean) {
  const response = await fetch("/api/user-settings", {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, show_in_home_crew: visible }),
    signal: AbortSignal.timeout(8000),
  });
  const body = await response.json();
  if (!response.ok || body.success !== true || body.settings?.show_in_home_crew !== visible) {
    throw new Error("Homepage preference not confirmed");
  }
}
