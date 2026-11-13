import type { ComponentProps } from "react";
import DirectoryPage from "@/components/DirectoryPage";

/** Keep the directory image and compact layout visible while results load. */
export default function DirectoryLoading({ area }: Pick<ComponentProps<typeof DirectoryPage>, "area">) {
  return <DirectoryPage area={area}>
    <div className="site-container pt-24 pb-8 motion-safe:animate-pulse" aria-hidden="true">
      <div className="mb-3 h-8 w-3/4 max-w-lg rounded bg-bg-secondary" />
      <div className="mb-10 h-4 w-2/3 max-w-md rounded bg-bg-secondary" />
      <div className="mobile-browse-controls__inner">
        <div className="h-12 rounded-xl bg-bg-elevated" />
        <div className="mobile-browse-controls__row">
          <div className="h-12 w-24 shrink-0 rounded-xl bg-bg-elevated" />
          <div className="h-12 min-w-0 flex-1 rounded-xl bg-bg-elevated" />
        </div>
        <div className="mobile-browse-summary py-3"><div className="h-4 w-28 rounded bg-bg-secondary" /></div>
      </div>
      <div className="grid grid-cols-1 gap-5 py-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="browse-card space-y-4 p-5">
          <div className="h-12 w-12 rounded-xl bg-bg-elevated" />
          <div className="h-4 w-3/4 rounded bg-bg-elevated" />
          <div className="h-3 w-1/2 rounded bg-bg-elevated" />
        </div>)}
      </div>
    </div>
  </DirectoryPage>;
}
