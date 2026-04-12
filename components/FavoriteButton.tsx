"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

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

export default function FavoriteButton({
  listingId, listingType, listingTitle, listingCity, listingPrice, listingImage,
  className = "", size = "md",
}: Props) {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch(`/api/favorites?id=${listingId}`)
      .then((r) => r.json())
      .then(({ isFavorited }) => setFavorited(!!isFavorited))
      .catch(() => {});
  }, [listingId, isLoaded, isSignedIn]);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoaded) return;
    if (!isSignedIn) { router.push("/sign-in"); return; }
    if (loading) return;
    setLoading(true);
    const optimistic = !favorited;
    setFavorited(optimistic);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          listing_type: listingType,
          listing_title: listingTitle,
          listing_city: listingCity,
          listing_price: listingPrice,
          listing_image: listingImage,
        }),
      });
      const { isFavorited } = await res.json();
      setFavorited(!!isFavorited);
    } catch {
      setFavorited(!optimistic); // revert on error
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === "sm" ? 14 : 17;
  const btnSize = size === "sm"
    ? "w-7 h-7"
    : "w-9 h-9";

  return (
    <button
      onClick={toggle}
      aria-label={favorited ? "Aus Merkliste entfernen" : "Zur Merkliste hinzufügen"}
      title={favorited ? "Aus Merkliste entfernen" : "Speichern"}
      className={`${btnSize} flex items-center justify-center rounded-full border transition-all ${
        favorited
          ? "bg-crimson/10 border-crimson/40 text-crimson-light hover:bg-crimson/20"
          : "bg-bg-primary/70 border-border text-text-muted hover:border-crimson/40 hover:text-crimson-light"
      } backdrop-blur-sm ${loading ? "opacity-60 cursor-not-allowed" : ""} ${className}`}
    >
      <Heart
        size={iconSize}
        className={`transition-all ${favorited ? "fill-current" : ""} ${loading ? "animate-pulse" : ""}`}
      />
    </button>
  );
}
