"use client";

import Link from "next/link";

type Props = {
  images: { src: string; alt: string; href?: string; onClick?: () => void }[];
  aspectRatio?: "poster" | "square" | "wide";
  height?: number;
  speed?: "slow" | "normal" | "fast";
  /** Override the total animation duration in seconds (ignores speed) */
  durationOverride?: number;
  overlay?: boolean;
  direction?: "left" | "right";
  /** Unique key used for CSS keyframe names — prevents strips from sharing animations */
  stripId?: string;
  /** Shift start position 0–1 (0.5 = half cycle offset) */
  startOffset?: number;
};

const aspectMap = {
  poster: "aspect-[2/3]",
  square: "aspect-square",
  wide:   "aspect-[4/3]",
};

const secondsPerItem = {
  slow:   2.5,
  normal: 1.5,
  fast:   0.7,
};

export default function ImageStrip({
  images,
  aspectRatio = "poster",
  height = 180,
  speed = "normal",
  durationOverride,
  overlay = true,
  direction = "left",
  stripId = "a",
  startOffset = 0,
}: Props) {
  if (!images.length) return null;

  const itemsPerHalf = Math.max(32, images.length * 4);
  const durationSec = durationOverride ?? Math.round(secondsPerItem[speed] * itemsPerHalf);
  const delaySec = -(startOffset * durationSec);

  // Shift array so strip visually starts mid-sequence
  const shift = Math.round(startOffset * images.length);
  const doubled = Array.from(
    { length: itemsPerHalf * 2 },
    (_, i) => images[(i + shift) % images.length]
  );

  const animName = direction === "right" ? `mq-r-${stripId}` : `mq-${stripId}`;

  return (
    <div className="relative overflow-hidden bg-black" style={{ height, display: "block", fontSize: 0 }}>
      {overlay && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-black to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-black to-transparent pointer-events-none" />
        </>
      )}

      <div
        className="flex h-full"
        style={{
          width: "max-content",
          animation: `${animName} ${durationSec}s linear ${delaySec}s infinite`,
          willChange: "transform",
        }}
      >
        {doubled.map((img, i) => {
          const inner = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.src}
                alt={img.alt}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              {img.href && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-end p-2">
                  <span className="text-white text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300 leading-tight line-clamp-2 drop-shadow">
                    {img.alt}
                  </span>
                </div>
              )}
            </>
          );

          return img.href ? (
            <Link key={i} href={img.href}
              className={`group relative ${aspectMap[aspectRatio]} h-full shrink-0 overflow-hidden rounded-sm`}
              style={{ height: "100%", marginRight: 8 }}>
              {inner}
            </Link>
          ) : img.onClick ? (
            <button key={i} type="button" onClick={img.onClick}
              className={`group relative ${aspectMap[aspectRatio]} h-full shrink-0 overflow-hidden rounded-sm cursor-pointer`}
              style={{ height: "100%", marginRight: 8 }}>
              {inner}
            </button>
          ) : (
            <div key={i}
              className={`${aspectMap[aspectRatio]} h-full shrink-0 overflow-hidden rounded-sm`}
              style={{ height: "100%", marginRight: 8 }}>
              {inner}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes mq-${stripId} {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes mq-r-${stripId} {
          0%   { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
