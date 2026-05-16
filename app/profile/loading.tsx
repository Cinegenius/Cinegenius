export default function ProfileLoading() {
  return (
    <div className="pt-16 min-h-screen bg-bg-primary">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Back link */}
        <div className="h-4 w-40 rounded bg-bg-elevated animate-pulse" />

        {/* Heading */}
        <div className="h-8 w-56 rounded bg-bg-elevated animate-pulse" />
        <div className="h-4 w-72 rounded bg-bg-elevated animate-pulse" />

        {/* Tab bar */}
        <div className="flex gap-2 pt-2">
          {[80, 72, 72, 72].map((w, i) => (
            <div key={i} style={{ width: w }} className="h-9 rounded-full bg-bg-elevated animate-pulse" />
          ))}
        </div>

        {/* Form skeleton */}
        <div className="space-y-4 pt-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-bg-elevated animate-pulse" />
          ))}
          <div className="h-28 rounded-xl bg-bg-elevated animate-pulse" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-bg-elevated animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
