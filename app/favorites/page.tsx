"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Heart, ArrowLeft, MapPin, Car, Package, Briefcase, Users, Trash2 } from "lucide-react";

type Favorite = {
  id: string;
  listing_id: string;
  listing_type: string;
  listing_title: string | null;
  listing_city: string | null;
  listing_price: number | null;
  listing_image: string | null;
  created_at: string;
};

const typeConfig: Record<string, {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  href: (id: string) => string;
  color: string;
}> = {
  location: { label: "Drehort",    icon: MapPin,    href: (id) => `/locations/${id}`, color: "text-sky-400" },
  vehicle:  { label: "Fahrzeug",   icon: Car,       href: (id) => `/vehicles/${id}`,  color: "text-orange-400" },
  prop:     { label: "Requisite",  icon: Package,   href: (id) => `/props/${id}`,     color: "text-violet-400" },
  job:      { label: "Job",        icon: Briefcase, href: (id) => `/jobs/${id}`,      color: "text-emerald-400" },
  creator:  { label: "Filmschaffende/r", icon: Users, href: (id) => `/creators/${id}`, color: "text-gold" },
};

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/favorites")
      .then((r) => r.json())
      .then(({ favorites: data }) => setFavorites(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const remove = async (fav: Favorite) => {
    setRemoving(fav.listing_id);
    try {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: fav.listing_id,
          listing_type: fav.listing_type,
        }),
      });
      setFavorites((prev) => prev.filter((f) => f.listing_id !== fav.listing_id));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">

        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/dashboard"
            className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-text-muted hover:text-gold hover:border-gold transition-all"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary flex items-center gap-2">
              <Heart size={20} className="text-crimson-light fill-current" />
              Merkliste
            </h1>
            <p className="text-sm text-text-muted mt-0.5">Gespeicherte Inserate</p>
          </div>
          {!loading && favorites.length > 0 && (
            <span className="ml-auto px-3 py-1 bg-bg-secondary border border-border text-text-muted text-xs rounded-full">
              {favorites.length} {favorites.length === 1 ? "Eintrag" : "Einträge"}
            </span>
          )}
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-bg-secondary border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!loading && favorites.length === 0 && (
          <div className="text-center py-20 border border-dashed border-border rounded-2xl space-y-4">
            <div className="w-16 h-16 mx-auto bg-bg-secondary border border-border rounded-full flex items-center justify-center">
              <Heart size={24} className="text-text-muted opacity-40" />
            </div>
            <div>
              <h2 className="font-semibold text-text-primary mb-1">Noch nichts gespeichert</h2>
              <p className="text-sm text-text-muted max-w-sm mx-auto">
                Klicke das Herz-Symbol auf einer Detailseite, um Drehorte, Crew, Jobs und mehr zu speichern.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/locations" className="px-4 py-2 border border-border text-text-secondary text-sm rounded-lg hover:border-gold hover:text-gold transition-all">
                Drehorte entdecken
              </Link>
              <Link href="/creators" className="px-4 py-2 border border-border text-text-secondary text-sm rounded-lg hover:border-gold hover:text-gold transition-all">
                Filmschaffende finden
              </Link>
              <Link href="/jobs" className="px-4 py-2 border border-border text-text-secondary text-sm rounded-lg hover:border-gold hover:text-gold transition-all">
                Jobs durchsuchen
              </Link>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {favorites.map((fav) => {
            const config = typeConfig[fav.listing_type];
            if (!config) return null;
            const Icon = config.icon;
            const isRemoving = removing === fav.listing_id;

            return (
              <div
                key={fav.id}
                className={`flex items-center gap-4 p-4 rounded-xl border border-border bg-bg-secondary hover:border-gold/30 transition-all ${
                  isRemoving ? "opacity-50" : ""
                }`}
              >
                {/* Thumbnail */}
                <Link href={config.href(fav.listing_id)} className="shrink-0">
                  {fav.listing_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={fav.listing_image}
                      alt={fav.listing_title ?? ""}
                      className="w-14 h-14 rounded-lg object-cover border border-border hover:opacity-90 transition-opacity"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                      <Icon size={20} className={config.color} />
                    </div>
                  )}
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <Link href={config.href(fav.listing_id)} className="hover:text-gold transition-colors">
                    <p className="font-semibold text-text-primary truncate">{fav.listing_title ?? "Inserat"}</p>
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`flex items-center gap-1 text-xs ${config.color}`}>
                      <Icon size={10} /> {config.label}
                    </span>
                    {fav.listing_city && (
                      <span className="text-xs text-text-muted">{fav.listing_city}</span>
                    )}
                    <span className="text-xs text-text-muted">
                      · Gespeichert {new Date(fav.created_at).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>

                {/* Price */}
                {fav.listing_price != null && fav.listing_price > 0 && (
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gold font-mono">{fav.listing_price.toLocaleString()} €</p>
                    <p className="text-xs text-text-muted">/ Tag</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={config.href(fav.listing_id)}
                    className="px-3 py-1.5 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-all"
                  >
                    Ansehen
                  </Link>
                  <button
                    onClick={() => remove(fav)}
                    disabled={isRemoving}
                    className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-crimson-light transition-colors disabled:opacity-40"
                    title="Entfernen"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
