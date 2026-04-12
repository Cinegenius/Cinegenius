export default function CreatorsLoading() {
  return (
    <div className="pt-16 min-h-screen animate-pulse">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="h-10 w-64 bg-bg-secondary rounded mb-2" />
        <div className="h-4 w-80 bg-bg-secondary rounded mb-8" />

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-9 w-24 bg-bg-secondary rounded-full" />
          ))}
        </div>

        {/* Search + filters */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 h-10 bg-bg-secondary rounded-lg" />
          <div className="h-10 w-24 bg-bg-secondary rounded-lg" />
          <div className="h-10 w-28 bg-bg-secondary rounded-lg" />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-bg-secondary p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-bg-elevated shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-bg-elevated rounded" />
                  <div className="h-3 w-1/2 bg-bg-elevated rounded" />
                  <div className="h-3 w-2/3 bg-bg-elevated rounded" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-16 bg-bg-elevated rounded-full" />
                <div className="h-6 w-20 bg-bg-elevated rounded-full" />
                <div className="h-6 w-14 bg-bg-elevated rounded-full" />
              </div>
              <div className="mt-4 pt-4 border-t border-border flex justify-between">
                <div className="h-4 w-20 bg-bg-elevated rounded" />
                <div className="h-8 w-24 bg-bg-elevated rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
