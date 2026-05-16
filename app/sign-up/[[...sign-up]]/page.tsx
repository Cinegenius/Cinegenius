"use client";

import { SignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignUpForm() {
  const searchParams = useSearchParams();
  // Clerk uses "redirect_url", ProfileGuard uses "redirect"
  const redirect = searchParams.get("redirect_url") ?? searchParams.get("redirect");

  // After sign-up, go to profile-setup and carry the redirect along
  // so profile-setup can forward the user to their intended destination
  const afterSignUp = redirect
    ? `/profile-setup?redirect=${encodeURIComponent(redirect)}`
    : "/profile-setup";

  return (
    <SignUp
      forceRedirectUrl={afterSignUp}
      appearance={{
        variables: {
          colorPrimary: "#C2F135",
          colorTextOnPrimaryBackground: "#0A0A0A",
          colorBackground: "#1A1A1A",
          colorInputBackground: "#141414",
          colorInputText: "#EFEFEF",
          colorText: "#EFEFEF",
          colorTextSecondary: "#AAAAAA",
          colorNeutral: "#666666",
          borderRadius: "0.75rem",
          fontFamily: "Inter, system-ui, sans-serif",
        },
        elements: {
          headerTitle: "hidden",
          headerSubtitle: "hidden",
        },
      }}
    />
  );
}

export default function SignUpPage() {
  return (
    <div className="pt-16 min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">Kostenlos starten</p>
          <h1 className="font-display text-3xl font-bold text-text-primary">Account erstellen</h1>
        </div>
        <Suspense fallback={
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-bg-elevated animate-pulse" />
            ))}
            <div className="h-12 rounded-xl bg-gold/20 animate-pulse" />
          </div>
        }>
          <SignUpForm />
        </Suspense>
      </div>
    </div>
  );
}
