import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// ── Admin ID lookup (mirrors lib/auth/index.ts — duplicated intentionally
//    because middleware cannot import server-only modules) ────────────────────
function getAdminIds(): Set<string> {
  return new Set(
    (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  );
}

// ── IP-based rate limiting — first line of defence ───────────────────────────
// NOTE: in-memory map resets on cold start and is not shared across
// Vercel function instances. This is intentional — it provides a best-effort
// per-instance limit. Per-user limits are enforced in each route handler via
// lib/rateLimit.ts (Supabase-backed, durable).
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  "/api/upload/avatar":  { limit: 5,  windowMs: 60_000 },
  "/api/upload":         { limit: 20, windowMs: 60_000 },
  "/api/applications":   { limit: 10, windowMs: 60_000 },
  "/api/conversations":  { limit: 60, windowMs: 60_000 },
  "/api/messages":       { limit: 60, windowMs: 60_000 },
  "/api/profile":        { limit: 30, windowMs: 60_000 },
  "/api/listings":       { limit: 30, windowMs: 60_000 },
  "/api/reviews":        { limit: 10, windowMs: 60_000 },
  "/api/reports":        { limit: 10, windowMs: 60_000 },
  "/api/blocks":         { limit: 20, windowMs: 60_000 },
  "/api/search":         { limit: 30, windowMs: 60_000 },
  "/api/notifications":  { limit: 60, windowMs: 60_000 },
  "/api/unread-count":   { limit: 60, windowMs: 60_000 },
  "/api/favorites":      { limit: 30, windowMs: 60_000 },
};

function ipRateLimit(req: NextRequest): NextResponse | null {
  const path = req.nextUrl.pathname;
  const rule = Object.entries(RATE_LIMITS).find(([prefix]) => path.startsWith(prefix))?.[1];
  if (!rule) return null;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  // Use matched prefix as key so sub-paths like /api/upload/avatar all count
  // against the same bucket — prevents bypass via different sub-routes
  const prefix = Object.keys(RATE_LIMITS).find((p) => path.startsWith(p))!;
  const key = `${ip}:${prefix}`;
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

// ── Route matchers ────────────────────────────────────────────────────────────

// Admin routes — require both a valid session AND admin role.
// Covers both the /admin UI and all /api/admin/* endpoints.
const isAdminRoute = createRouteMatcher(["/admin(.*)", "/api/admin(.*)"]);

// Public page routes — no session required.
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/profile/(.*)",
  "/companies(.*)",
  "/projects(.*)",
  "/locations(.*)",
  "/jobs(.*)",
  "/creators(.*)",
  "/props(.*)",
  "/vehicles(.*)",
  "/tiere(.*)",
  "/crew(.*)",
  "/search(.*)",
  "/photo(.*)",
  "/bts(.*)",
  "/social-media(.*)",
  "/impressum(.*)",
  "/datenschutz(.*)",
  "/agb(.*)",
  "/about(.*)",
  "/pricing(.*)",
  "/help(.*)",
  "/marketplace(.*)",
]);

// API routes where GET is public — mutations (POST/PATCH/PUT/DELETE) require auth.
// This prevents a missed requireAuth() in a handler from opening write access.
const isPublicApiGet = createRouteMatcher([
  "/api/listings(.*)",
  "/api/reviews(.*)",
  "/api/search(.*)",
  "/api/external-profiles(.*)",
  "/api/webhooks/(.*)",
  "/api/projects(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  // 1. IP-based rate limiting — runs before auth to reject floods cheaply
  const rateLimitRes = ipRateLimit(request);
  if (rateLimitRes) return rateLimitRes;

  const isApi = request.nextUrl.pathname.startsWith("/api/");

  // 2. Admin route guard — enforces both session + admin role
  //    This runs BEFORE the generic auth.protect() so non-admin authenticated
  //    users are blocked here, not after reaching the layout or route handler.
  if (isAdminRoute(request)) {
    const { userId } = await auth();

    if (!userId) {
      // Not authenticated
      return isApi
        ? NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 })
        : NextResponse.redirect(new URL("/sign-in", request.url));
    }

    if (!getAdminIds().has(userId)) {
      // Authenticated but not an admin
      return isApi
        ? NextResponse.json({ error: "Kein Zugriff" }, { status: 403 })
        : NextResponse.redirect(new URL("/", request.url));
    }

    // Verified admin — fall through to security headers
  } else if (isPublicApiGet(request)) {
    // 3a. Public-GET API — only protect mutations so a missed handler check
    //     doesn't silently open write access to unauthenticated callers.
    if (request.method !== "GET") await auth.protect();
  } else if (!isPublicRoute(request)) {
    // 3b. Session-only protection for all other non-public routes
    await auth.protect();
  }

  // 4. Security headers on every response
  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://*.clerk.com https://*.clerk.accounts.dev https://*.cinegenius.co https://js.stripe.com",
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
