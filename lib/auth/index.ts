/**
 * lib/auth/index.ts
 * Central authentication and authorization module.
 *
 * All API routes import from here instead of calling Clerk's auth() directly.
 *
 * Usage:
 *
 *   // Require authentication:
 *   const authResult = await requireAuth();
 *   if (authResult instanceof NextResponse) return authResult;
 *   const { userId } = authResult;
 *
 *   // Optional authentication (returns null when not logged in):
 *   const user = await getCurrentUser();
 *   const userId = user?.userId;
 *
 *   // Admin-only:
 *   const authResult = await requireAdmin();
 *   if (authResult instanceof NextResponse) return authResult;
 *   const { userId } = authResult;
 *
 *   // Ownership check after DB fetch:
 *   const ownershipError = assertOwner(resource.owner_id, userId);
 *   if (ownershipError) return ownershipError;
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

function getAdminIds(): Set<string> {
  return new Set(
    (process.env.ADMIN_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/**
 * Returns the current user's ID, or null if not authenticated.
 * Use for routes where auth is optional (e.g. return empty list for guests).
 */
export async function getCurrentUser(): Promise<{ userId: string } | null> {
  const { userId } = await auth();
  return userId ? { userId } : null;
}

/**
 * Verifies the request has a valid Clerk session.
 * Returns { userId } on success, 401 NextResponse if unauthenticated.
 */
export async function requireAuth(): Promise<{ userId: string } | NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }
  return { userId };
}

/**
 * Verifies the request is from an admin (ADMIN_USER_IDS env var).
 * Returns { userId } on success, 401 or 403 NextResponse otherwise.
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
 * For use in Server Components and Layouts (not API routes).
 * Returns true if the current Clerk session belongs to an admin.
 */
export async function isAdminSession(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  return getAdminIds().has(userId);
}

/**
 * Synchronous ownership check. Call AFTER fetching the resource from DB.
 *
 * - Returns null  when userId === resourceOwnerId  (proceed)
 * - Returns 404   when resourceOwnerId is null/undefined  (resource not found)
 * - Returns 403   when resourceOwnerId !== userId  (forbidden)
 *
 * Why 404 for missing resource: avoids leaking whether a resource exists to
 * unauthenticated or unauthorized callers.
 */
export function assertOwner(
  resourceOwnerId: string | null | undefined,
  userId: string
): NextResponse | null {
  if (resourceOwnerId == null) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  if (resourceOwnerId !== userId) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  return null;
}
