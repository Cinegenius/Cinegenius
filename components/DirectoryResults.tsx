import { ContentTranslationNotice } from "@/components/ContentTranslation";
import type { ReactNode } from "react";
import type { DirectoryView } from "./DirectoryViewControls";

/** One responsive result layout; the map mounts only when explicitly selected. */
export default function DirectoryResults({ view, map, children }: {
  view: DirectoryView;
  map: ReactNode;
  children: ReactNode;
}) {
  return <div className="directory-results" data-view={view}>
    {view === "map" && <div className="directory-results-map">{map}</div>}
    <div className="directory-results-content"><ContentTranslationNotice />{children}</div>
  </div>;
}
