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
      router.replace("/sign-in");
      return;
    }

    fetch("/api/profile")
      .then((r) => r.json())
      .then(({ exists }) => {
        if (!exists) {
          router.replace("/profile-setup");
        } else {
          setReady(true);
        }
      })
      .catch(() => {
        // on error, let through (don't block the user)
        setReady(true);
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
