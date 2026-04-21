/**
 * lib/guards.ts
 * Centralized authorization guards for all API routes.
 *
 * Usage pattern in route handlers:
 *
 *   // 1. Require authentication
 *   const authResult = await requireAuth();
 *   if (authResult instanceof NextResponse) return authResult;
 *   const { userId } = authResult;
 *
 *   // 2. Fetch resource from DB, then check ownership
 *   const ownershipError = assertOwner(resource.owner_id, userId);
 *   if (ownershipError) return ownershipError;
 *
 *   // 3. Admin-only routes
 *   const adminResult = await requireAdmin();
 *   if (adminResult instanceof NextResponse) return adminResult;
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getAdminIds(): Set<string> {
  return new Set(
    (process.env.ADMIN_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

// ---------------------------------------------------------------------------
// requireAuth
// ---------------------------------------------------------------------------

/**
 * Verifies the request has a valid Clerk session.
 *
 * Returns { userId } on success.
 * Returns a 401 NextResponse if the user is not authenticated.
 */
export async function requireAuth(): Promise<{ userId: string } | NextResponse> {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "Nicht eingeloggt" },
      { status: 401 }
    );
  }

  return { userId };
}

// ---------------------------------------------------------------------------
// assertOwner
// ---------------------------------------------------------------------------

/**
 * Synchronous ownership check. Call AFTER fetching the resource from the DB.
 *
 * - Returns null (= "OK, proceed") when userId matches resourceOwnerId.
 * - Returns a 403 NextResponse when they do not match.
 * - Returns a 404 NextResponse when resourceOwnerId is null/undefined,
 *   meaning the resource was not found at all.
 *
 * Why 404 for missing resource: avoids leaking whether a resource exists
 * to unauthenticated or unauthorized callers.
 */
export function assertOwner(
  resourceOwnerId: string | null | undefined,
  userId: string
): NextResponse | null {
  if (resourceOwnerId == null) {
    return NextResponse.json(
      { error: "Nicht gefunden" },
      { status: 404 }
    );
  }

  if (resourceOwnerId !== userId) {
    return NextResponse.json(
      { error: "Kein Zugriff" },
      { status: 403 }
    );
  }

  return null; // OK
}

// ---------------------------------------------------------------------------
// requireAdmin
// ---------------------------------------------------------------------------

/**
 * Verifies the request has a valid Clerk session AND the user is an admin.
 *
 * Returns { userId } on success.
 * Returns 401 if not authenticated.
 * Returns 403 if authenticated but not an admin.
 */
export async function requireAdmin(): Promise<{ userId: string } | NextResponse> {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "Nicht eingeloggt" },
      { status: 401 }
    );
  }

  if (!getAdminIds().has(userId)) {
    return NextResponse.json(
      { error: "Kein Zugriff" },
      { status: 403 }
    );
  }

  return { userId };
}

// ---------------------------------------------------------------------------
// isAdminSession
// ---------------------------------------------------------------------------

/**
 * For use in Server Components and Layouts (not API routes).
 * Returns true if the current Clerk session belongs to an admin.
 */
export async function isAdminSession(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  return getAdminIds().has(userId);
}
