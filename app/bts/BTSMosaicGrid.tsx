"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import PhotoLikeButton from "@/components/PhotoLikeButton";
import { markPhotoNavigation, photoHref } from "@/lib/photo-link";

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
  const { user } = useUser();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 auto-rows-[200px]">
      {items.map((item, i) => {
        const tall = i % 7 === 0;
        const key = `${item.profileId}:${item.imageUrl}`;
        const count = initialLikes[key] ?? 0;
        const liked = initialMyLikes.includes(key);
        const isOwn = user?.id === item.profileId;

        return (
          <div
            key={`${item.profileId}-${i}`}
            className={`group relative rounded-xl overflow-hidden bg-bg-elevated border border-border ${tall ? "row-span-2" : ""}`}
          >
            {/* Image opens a permalink for this exact photo. */}
            <Link href={photoHref(item.profileId, item.imageUrl)} onClick={markPhotoNavigation} className="absolute inset-0 z-0">
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

              </div>
            </div>
            <PhotoLikeButton profileId={item.profileId} imageUrl={item.imageUrl} initialCount={count} initialLiked={liked} disabled={isOwn} className="absolute right-2 top-2 z-20" />
          </div>
        );
      })}
    </div>
  );
}
