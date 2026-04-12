import Image from "next/image";
import Link from "next/link";
import { MapPin, UserCircle2 } from "lucide-react";

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
  if (profiles.length === 0) return null;

  return (
    <div className="border-b border-border bg-bg-secondary px-4 py-5">
      <div className="max-w-7xl mx-auto">
        <p className="text-xs text-text-muted uppercase tracking-widest mb-3 font-semibold">
          {heading}
        </p>
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
          {profiles.map((p) => (
            <Link
              key={p.id}
              href={`/creators/${p.id}`}
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
      </div>
    </div>
  );
}
