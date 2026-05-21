"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";

export interface BTSGridItem {
  imageUrl: string;
  caption?: string;
  authorName: string;
  authorCity?: string;
  profileId: string;
  profileSlug: string;
}

export default function BTSMosaicGrid({
  items,
  initialRatings,
  initialMyRatings,
}: {
  items: BTSGridItem[];
  initialRatings: Record<string, { avg: number; count: number }>;
  initialMyRatings: Record<string, number>;
}) {
  const { isSignedIn, user } = useUser();
  const [ratings, setRatings] = useState(initialRatings);
  const [myRatings, setMyRatings] = useState(initialMyRatings);
  const [hoverRating, setHoverRating] = useState<{ url: string; star: number } | null>(null);

  const rate = async (item: BTSGridItem, star: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn || item.profileId === user?.id) return;

    const url = item.imageUrl;
    const prev = myRatings[url];
    setMyRatings((m) => ({ ...m, [url]: star }));
    setRatings((r) => {
      const cur = r[url] ?? { avg: 0, count: 0 };
      const newCount = prev ? cur.count : cur.count + 1;
      const newSum = prev ? cur.avg * cur.count - prev + star : cur.avg * cur.count + star;
      return { ...r, [url]: { avg: Math.round((newSum / newCount) * 10) / 10, count: newCount } };
    });
    try {
      await fetch("/api/profile-image-likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: item.profileId, image_url: url, rating: star }),
      });
    } catch {
      setMyRatings((m) => {
        const n = { ...m };
        if (prev) n[url] = prev;
        else delete n[url];
        return n;
      });
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 auto-rows-[200px]">
      {items.map((item, i) => {
        const tall = i % 7 === 0;
        const ratingData = ratings[item.imageUrl];
        const myR = myRatings[item.imageUrl] ?? 0;
        const hovering = hoverRating?.url === item.imageUrl;
        const displayStars = hovering ? hoverRating!.star : myR;
        const isOwn = user?.id === item.profileId;
        const canRate = isSignedIn && !isOwn;

        return (
          <div
            key={`${item.profileId}-${i}`}
            className={`group relative rounded-xl overflow-hidden bg-bg-elevated border border-border ${tall ? "row-span-2" : ""}`}
          >
            {/* Image — clicking navigates to profile */}
            <Link href={`/profile/${item.profileSlug}`} className="absolute inset-0 z-0">
              <Image
                src={item.imageUrl}
                alt={item.authorName}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,25vw"
              />
            </Link>

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent pointer-events-none z-10" />

            {/* Bottom strip: author + rating */}
            <div className="absolute bottom-0 left-0 right-0 z-20 px-2.5 pb-1.5 pt-5">
              {/* Author info — pointer-events-none so clicks go through to Link */}
              <div className="pointer-events-none mb-1">
                {item.caption && (
                  <p className="text-white/70 text-[9px] line-clamp-1">{item.caption}</p>
                )}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-white font-semibold text-[11px]">{item.authorName}</p>
                  {item.authorCity && (
                    <p className="text-white/50 text-[9px] flex items-center gap-0.5">
                      <MapPin size={7} />{item.authorCity}
                    </p>
                  )}
                </div>
              </div>

              {/* Rating row */}
              <div
                className="flex items-center justify-between gap-1"
                onMouseLeave={() => setHoverRating(null)}
              >
                {/* Left: aggregate score */}
                <div className="flex items-center gap-1 pointer-events-none">
                  {ratingData && ratingData.count > 0 ? (
                    <>
                      <span className="text-gold text-[10px] font-bold leading-none">{ratingData.avg.toFixed(1)}</span>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <span key={s} className={`text-[10px] leading-none ${s <= Math.round(ratingData.avg) ? "text-gold" : "text-white/25"}`}>★</span>
                        ))}
                      </div>
                      <span className="text-[9px] text-white/50">({ratingData.count})</span>
                    </>
                  ) : (
                    <span className="text-[9px] text-white/40">Bewerten ↓</span>
                  )}
                </div>

                {/* Right: interactive stars */}
                {canRate && (
                  <div className="flex" onClick={(e) => e.stopPropagation()}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating({ url: item.imageUrl, star })}
                        onClick={(e) => rate(item, star, e)}
                        className="w-6 h-6 flex items-center justify-center text-sm leading-none transition-transform active:scale-125 hover:scale-110 cursor-pointer touch-manipulation"
                        title={`${star} Stern${star > 1 ? "e" : ""}`}
                        style={{
                          color: star <= displayStars
                            ? "#d4af37"
                            : hovering
                              ? "rgba(212,175,55,0.3)"
                              : "rgba(255,255,255,0.25)",
                        }}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
