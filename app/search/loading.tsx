export default function SearchLoading() {
  return (
    <div className="pt-16 min-h-screen animate-pulse">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="h-12 bg-bg-secondary rounded-xl mb-6" />
        <div className="flex gap-2 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 w-20 bg-bg-secondary rounded-full shrink-0" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-bg-secondary p-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-bg-elevated shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 bg-bg-elevated rounded" />
                  <div className="h-3 w-1/3 bg-bg-elevated rounded" />
                  <div className="flex gap-2">
                    <div className="h-5 w-16 bg-bg-elevated rounded-full" />
                    <div className="h-5 w-20 bg-bg-elevated rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
