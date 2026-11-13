export default function ProjectsLoading() {
  return <div className="min-h-screen pt-20 mobile-bottom-nav-clear" aria-hidden="true"><div className="site-container animate-pulse py-10">
    <div className="mb-3 h-8 w-3/4 max-w-lg rounded bg-bg-secondary" /><div className="mb-8 h-4 w-2/3 rounded bg-bg-secondary" />
    <div className="mb-6 h-28 rounded-2xl bg-bg-secondary" />
    <div className="browse-card divide-y divide-border">{Array.from({ length: 9 }, (_, index) => <div key={index} className="flex items-center gap-5 px-4 py-4 lg:px-5"><div className="hidden h-3 w-16 shrink-0 rounded bg-bg-elevated lg:block" /><div className="h-9 w-10 shrink-0 rounded bg-bg-elevated" /><div className="flex-1 space-y-3"><div className="h-4 w-3/4 max-w-xs rounded bg-bg-elevated" /><div className="h-3 w-1/2 max-w-40 rounded bg-bg-elevated" /></div><div className="hidden h-3 w-32 rounded bg-bg-elevated lg:block" /></div>)}</div>
  </div></div>;
}
