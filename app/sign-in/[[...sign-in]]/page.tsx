import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

function SignInSkeleton() {
  return (
    <div className="w-full max-w-md animate-pulse">
      <div className="bg-[#1A1A1A] rounded-2xl p-8 space-y-4 border border-white/5">
        <div className="h-10 bg-white/5 rounded-xl" />
        <div className="h-10 bg-white/5 rounded-xl" />
        <div className="h-10 bg-gold/20 rounded-xl" />
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="pt-16 min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">Willkommen zurück</p>
          <h1 className="font-display text-3xl font-bold text-text-primary">Anmelden</h1>
        </div>
        <Suspense fallback={<SignInSkeleton />}>
          <SignIn
            forceRedirectUrl="/dashboard"
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
        </Suspense>
      </div>
    </div>
  );
}
