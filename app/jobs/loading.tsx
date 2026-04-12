export default function JobsLoading() {
  return (
    <div className="pt-16 min-h-screen animate-pulse">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex gap-8 flex-col lg:flex-row">
          {/* Sidebar skeleton */}
          <div className="lg:w-56 shrink-0 space-y-4">
            <div className="h-5 w-24 bg-bg-secondary rounded" />
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 bg-bg-secondary rounded-lg" />
              ))}
            </div>
            <div className="h-5 w-24 bg-bg-secondary rounded mt-4" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 bg-bg-secondary rounded-lg" />
              ))}
            </div>
          </div>

          {/* Main */}
          <div className="flex-1 space-y-3">
            <div className="flex gap-3 mb-4">
              <div className="flex-1 h-10 bg-bg-secondary rounded-lg" />
              <div className="h-10 w-28 bg-bg-secondary rounded-lg" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-bg-secondary p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-bg-elevated shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-2/3 bg-bg-elevated rounded" />
                    <div className="h-3 w-1/3 bg-bg-elevated rounded" />
                    <div className="flex gap-2 mt-3">
                      <div className="h-5 w-16 bg-bg-elevated rounded-full" />
                      <div className="h-5 w-20 bg-bg-elevated rounded-full" />
                    </div>
                  </div>
                  <div className="h-8 w-20 bg-bg-elevated rounded-lg shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
