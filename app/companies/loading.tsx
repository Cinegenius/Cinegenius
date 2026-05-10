export default function CompaniesLoading() {
  return (
    <div className="pt-16 min-h-screen animate-pulse">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="h-8 w-48 bg-bg-secondary rounded mb-2" />
        <div className="h-4 w-72 bg-bg-secondary rounded mb-8" />
        <div className="flex gap-3 mb-8">
          <div className="flex-1 h-10 bg-bg-secondary rounded-lg" />
          <div className="h-10 w-32 bg-bg-secondary rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
              <div className="h-36 bg-bg-elevated" />
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-bg-elevated shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-bg-elevated rounded" />
                    <div className="h-3 w-1/2 bg-bg-elevated rounded" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-5 w-16 bg-bg-elevated rounded-full" />
                  <div className="h-5 w-20 bg-bg-elevated rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
