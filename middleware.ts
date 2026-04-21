import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Routes that require the user to be logged in.
 * Unauthenticated users are redirected to /sign-in.
 */
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/profile-setup(.*)",
  "/inserat(.*)",
  "/messages(.*)",
  "/notifications(.*)",
  "/invoices(.*)",
  "/booking(.*)",
  "/favorites(.*)",
]);

/**
 * Routes that require admin access.
 * Non-admins get a 403 JSON response (API) or redirect to / (pages).
 */
const isAdminRoute = createRouteMatcher([
  "/admin(.*)",
  "/api/admin(.*)",
]);

const ADMIN_IDS = new Set(
  (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  const { pathname } = req.nextUrl;

  // ── Admin routes ────────────────────────────────────────────────────────────
  if (isAdminRoute(req)) {
    // Not logged in at all
    if (!userId) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
      }
      const signIn = new URL("/sign-in", req.url);
      signIn.searchParams.set("redirect_url", req.url);
      return NextResponse.redirect(signIn);
    }

    // Logged in but not admin
    if (!ADMIN_IDS.has(userId)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Admin — allow through
    return NextResponse.next();
  }

  // ── Protected routes (auth required) ────────────────────────────────────────
  if (isProtectedRoute(req) && !userId) {
    const signIn = new URL("/sign-in", req.url);
    signIn.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(signIn);
  }
});

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
