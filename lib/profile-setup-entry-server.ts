import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requiredSetupDestination, type SetupProgress } from "@/lib/profile-setup-flow";

/** Resolve before dashboard HTML is rendered, including direct visits and repeat logins. */
export async function getRequiredSetupEntry(userId: string) {
  const [user, profile] = await Promise.all([
    clerkClient().then(clerk => clerk.users.getUser(userId)),
    db.from("profiles").select("display_name,location,positions,role,profile_type,profile_types").eq("user_id", userId).maybeSingle(),
  ]);
  if (profile.error) throw new Error("Setup profile status unavailable");
  const saved = user.privateMetadata?.cinegeniusOnboarding;
  return requiredSetupDestination(profile.data, saved && typeof saved === "object" ? saved as SetupProgress : null);
}
