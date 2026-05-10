export default function TiereLoading() {
  return (
    <div className="pt-16 min-h-screen animate-pulse">
      <div className="h-48 bg-bg-secondary" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-3 mb-6">
          <div className="flex-1 h-10 bg-bg-secondary rounded-lg" />
          <div className="h-10 w-28 bg-bg-secondary rounded-lg" />
        </div>
        <div className="flex gap-2 mb-6 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-24 bg-bg-secondary rounded-full shrink-0" />
          ))}
        </div>
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
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
