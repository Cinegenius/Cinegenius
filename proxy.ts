import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// ── Rate limiting — simple in-memory sliding window ──────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  "/api/upload/avatar":  { limit: 5,  windowMs: 60_000 },
  "/api/upload":         { limit: 20, windowMs: 60_000 },
  "/api/applications":   { limit: 10, windowMs: 60_000 },
  "/api/conversations":  { limit: 60, windowMs: 60_000 },
  "/api/messages":       { limit: 60, windowMs: 60_000 },
  "/api/profile":        { limit: 30, windowMs: 60_000 },
  "/api/listings":       { limit: 30, windowMs: 60_000 },
};

function rateLimit(req: NextRequest): NextResponse | null {
  const path = req.nextUrl.pathname;
  const rule = Object.entries(RATE_LIMITS).find(([prefix]) => path.startsWith(prefix))?.[1];
  if (!rule) return null;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const key = `${ip}:${path}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + rule.windowMs });
    return null;
  }

  entry.count++;
  if (entry.count > rule.limit) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte kurz warten." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
          "X-RateLimit-Limit": String(rule.limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return null;
}

// ── Public routes (everything else is auth-protected) ────────────────────────
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
  "/vehicles(.*)",
  "/search(.*)",
  "/photo(.*)",
  "/bts(.*)",
  "/social-media(.*)",
  "/impressum(.*)",
  "/datenschutz(.*)",
  "/api/listings(.*)",
  "/api/reviews(.*)",
  "/api/search(.*)",
  "/api/external-profiles(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  // Rate limiting first
  const rateLimitRes = rateLimit(request);
  if (rateLimitRes) return rateLimitRes;

  // Auth protection
  if (!isPublicRoute(request)) {
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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.com https://*.clerk.accounts.dev https://*.cinegenius.co https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://www.google.com https://images.unsplash.com https://plus.unsplash.com https://upload.wikimedia.org https://img.clerk.com https://*.cinegenius.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://*.clerk.com https://api.clerk.com https://*.clerk.accounts.dev https://*.cinegenius.co wss://*.supabase.co",
      "frame-src https://js.stripe.com https://hooks.stripe.com https://*.clerk.com https://*.clerk.accounts.dev https://*.cinegenius.co",
      "worker-src 'self' blob:",
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
