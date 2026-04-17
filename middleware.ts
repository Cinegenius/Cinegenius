import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/profile/(.*)",
  "/companies/(.*)",
  "/projects/(.*)",
  "/locations/(.*)",
  "/jobs/(.*)",
  "/creators(.*)",
  "/props(.*)",
  "/api/listings(.*)",
  "/api/reviews(.*)",
  "/api/search(.*)",
  "/api/profile(.*)",
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Protect non-public routes
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  // Security headers on every response
  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com https://*.clerk.accounts.dev https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://www.google.com https://images.unsplash.com https://upload.wikimedia.org",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://api.clerk.com https://*.clerk.accounts.dev wss://*.supabase.co",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'none'",
    ].join("; ")
  );
  return res;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
