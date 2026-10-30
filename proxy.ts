import { trustedMutationOrigin } from "@/lib/request-origin";
import { mediaOptimizerBlockStatus } from "@/lib/media-optimizer-guard";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { isProtectedCreatePath, isPublicProfilePath } from "@/lib/public-access";

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

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
  "/api/media": { limit: 120, windowMs: 60_000 },
  "/api/community-image": { limit: 120, windowMs: 60_000 },
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

// ── CSRF: Origin/Referer check for mutating API requests ─────────────────────

function csrfCheck(request: NextRequest): NextResponse | null {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return null;
  if (!request.nextUrl.pathname.startsWith("/api/")) return null;
  if (request.nextUrl.pathname.startsWith("/api/webhooks/")) return null;

  if (!trustedMutationOrigin({
    requestUrl: request.url,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    development: process.env.NODE_ENV !== "production",
    deploymentHost: process.env.VERCEL_URL,
  })) {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
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
  "/trust",
  "/ki-transparenz",
  "/bildrechte",
  "/marketplace(.*)",
]);

// A single profile slug is public. The profile editor at /profile and any
// nested management routes must require a session.
// Webhook routes — completely bypass Clerk auth; each handler must verify
// the provider signature (Stripe, Clerk, etc.) independently.
const isWebhookRoute = createRouteMatcher(["/api/webhooks/(.*)"]);

// API routes where GET is public — mutations (POST/PATCH/PUT/DELETE) require auth.
// This prevents a missed requireAuth() in a handler from opening write access.
const isPublicApiGet = createRouteMatcher([
  "/api/community-image",
  "/api/media/(.*)",
  "/api/listings(.*)",
  "/api/reviews(.*)",
  "/api/search(.*)",
  "/api/external-profiles(.*)",
  "/api/projects(.*)",
  "/api/companies",
  "/api/companies/(.*)",
  "/api/community-posts(.*)",
  "/api/creators(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  // Auth-dependent images must never enter Next's shared optimizer cache.
  if (request.nextUrl.pathname === "/_next/image") {
    const blocked = await mediaOptimizerBlockStatus(request.nextUrl.searchParams.get("url") ?? "", request.url, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (blocked) return new NextResponse(null, { status: blocked, headers: { "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" } });
    return NextResponse.next();
  }
  // Webhooks must never be redirected — bypass everything immediately
  if (request.nextUrl.pathname.startsWith("/api/webhooks/")) {
    return NextResponse.next();
  }

  // 1. IP-based rate limiting — runs before auth to reject floods cheaply
  const rateLimitRes = ipRateLimit(request);
  if (rateLimitRes) return rateLimitRes;

  // 1b. CSRF check — reject mutating API requests from unknown origins
  const csrfRes = csrfCheck(request);
  if (csrfRes) return csrfRes;

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
        : NextResponse.redirect(new URL(`/sign-in?redirect_url=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`, request.url));
    }

    if (!getAdminIds().has(userId)) {
      // Authenticated but not an admin
      return isApi
        ? NextResponse.json({ error: "Kein Zugriff" }, { status: 403 })
        : NextResponse.redirect(new URL("/", request.url));
    }

    // Verified admin — fall through to security headers
  } else if (isWebhookRoute(request)) {
    // 3a. Webhook routes — skip Clerk auth entirely; signature verified per-handler
  } else if (isApi && !isPublicApiGet(request)) {
    // Private fetch endpoints must not follow Clerk's hosted sign-in redirect
    // after logout/session expiry. Keep the existing authenticated-session
    // protection, and return a non-cacheable JSON failure for signed-out calls.
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ code: "account" }, { status: 401, headers: { "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" } });
    await auth.protect();
  } else if (isPublicApiGet(request)) {
    // 3b. Public-GET API — only protect mutations so a missed handler check
    //     doesn't silently open write access to unauthenticated callers.
    if (!["GET", "HEAD"].includes(request.method)) await auth.protect();
  } else if (isProtectedCreatePath(request.nextUrl.pathname) || (!isPublicRoute(request) && !isPublicProfilePath(request.nextUrl.pathname))) {
    // 3c. Session-only protection for all other non-public routes
    if (request.method === "GET" && !isApi) {
      // Keep unauthenticated browser navigation on the app's own host. The
      // Clerk instance can otherwise send users to accounts.cinegenius.co,
      // which is not a Vercel deployment domain and currently returns 404.
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set(
        "redirect_url",
        `${request.nextUrl.pathname}${request.nextUrl.search}`
      );
      await auth.protect({ unauthenticatedUrl: signInUrl.toString() });
    } else {
      await auth.protect();
    }
  }

  // 4. Security headers on every response
  // Nonce enables strict-dynamic: modern browsers treat unsafe-inline as ignored
  // when strict-dynamic is present, giving nonce-level protection while keeping
  // unsafe-inline as a fallback for legacy browsers and Clerk's UI scripts.
  const nonce = generateNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("X-Nonce", nonce); // Clerk v7 reads this automatically
  // Override any client-supplied value; the dashboard uses this only as a safe return path.
  const returnUrl = new URL(request.url);
  returnUrl.searchParams.delete("_rsc");
  requestHeaders.set("X-CineGenius-Return-Path", `${returnUrl.pathname}${returnUrl.search}`);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  if (request.nextUrl.pathname.startsWith("/admin/review/") || request.nextUrl.pathname.startsWith("/api/admin/reviews/")) {
    res.headers.set("Cache-Control", "private, no-store, max-age=0");
    res.headers.set("CDN-Cache-Control", "no-store");
    res.headers.set("Vercel-CDN-Cache-Control", "no-store");
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://*.clerk.com https://*.clerk.accounts.dev https://*.cinegenius.co https://js.stripe.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://www.google.com https://images.unsplash.com https://plus.unsplash.com https://upload.wikimedia.org https://img.clerk.com https://*.cinegenius.co https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.basemaps.cartocdn.com https://server.arcgisonline.com",
      "font-src 'self' data:",
      `connect-src 'self'${process.env.NODE_ENV !== "production" ? " ws://localhost:* wss://localhost:* http://localhost:*" : ""} https://*.supabase.co https://*.clerk.com https://api.clerk.com https://*.clerk.accounts.dev https://*.cinegenius.co wss://*.supabase.co`,
      "frame-src https://js.stripe.com https://hooks.stripe.com https://*.clerk.com https://*.clerk.accounts.dev https://*.cinegenius.co",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
    ].join("; ")
  );
  return res;
});

export const config = {
  matcher: [
    "/api/media/:path*",
    "/_next/image",
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
