import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware(async (auth, request) => {
  const { userId, sessionClaims } = await auth();

  // Not logged in → pass through
  if (!userId) return NextResponse.next();

  // Never gate API routes
  if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();

  const meta = sessionClaims?.metadata as Record<string, unknown> | undefined;
  const cookieOk = request.cookies.get("cg_profile_ok")?.value === "1";
  const hasProfile = !!(meta?.profileComplete || cookieOk);

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/profile-setup")) {
    // Already has a profile → no second profile allowed, go to dashboard
    if (hasProfile) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Authenticated user without a completed profile → force profile setup
  if (!hasProfile) {
    const url = request.nextUrl.clone();
    url.pathname = "/profile-setup";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
