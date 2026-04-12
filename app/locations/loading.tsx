export default function LocationsLoading() {
  return (
    <div className="pt-16 min-h-screen animate-pulse">
      {/* Filter bar */}
      <div className="sticky top-16 z-30 border-b border-border bg-bg-primary/80 backdrop-blur-nav px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="flex-1 h-9 bg-bg-secondary rounded-lg" />
          <div className="h-9 w-24 bg-bg-secondary rounded-lg" />
          <div className="h-9 w-9 bg-bg-secondary rounded-lg" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Category pills */}
        <div className="flex gap-2 mb-6 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-8 w-24 bg-bg-secondary rounded-full shrink-0" />
          ))}
        </div>

        {/* Results count */}
        <div className="h-4 w-32 bg-bg-secondary rounded mb-5" />

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
              <div className="h-52 bg-bg-elevated" />
              <div className="p-4 space-y-2.5">
                <div className="h-4 w-3/4 bg-bg-elevated rounded" />
                <div className="h-3 w-1/2 bg-bg-elevated rounded" />
                <div className="flex gap-2 mt-3">
                  <div className="h-5 w-16 bg-bg-elevated rounded-full" />
                  <div className="h-5 w-20 bg-bg-elevated rounded-full" />
                </div>
                <div className="flex justify-between pt-2 border-t border-border">
                  <div className="h-4 w-20 bg-bg-elevated rounded" />
                  <div className="h-4 w-16 bg-bg-elevated rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
