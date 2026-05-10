export default function ProjectsLoading() {
  return (
    <div className="pt-16 min-h-screen animate-pulse">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="h-8 w-40 bg-bg-secondary rounded mb-2" />
        <div className="h-4 w-64 bg-bg-secondary rounded mb-8" />
        <div className="flex gap-2 mb-8 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-9 w-28 bg-bg-secondary rounded-full shrink-0" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
              <div className="h-48 bg-bg-elevated" />
              <div className="p-5 space-y-2.5">
                <div className="h-5 w-3/4 bg-bg-elevated rounded" />
                <div className="h-3 w-1/2 bg-bg-elevated rounded" />
                <div className="flex gap-2 mt-3">
                  <div className="h-5 w-16 bg-bg-elevated rounded-full" />
                  <div className="h-5 w-14 bg-bg-elevated rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
