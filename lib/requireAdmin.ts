import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Reads ADMIN_USER_IDS from env and returns the set of allowed admin Clerk user IDs.
 * The env var is a comma-separated list, e.g. "user_abc123,user_def456".
 */
function getAdminIds(): Set<string> {
  return new Set(
    (process.env.ADMIN_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/**
 * Use in API Route handlers.
 *
 * Returns { userId } if the caller is an authenticated admin.
 * Returns a 401/403 NextResponse otherwise — the caller must return it immediately:
 *
 *   const result = await requireAdmin();
 *   if (result instanceof NextResponse) return result;
 *   const { userId } = result;
 */
export async function requireAdmin(): Promise<{ userId: string } | NextResponse> {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  if (!getAdminIds().has(userId)) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  return { userId };
}

/**
 * Use in Server Components / Layouts.
 * Returns true if the current session is an admin, false otherwise.
 * Does NOT redirect — the caller handles that.
 */
export async function isAdminSession(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  return getAdminIds().has(userId);
}
