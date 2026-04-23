"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, UserCircle2, ChevronDown } from "lucide-react";

export type ProviderProfile = {
  id: string;
  name: string;
  city: string;
  bio: string;
  avatar: string | null;
  typeLabel: string;
};

export default function ProviderProfiles({
  profiles,
  heading,
}: {
  profiles: ProviderProfile[];
  heading: string;
}) {
  const [open, setOpen] = useState(false);

  if (profiles.length === 0) return null;

  return (
    <div className="border-b border-border/40">
      <div className="max-w-7xl mx-auto px-4">
        {/* Toggle row */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 py-2.5 text-text-muted hover:text-text-secondary transition-colors group"
        >
          <span className="text-[11px] uppercase tracking-widest font-medium">
            {heading} ({profiles.length})
          </span>
          <ChevronDown
            size={13}
            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {/* Collapsible content */}
        {open && (
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-none">
            {profiles.map((p) => (
              <Link
                key={p.id}
                href={`/profile/${p.id}`}
                className="shrink-0 w-44 rounded-xl border border-border bg-bg-elevated hover:border-gold/60 transition-all group p-3 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2.5">
                  {p.avatar ? (
                    <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 border border-border">
                      <Image
                        src={p.avatar}
                        alt={p.name}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-bg-hover border border-border flex items-center justify-center shrink-0">
                      <UserCircle2 size={20} className="text-text-muted" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-primary truncate group-hover:text-gold transition-colors">
                      {p.name}
                    </p>
                    <p className="text-[10px] text-text-muted truncate">{p.typeLabel}</p>
                  </div>
                </div>
                {p.city && (
                  <p className="text-[10px] text-text-muted flex items-center gap-1 truncate">
                    <MapPin size={9} className="shrink-0" />
                    {p.city}
                  </p>
                )}
                {p.bio && (
                  <p className="text-[10px] text-text-muted line-clamp-2 leading-relaxed">
                    {p.bio}
                  </p>
                )}
                <span className="text-[10px] text-gold mt-auto">Profil ansehen →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
