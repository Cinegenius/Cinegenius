"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin, Heart } from "lucide-react";
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
  initialLikes,
  initialMyLikes,
}: {
  items: BTSGridItem[];
  initialLikes: Record<string, number>;
  initialMyLikes: string[];
}) {
  const { isSignedIn, user } = useUser();
  const [likes, setLikes] = useState(initialLikes);
  const [myLikedSet, setMyLikedSet] = useState(() => new Set(initialMyLikes));

  const toggleLike = async (item: BTSGridItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn || item.profileId === user?.id) return;

    const url = item.imageUrl;
    const wasLiked = myLikedSet.has(url);
    setMyLikedSet(prev => { const next = new Set(prev); wasLiked ? next.delete(url) : next.add(url); return next; });
    setLikes(prev => ({ ...prev, [url]: Math.max(0, (prev[url] ?? 0) + (wasLiked ? -1 : 1)) }));
    try {
      await fetch("/api/profile-image-likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: item.profileId, image_url: url }),
      });
    } catch {
      setMyLikedSet(prev => { const next = new Set(prev); wasLiked ? next.add(url) : next.delete(url); return next; });
      setLikes(prev => ({ ...prev, [url]: Math.max(0, (prev[url] ?? 0) + (wasLiked ? 1 : -1)) }));
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 auto-rows-[200px]">
      {items.map((item, i) => {
        const tall = i % 7 === 0;
        const count = likes[item.imageUrl] ?? 0;
        const liked = myLikedSet.has(item.imageUrl);
        const isOwn = user?.id === item.profileId;
        const canLike = isSignedIn && !isOwn;

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

            {/* Bottom strip: author + heart */}
            <div className="absolute bottom-0 left-0 right-0 z-20 px-2.5 pb-1.5 pt-5">
              <div className="flex items-end justify-between gap-2">
                {/* Author info */}
                <div className="pointer-events-none min-w-0">
                  {item.caption && (
                    <p className="text-white/70 text-[9px] line-clamp-1">{item.caption}</p>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-white font-semibold text-[11px] truncate">{item.authorName}</p>
                    {item.authorCity && (
                      <p className="text-white/50 text-[9px] flex items-center gap-0.5">
                        <MapPin size={7} />{item.authorCity}
                      </p>
                    )}
                  </div>
                </div>

                {/* Heart button */}
                <button
                  type="button"
                  onClick={(e) => void toggleLike(item, e)}
                  disabled={!canLike}
                  className={`flex items-center gap-1 shrink-0 transition-transform active:scale-125 ${canLike ? "cursor-pointer" : "cursor-default"} ${liked ? "text-red-400" : "text-white/60 hover:text-red-400"}`}
                >
                  <Heart size={13} className={liked ? "fill-current" : ""} />
                  {count > 0 && <span className="text-[10px] font-semibold">{count}</span>}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
