"use client";

import { useUser } from "@clerk/nextjs";
import { Heart } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { photoHref } from "@/lib/photo-link";
import { optimisticPhotoLikeCount } from "@/lib/photo-like-state";

type LikeEvent = { imageUrl: string; profileId: string; liked: boolean; count: number };
const EVENT_NAME = "cinegenius:photo-like";

function publishLike(event: LikeEvent) {
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: event }));
  try {
    const channel = new BroadcastChannel("cinegenius-photo-likes");
    channel.postMessage(event);
    channel.close();
  } catch { /* BroadcastChannel is unavailable in some private browser modes. */ }
}

export default function PhotoLikeButton({
  profileId,
  imageUrl,
  initialCount = 0,
  initialLiked = false,
  disabled = false,
  resumeLike = false,
  className = "",
}: {
  profileId: string;
  imageUrl: string;
  initialCount?: number;
  initialLiked?: boolean;
  disabled?: boolean;
  resumeLike?: boolean;
  className?: string;
}) {
  const { isLoaded, isSignedIn, user } = useUser();
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const actionHandled = useRef(false);
  const isOwner = user?.id === profileId;

  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<LikeEvent>).detail;
      if (detail?.imageUrl !== imageUrl || detail.profileId !== profileId) return;
      setLiked(detail.liked);
      setCount(detail.count);
    };
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("cinegenius-photo-likes");
    const receiveChannel = (event: MessageEvent<LikeEvent>) => {
      if (event.data?.imageUrl !== imageUrl || event.data.profileId !== profileId) return;
      setLiked(event.data.liked);
      setCount(event.data.count);
    };
    window.addEventListener(EVENT_NAME, receive);
    channel?.addEventListener("message", receiveChannel);
    return () => {
      window.removeEventListener(EVENT_NAME, receive);
      channel?.removeEventListener("message", receiveChannel);
      channel?.close();
    };
  }, [imageUrl, profileId]);

  const saveLikeState = useCallback(async (nextLiked: boolean) => {
    if (!isLoaded || saving || disabled || isOwner || !isSignedIn) return;
    const previousCount = count;
    const previousLiked = liked;
    setSaving(true);
    setError("");
    setLiked(nextLiked);
      setCount(optimisticPhotoLikeCount(count, liked, nextLiked));
    try {
      const response = await fetch("/api/profile-image-likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, image_url: imageUrl, liked: nextLiked }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Dein Like konnte nicht gespeichert werden.");
      setLiked(data.liked);
      const finalCount = Number.isInteger(data.count) ? data.count : optimisticPhotoLikeCount(count, previousLiked, data.liked);
      setCount(finalCount);
      publishLike({ profileId, imageUrl, liked: data.liked, count: finalCount });
    } catch (cause) {
      setLiked(previousLiked);
      setCount(previousCount);
      setError(cause instanceof Error ? cause.message : "Dein Like konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }, [count, disabled, imageUrl, isLoaded, isOwner, isSignedIn, liked, profileId, saving]);

  useEffect(() => {
    if (!resumeLike || !isLoaded || !isSignedIn || actionHandled.current) return;
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.get("action") !== "like") return;
    actionHandled.current = true;
    currentUrl.searchParams.delete("action");
    window.history.replaceState(null, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    void saveLikeState(true);
  }, [isLoaded, isSignedIn, resumeLike, saveLikeState]);

  function toggleLike() {
    if (!isLoaded || saving || disabled || isOwner) return;
    if (!isSignedIn) {
      const intended = photoHref(profileId, imageUrl, "like");
      window.location.assign(`/sign-in?redirect_url=${encodeURIComponent(intended)}`);
      return;
    }
    void saveLikeState(!liked);
  }

  return (
    <span className={`inline-flex flex-col items-center ${className}`}>
      <button
        type="button"
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); void toggleLike(); }}
        disabled={!isLoaded || saving || disabled || isOwner}
        aria-label={liked ? `Like entfernen, ${count} Likes` : `Foto liken, ${count} Likes`}
        aria-pressed={liked}
        title={isOwner ? "Eigene Fotos kannst du nicht liken" : undefined}
        className={`flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-white/20 bg-black/70 px-2.5 text-white shadow-md backdrop-blur transition-colors hover:border-red-300 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-70 ${liked ? "text-red-400" : ""}`}
      >
        <Heart size={18} className={liked ? "fill-current text-red-400" : ""} />
        {count > 0 && <span className="text-xs font-semibold">{count}</span>}
      </button>
      {error && <span role="alert" className="absolute mt-12 max-w-48 rounded bg-black/90 px-2 py-1 text-[11px] text-red-200">{error}</span>}
    </span>
  );
}
