"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Heart, AlertCircle } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface Props {
  listingId: string;
  listingType: string;
  listingTitle?: string;
  listingCity?: string;
  listingPrice?: number;
  listingImage?: string | null;
  className?: string;
  size?: "sm" | "md";
}

export default function FavoriteButton({ listingId, listingType, className = "", size = "md" }: Props) {
  const ui = useTranslations();
  const { isSignedIn, isLoaded, userId, sessionId } = useAuth();
  const router = useRouter();
  const scope = JSON.stringify([userId, sessionId, listingId]);
  const currentScope = useRef(scope), generation = useRef(0), operations = useRef(new Set<string>());
  const [snapshot, setSnapshot] = useState({ scope: "", value: false });
  const [pending, setPending] = useState("");
  const [failedScope, setFailedScope] = useState("");
  const favorited = snapshot.scope === scope && snapshot.value;
  const loading = pending === scope;
  const failed = failedScope === scope;
  useLayoutEffect(() => {
    currentScope.current = scope;
    return () => { currentScope.current = ""; generation.current += 1; };
  }, [scope]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    const controller = new AbortController(), version = ++generation.current;
    const current = () => !controller.signal.aborted && currentScope.current === scope && generation.current === version;
    void fetch(`/api/favorites?${new URLSearchParams({ id: listingId })}`, { cache: "no-store", headers: { "X-Favorites-Account": userId }, signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!current()) return;
        if (!response.ok || typeof data.isFavorited !== "boolean") throw new Error();
        setSnapshot({ scope, value: data.isFavorited }); setFailedScope("");
      }).catch(() => { if (current()) setFailedScope(scope); });
    return () => controller.abort();
  }, [listingId, isLoaded, isSignedIn, userId, scope]);

  async function toggle(event: React.MouseEvent) {
    event.preventDefault(); event.stopPropagation();
    if (!isLoaded) return;
    if (!isSignedIn || !userId) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (operations.current.has(scope)) return;
    operations.current.add(scope); setPending(scope);
    // A pre-click GET must not overwrite the authoritative mutation response.
    generation.current += 1;
    const previous = favorited;
    setSnapshot({ scope, value: !previous }); setFailedScope("");
    try {
      const response = await fetch("/api/favorites", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", "X-Favorites-Account": userId }, signal: AbortSignal.timeout(20_000), body: JSON.stringify({ listing_id: listingId, listing_type: listingType, action: previous ? "remove" : "add" }) });
      const data = await response.json();
      if (currentScope.current !== scope) return;
      if (!response.ok || typeof data.isFavorited !== "boolean") throw new Error();
      setSnapshot({ scope, value: data.isFavorited });
    } catch {
      if (currentScope.current === scope) { setSnapshot({ scope, value: previous }); setFailedScope(scope); }
    } finally {
      operations.current.delete(scope);
      if (currentScope.current === scope) setPending("");
    }
  }
  const action = ui(favorited ? "Ui.text_53968e5832d074" : "Ui.text_9203de1d551aa8");
  return <button type="button" onClick={event => void toggle(event)} disabled={loading || !isLoaded}
    aria-label={failed ? `${ui("System.requestFailed")} ${action}` : action}
    aria-pressed={snapshot.scope === scope ? favorited : undefined} title={failed ? ui("System.requestFailed") : action}
    className={`flex min-h-11 min-w-11 items-center justify-center rounded-full border transition-all ${favorited ? "border-crimson/40 bg-crimson/10 text-crimson-light hover:bg-crimson/20" : "border-border bg-bg-primary/70 text-text-muted hover:border-crimson/40 hover:text-crimson-light"} backdrop-blur-sm ${loading ? "cursor-not-allowed opacity-60" : ""} ${className}`}>
    {failed ? <AlertCircle size={size === "sm" ? 16 : 19} aria-hidden="true" /> : <Heart size={size === "sm" ? 14 : 17} aria-hidden="true" className={`${favorited ? "fill-current" : ""} ${loading ? "animate-pulse" : ""}`} />}
  </button>;
}
