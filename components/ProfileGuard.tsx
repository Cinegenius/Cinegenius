"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Film } from "lucide-react";

/**
 * Wraps pages that require a completed profile.
 * - Not logged in → /sign-in
 * - Logged in but no profile → /profile-setup
 * - Profile exists → renders children
 */
export default function ProfileGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      const redirect = window.location.pathname + window.location.search;
      router.replace(`/sign-in?redirect=${encodeURIComponent(redirect)}`);
      return;
    }

    fetch("/api/profile")
      .then((r) => {
        if (!r.ok) throw new Error("profile check failed");
        return r.json();
      })
      .then(({ exists }) => {
        if (!exists) {
          const redirect = window.location.pathname + window.location.search;
          router.replace(`/profile-setup?redirect=${encodeURIComponent(redirect)}`);
        } else {
          setReady(true);
        }
      })
      .catch(() => {
        // on error, redirect to setup — fail closed rather than letting unauthenticated state through
        const redirect = window.location.pathname + window.location.search;
        router.replace(`/profile-setup?redirect=${encodeURIComponent(redirect)}`);
      });
  }, [isLoaded, user, router]);

  if (!isLoaded || !ready) {
    return (
      <div className="pt-16 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-gold/10 border border-gold/20 rounded-full flex items-center justify-center animate-pulse">
            <Film size={20} className="text-gold" />
          </div>
          <p className="text-text-muted text-sm">Einen Moment...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
