import { NextRequest, NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// ── Rate limiting — simple in-memory sliding window ──────────────────────────
// Works per Vercel function instance. Good enough for abuse prevention.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  "/api/upload":          { limit: 20,  windowMs: 60_000 },   // 20 uploads/min
  "/api/upload/avatar":   { limit: 5,   windowMs: 60_000 },   // 5 avatar uploads/min
  "/api/applications":    { limit: 10,  windowMs: 60_000 },   // 10 applications/min
  "/api/conversations":   { limit: 60,  windowMs: 60_000 },   // 60 req/min
  "/api/messages":        { limit: 60,  windowMs: 60_000 },
  "/api/profile":         { limit: 30,  windowMs: 60_000 },
  "/api/listings":        { limit: 30,  windowMs: 60_000 },
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
  const now  = Date.now();
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

// ── Protected routes ──────────────────────────────────────────────────────────
const isProtected = createRouteMatcher([
  "/dashboard(.*)",
  "/profile(.*)",
  "/messages(.*)",
  "/notifications(.*)",
  "/inserat(.*)",
  "/profile-setup(.*)",
  "/company-setup(.*)",
  "/admin(.*)",
  "/api/profile(.*)",
  "/api/upload(.*)",
  "/api/applications(.*)",
  "/api/conversations(.*)",
  "/api/messages(.*)",
  "/api/listings(.*)",
  "/api/notifications(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Rate limiting first
  const rateLimitRes = rateLimit(req);
  if (rateLimitRes) return rateLimitRes;

  // Auth protection
  if (isProtected(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
