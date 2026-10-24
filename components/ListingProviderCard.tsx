import Image from "next/image";
import Link from "next/link";
import { Building2, UserRound } from "lucide-react";
import type { ListingProvider } from "@/lib/listing-provider";

export default function ListingProviderCard({ provider, compact = false }: { provider: ListingProvider; compact?: boolean }) {
  const Icon = provider.kind === "company" ? Building2 : UserRound;
  const content = (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-elevated text-gold">
        {provider.imageUrl ? <Image src={provider.imageUrl} alt="" width={44} height={44} unoptimized className="h-full w-full object-cover" /> : <Icon size={19} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] uppercase tracking-wide text-text-muted">{provider.kind === "unassigned" ? "Anbieterstatus" : provider.kind === "company" ? "Anbieter · Firma" : "Anbieter"}</span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-text-primary">{provider.name}</span>
      </span>
      {provider.href && <span className="shrink-0 text-xs text-gold">Profil ansehen →</span>}
    </>
  );
  const className = `flex items-center gap-3 rounded-xl border border-border bg-bg-secondary ${compact ? "p-3" : "p-4"} ${provider.href ? "transition-colors hover:border-gold/40 hover:bg-bg-elevated" : ""}`;
  return provider.href
    ? <Link href={provider.href} className={className}>{content}</Link>
    : <div className={className}>{content}</div>;
}
