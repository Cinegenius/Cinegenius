import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";

type Participant = { user_id: string; display_name: string | null; slug: string | null; avatar_url: string | null };

/** Keep account-only recipients identifiable in the protected support inbox without inventing profile links. */
export async function adminSupportParticipants(ids: string[], profiles: Participant[]) {
  const participants = new Map(profiles.map(profile => [profile.user_id, profile]));
  const missing = [...new Set(ids)].filter(id => !participants.has(id));
  if (!missing.length) return participants;
  const t = await getTranslations("AdminAccounts");
  const clerk = await clerkClient();
  for (let offset = 0; offset < missing.length; offset += 100) {
    const { data } = await clerk.users.getUserList({ userId: missing.slice(offset, offset + 100), limit: 100 });
    for (const user of data) participants.set(user.id, {
      user_id: user.id, display_name: [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || t("unnamed"),
      slug: null, avatar_url: null,
    });
  }
  return participants;
}
