export default function Loading() {
  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-pulse">
        {/* Page header skeleton */}
        <div className="h-8 w-48 bg-bg-secondary rounded-lg mb-2" />
        <div className="h-4 w-72 bg-bg-secondary rounded mb-10" />

        {/* Grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
              <div className="h-48 bg-bg-elevated" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-3/4 bg-bg-elevated rounded" />
                <div className="h-3 w-1/2 bg-bg-elevated rounded" />
                <div className="h-3 w-2/3 bg-bg-elevated rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
