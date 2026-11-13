import type { CSSProperties, ReactNode } from "react";
import { PageBackdrop } from "@/components/PageHeader";
import AiDisclosureBadge from "@/components/AiDisclosureBadge";

const positions = {
  crew: "0% 42%",
  marketplace: "20% 42%",
  news: "40% 42%",
  locations: "60% 42%",
  companies: "80% 42%",
  projects: "100% 42%",
} as const;

/** One shared image and darkness, with a stable crop for each public directory. */
export default function DirectoryPage({ area, children }: { area: keyof typeof positions; children: ReactNode }) {
  const position = positions[area];
  return <div className="directory-page relative isolate min-h-screen" style={{ "--directory-image-position": position } as CSSProperties}>
    <PageBackdrop optimizeImage image="/hero-bg-v2.jpg" imagePosition={position} imageOpacity={100} overlayClassName="absolute inset-0 bg-bg-primary/72" className="directory-page-backdrop fixed inset-0 z-[-1]" />
    {children}
    <div className="site-container mobile-bottom-nav-clear flex justify-end">
      <AiDisclosureBadge source="/hero-bg-v2.jpg" subtle className="min-h-11" />
    </div>
  </div>;
}
