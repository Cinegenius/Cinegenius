import { BadgeCheck } from "lucide-react";

/** Display only the current explicit verification flag, never a historical request. */
export default function VerifiedBadge({ verified, label }: { verified?: boolean | null; label: string }) {
  if (verified !== true) return null;
  return <span role="img" aria-label={label} title={label} className="ml-1 inline-flex shrink-0 align-middle text-gold">
    <BadgeCheck aria-hidden="true" className="size-[1em] min-h-3.5 min-w-3.5 max-h-6 max-w-6" />
  </span>;
}
