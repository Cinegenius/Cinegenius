export function SkeletonBox({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded bg-bg-elevated relative overflow-hidden ${className}`}
      style={style}
    >
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
          backgroundSize: "1000px 100%",
          animation: "shimmer 1.8s infinite",
        }}
      />
    </div>
  );
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  const widths = ["100%", "85%", "70%", "90%", "60%"];
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox
          key={i}
          className="h-4"
          style={{ width: widths[i % widths.length] }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
      <SkeletonBox className="w-full aspect-video" />
      <div className="p-4 space-y-3">
        <SkeletonBox className="h-5 w-3/4" />
        <SkeletonBox className="h-4 w-1/2" />
        <div className="flex gap-2 pt-1">
          <SkeletonBox className="h-6 w-16 rounded-full" />
          <SkeletonBox className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex justify-between pt-2 border-t border-border">
          <SkeletonBox className="h-4 w-16" />
          <SkeletonBox className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
