import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Routes that require auth
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/profile(.*)",
  "/booking(.*)",
  "/inserat(.*)",
]);

// Routes that require auth but NOT a profile yet
const isOnboardingRoute = createRouteMatcher(["/profile-setup(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  try {
    const { userId } = await auth();

    // /profile-setup: must be logged in
    if (isOnboardingRoute(req)) {
      if (!userId) {
        const signInUrl = new URL("/sign-in", req.url);
        signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname);
        return NextResponse.redirect(signInUrl);
      }
      return NextResponse.next();
    }

    // Protected routes: just require login, pages handle profile check themselves
    if (isProtectedRoute(req)) {
      if (!userId) {
        const signInUrl = new URL("/sign-in", req.url);
        signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname);
        return NextResponse.redirect(signInUrl);
      }
    }
  } catch {
    // If Clerk fails (e.g. dev keys on non-localhost), allow request through
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
