export default function ProjectsLoading() {
  return <div className="min-h-screen pt-20 mobile-bottom-nav-clear" aria-hidden="true"><div className="site-container animate-pulse py-10">
    <div className="mb-3 h-8 w-3/4 max-w-lg rounded bg-bg-secondary" /><div className="mb-8 h-4 w-2/3 rounded bg-bg-secondary" />
    <div className="mb-6 h-28 rounded-2xl bg-bg-secondary" />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 9 }, (_, index) => <div key={index} className="browse-card flex gap-4 p-4"><div className="h-[76px] w-14 shrink-0 rounded-lg bg-bg-elevated" /><div className="flex-1 space-y-3"><div className="h-5 w-3/4 rounded bg-bg-elevated" /><div className="h-3 w-1/2 rounded bg-bg-elevated" /><div className="h-3 w-2/3 rounded bg-bg-elevated" /></div></div>)}</div>
  </div></div>;
}
