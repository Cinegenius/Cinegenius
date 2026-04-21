/**
 * lib/guards.ts
 * Re-exports from lib/auth for backwards compatibility.
 * All code should import from "@/lib/auth" directly.
 */
export { getCurrentUser, requireAuth, requireAdmin, isAdminSession, assertOwner } from "@/lib/auth";
