import { editorialCredentialValid, editorialRouteAllowed } from "@/lib/editorial-agent-policy";
import { createTranslator } from "next-intl";
import { loadMessages } from "@/lib/i18n/messages";
import { resolveLocale } from "@/lib/i18n/locales";
import { trustedMutationOrigin } from "@/lib/request-origin";
import { mediaOptimizerBlockStatus } from "@/lib/media-optimizer-guard";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
async function localizedProxyError(request: NextRequest, key: string, init: ResponseInit): Promise<NextResponse> {
  const locale = resolveLocale(request.cookies.get("cg_locale")?.value, request.headers.get("accept-language") ?? "", request.headers.get('x-vercel-ip-country') ?? '');
  const messages = await loadMessages(locale);
  const system = messages.System as Record<string, string>;
  const copy = createTranslator({locale, messages: {System: system}, namespace: "System"});
  const headers = new Headers(init.headers);
  // Authentication, origin and quota failures belong to the current request,
  // including failures returned before a private route handler can set headers.
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Vercel-CDN-Cache-Control', 'no-store');
  return NextResponse.json({error: copy(key)}, {...init, headers});
}

function genieAuthFailure(status: 401 | 503): NextResponse {
  const error = status === 401 ? "unauthorized" : "unavailable";
  return NextResponse.json({ error }, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

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
  "/api/genie": { limit: 20, windowMs: 60_000 },
  "/api/content-translations": { limit: 120, windowMs: 60_000 },
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
  "/api/inbox":          { limit: 60, windowMs: 60_000 },
  "/api/notifications":  { limit: 60, windowMs: 60_000 },
  "/api/unread-count":   { limit: 60, windowMs: 60_000 },
  "/api/favorites":      { limit: 30, windowMs: 60_000 },
};

async function ipRateLimit(req: NextRequest): Promise<NextResponse | null> {
  const requestedPath = req.nextUrl.pathname;
  // Native and Web writes share the existing conversation IP budget.
  const path = requestedPath === '/api/native/v1/conversations' || requestedPath.startsWith('/api/native/v1/conversations/')
    ? requestedPath.replace('/api/native/v1/conversations', '/api/conversations') : requestedPath;
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
    if (prefix === "/api/genie") {
      return NextResponse.json({ error: "rate_limited" }, {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
          "Cache-Control": "private, no-store, max-age=0",
          "CDN-Cache-Control": "no-store",
          "Vercel-CDN-Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return localizedProxyError(
      req, "m_35bd89251439",
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

async function csrfCheck(request: NextRequest): Promise<NextResponse | null> {
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
    return localizedProxyError(request, "m_cd2f7b0a21cd", {status: 403});
  }
  return null;
}

// ── Route matchers ────────────────────────────────────────────────────────────

// Admin routes — require both a valid session AND admin role.
// Covers both the /admin UI and all /api/admin/* endpoints.
const isAdminRoute = createRouteMatcher(["/admin(.*)", "/api/admin(.*)"]);

// Public page routes — no session required.
const isPublicRoute = createRouteMatcher([
  "/", /^\/sign-in(?:\/.*)?$/, /^\/sign-up(?:\/.*)?$/,
  "/impressum", "/datenschutz", "/agb", "/bildrechte", "/ki-transparenz",
  "/trust", "/melden", "/newsletter/confirm", "/newsletter/unsubscribe",
  "/manifest.webmanifest", "/robots.txt", "/sitemap.xml",
  "/favicon.ico", "/icon", "/icon.svg", "/apple-icon",
  "/apple-touch-icon.png", "/apple-touch-icon-precomposed.png",
  "/cinegenius-logo.svg", "/cinegenius-logo-dark.svg",
  "/hero-bg.jpg", "/hero-bg-v2.jpg",
]);

// Webhook routes — completely bypass Clerk auth; each handler must verify
// the provider signature (Stripe, Clerk, etc.) independently.
const isWebhookRoute = createRouteMatcher(["/api/webhooks/(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  // Dedicated machine requests never acquire a Clerk/member/admin session.
  // Only exact editorial routes and a valid server credential bypass cookie CSRF.
  if (request.nextUrl.pathname.startsWith("/api/editorial/")) {
    const headers = { "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" };
    if (!editorialRouteAllowed(request.nextUrl.pathname, request.method)) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
    if (!editorialCredentialValid(request.headers.get("authorization"), process.env.CINEGENIUS_EDITORIAL_ENABLED, process.env.CINEGENIUS_EDITORIAL_TOKEN_SHA256)) return NextResponse.json({ error: "editorial_unauthorized" }, { status: 401, headers });
    return NextResponse.next({ headers });
  }

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
  const isGeniePost = request.method === "POST" && ["/api/genie", "/api/genie/transcribe"].includes(request.nextUrl.pathname);
  if (isGeniePost) {
    // Guests may see Genie, but cannot consume even its early IP allowance.
    // The handler rechecks the verified session before durable quota/provider work.
    try {
      const { userId } = await auth();
      if (!userId) return genieAuthFailure(401);
    } catch {
      return genieAuthFailure(503);
    }
  }

  // 1. IP-based rate limiting — other routes retain their early flood protection
  const rateLimitRes = await ipRateLimit(request);
  if (rateLimitRes) return rateLimitRes;

  // 1b. CSRF check — reject mutating API requests from unknown origins
  const csrfRes = await csrfCheck(request);
  if (csrfRes) {
    if (["/api/genie", "/api/genie/transcribe"].includes(request.nextUrl.pathname)) {
      csrfRes.headers.set("Cache-Control", "private, no-store, max-age=0");
      csrfRes.headers.set("CDN-Cache-Control", "no-store");
      csrfRes.headers.set("Vercel-CDN-Cache-Control", "no-store");
    }
    return csrfRes;
  }

  const isApi = request.nextUrl.pathname.startsWith("/api/");
  const isPublicNewsletterAction = request.method === "POST" && [
    "/api/newsletter/subscribe", "/api/newsletter/confirm", "/api/newsletter/unsubscribe",
  ].includes(request.nextUrl.pathname);
  const isSmartSearchRead = request.method === "POST" && request.nextUrl.pathname === "/api/search/unified";
  const isPublicReportPost = request.method === "POST" && request.nextUrl.pathname === "/api/public-reports";
  const isLocaleUpdate = request.method === "POST" && request.nextUrl.pathname === "/api/locale";

  // 2. Admin route guard — enforces both session + admin role
  //    This runs BEFORE the generic auth.protect() so non-admin authenticated
  //    users are blocked here, not after reaching the layout or route handler.
  if (isAdminRoute(request)) {
    const { userId } = await auth();

    if (!userId) {
      // Not authenticated
      return isApi
        ? localizedProxyError(request, "m_352f63d9d1d9", {status: 401})
        : NextResponse.redirect(new URL(`/sign-in?redirect_url=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`, request.url));
    }

    if (!getAdminIds().has(userId)) {
      // Authenticated but not an admin
      return isApi
        ? localizedProxyError(request, "m_cd2f7b0a21cd", {status: 403})
        : NextResponse.redirect(new URL("/", request.url));
    }

    // Verified admin — fall through to security headers
  } else if (isWebhookRoute(request)) {
    // 3a. Webhook routes — skip Clerk auth entirely; signature verified per-handler
  } else if (request.method === "GET" && request.nextUrl.pathname === "/api/cron/listing-freshness") {
    // This exact scheduler route checks CRON_SECRET itself before any work.
    // Other cron paths and methods retain the normal session protection.
  } else if (["GET", "POST", "HEAD"].includes(request.method) && request.nextUrl.pathname === "/api/cron/profile-art") {
    // Exact fixed-input artwork worker; the handler verifies a scoped machine secret.
  } else if (isGeniePost) {
    // This exact endpoint already required authentication before its IP limit.
    // Origin protection above and the handler's own session/quota checks still
    // apply. No other method/path skips the normal auth.protect() rules.
  } else if (isPublicNewsletterAction) {
    // Newsletter opt-in and signed confirmation/unsubscribe links also serve
    // visitors without a member account. Origin checks above still apply;
    // handlers validate consent/tokens and retain their durable rate limits.
  } else if (isPublicReportPost) {
    // Public reports do not require a member account. Origin protection above
    // and the handler's validation/durable limits still apply to this exact POST.
  } else if (isLocaleUpdate) {
    // Language selection remains available before registration; CSRF still applies.
  } else if (isSmartSearchRead) {
    // Smart search is members-only, including saved/shared result plans.
    try {
      const { userId } = await auth();
      if (!userId) return genieAuthFailure(401);
      await auth.protect();
    } catch {
      return genieAuthFailure(503);
    }
    // The handler rechecks membership before quotas, body parsing and database work.
  } else if (isApi) {
    // Private fetch endpoints must not follow Clerk's hosted sign-in redirect
    // after logout/session expiry. Keep the existing authenticated-session
    // protection, and return a non-cacheable JSON failure for signed-out calls.
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ code: "account" }, { status: 401, headers: { "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" } });
    await auth.protect();
  } else if (!isPublicRoute(request)) {
    // 3c. Session-only protection for all other non-public routes
    if (["GET", "HEAD"].includes(request.method) && !isApi) {
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
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://*.clerk.com https://*.clerk.accounts.dev https://*.cinegenius.co https://js.stripe.com https://challenges.cloudflare.com https://*.protect.clerk.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://www.google.com https://images.unsplash.com https://plus.unsplash.com https://upload.wikimedia.org https://img.clerk.com https://*.cinegenius.co https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://tiles.openfreemap.org",
    "font-src 'self' data:",
    `connect-src 'self'${process.env.NODE_ENV !== "production" ? " ws://localhost:* wss://localhost:* http://localhost:*" : ""} https://eu.i.posthog.com https://*.supabase.co https://*.clerk.com https://api.clerk.com https://*.clerk.accounts.dev https://*.cinegenius.co wss://*.supabase.co https://*.protect.clerk.com:* https://tiles.openfreemap.org`,
    "frame-src https://js.stripe.com https://hooks.stripe.com https://*.clerk.com https://*.clerk.accounts.dev https://*.cinegenius.co https://challenges.cloudflare.com https://*.protect.clerk.com",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
  ].join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("X-Nonce", nonce);
  // Next and Clerk must render against the exact policy sent to this document.
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  // Override any client-supplied value; the dashboard uses this only as a safe return path.
  const returnUrl = new URL(request.url);
  returnUrl.searchParams.delete("_rsc");
  requestHeaders.set("X-CineGenius-Return-Path", `${returnUrl.pathname}${returnUrl.search}`);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  // Never share member documents or API responses between sessions.
  res.headers.set("Cache-Control", "private, no-store, max-age=0");
  res.headers.set("CDN-Cache-Control", "no-store");
  res.headers.set("Vercel-CDN-Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
  res.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return res;
});

export const config = {
  // File-like profile slugs and API/media paths must also pass authentication.
  matcher: ["/((?!_next/static/|api/webhooks/).*)"],
};
