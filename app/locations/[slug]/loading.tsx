export default function LocationDetailLoading() {
  return (
    <div className="pt-16 min-h-screen animate-pulse">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="h-4 w-36 bg-bg-secondary rounded mb-4" />
      </div>

      {/* Image gallery skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="grid grid-cols-4 gap-2 rounded-xl overflow-hidden h-80 sm:h-[420px]">
          <div className="col-span-2 bg-bg-secondary" />
          <div className="bg-bg-secondary" />
          <div className="bg-bg-secondary" />
          <div className="bg-bg-secondary" />
          <div className="bg-bg-secondary" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex gap-10 flex-col lg:flex-row">
          {/* Left */}
          <div className="flex-1 space-y-6">
            <div className="space-y-2">
              <div className="h-8 w-2/3 bg-bg-secondary rounded" />
              <div className="h-4 w-1/3 bg-bg-secondary rounded" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-bg-secondary rounded-xl" />
              ))}
            </div>
            <div className="space-y-2">
              <div className="h-5 w-48 bg-bg-secondary rounded" />
              <div className="h-4 bg-bg-secondary rounded" />
              <div className="h-4 w-5/6 bg-bg-secondary rounded" />
              <div className="h-4 w-4/6 bg-bg-secondary rounded" />
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:w-[360px] shrink-0">
            <div className="h-96 bg-bg-secondary rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
