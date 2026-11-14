"use client";

import { useLocale } from "next-intl";
import type { ReactNode } from "react";
import { compactCount } from "@/lib/compact-count";

/** The full localized description remains available to assistive technology. */
export default function BrowseResultCount({ count, label }: { count: number | null; label: ReactNode }) {
  const locale = useLocale();
  return <span role="status" className="browse-result-count" title={typeof label === "string" ? label : undefined}>
    <span aria-hidden="true">{count === null || count === undefined ? "—" : compactCount(count, locale)}</span>
    <span className="sr-only">{label}</span>
  </span>;
}
