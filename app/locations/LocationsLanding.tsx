"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "@/components/MediaImage";
import Link from "next/link";
import { Search, MapPin, Star, ArrowRight, Plus } from "lucide-react";
import PageHeader from "@/components/PageHeader";

type LocationCard = {
  id: string;
  title: string;
  type: string;
  city: string;
  price: number;
  priceOnRequest: boolean;
  priceLabel?: string;
  image: string;
  rating: number;
  reviews: number;
  focalPoint?: { x: number; y: number } | null;
};

type CityGroup = {
  city: string;
  locations: LocationCard[];
};

export default function LocationsLanding({
  cityGroups,
  totalCount,
}: {
  cityGroups: CityGroup[];
  totalCount: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.push(`/locations/suche${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHeader
        badge="Filmlocations Deutschland"
        title="Finde die perfekte"
        titleHighlight="Location"
        description={totalCount > 0
          ? `${totalCount.toLocaleString("de-DE")} Locations für Film, Werbung & Foto`
          : "Apartments, Villen, Studios, Außengelände & mehr"}
        ctaSecondary={{ label: "Alle Locations ansehen", href: "/locations/suche" }}
        cta={{ label: "Location anbieten", href: "/inserat?group=drehorte" }}
      >
        <form onSubmit={handleSearch} className="max-w-2xl">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-elevated p-1.5 transition-colors focus-within:border-gold/50">
            <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
              <Search size={15} className="shrink-0 text-text-muted" />
              <input
                type="text"
                placeholder="Stadt, Location-Typ oder Stichwort..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
                autoComplete="off"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="text-text-muted transition-colors hover:text-text-primary">
                  ×
                </button>
              )}
            </div>
            <button type="submit" className="shrink-0 rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-bg-primary transition-colors hover:bg-gold-light">
              Suchen <ArrowRight size={14} className="ml-1 inline" />
            </button>
          </div>
        </form>
      </PageHeader>

      {/* ── City sections ─────────────────────────────────────────── */}
      <div className="site-content-width space-y-10 mobile-bottom-nav-clear sm:space-y-14">
        {cityGroups.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center mx-auto mb-4">
              <MapPin size={24} className="text-text-muted" />
            </div>
            <p className="text-text-primary font-semibold mb-1">Noch keine Locations</p>
            <p className="text-text-muted text-sm mb-6">Sei der Erste und trage deine Location ein.</p>
            <Link href="/inserat?group=drehorte" className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-bg-primary">
              <Plus size={14} /> Location eintragen
            </Link>
          </div>
        ) : (
          cityGroups.map(({ city, locations }) => (
            <section key={city} className="px-4 sm:px-6 lg:px-8">
              {/* Section header */}
              <div className="flex items-center justify-between mb-5 max-w-7xl mx-auto">
                <h2 className="text-xl sm:text-2xl font-bold text-text-primary flex items-center gap-2">
                  <MapPin size={16} className="text-gold" />
                  Locations in {city}
                </h2>
                <Link
                  href={`/locations/suche?q=${encodeURIComponent(city)}`}
                  className="text-sm text-text-muted hover:text-gold flex items-center gap-1 transition-colors"
                >
                  Alle ansehen <ArrowRight size={12} />
                </Link>
              </div>

              {/* Horizontal scroll */}
              <div
                className="flex gap-5 overflow-x-auto pb-3 max-w-7xl mx-auto"
                style={{ scrollbarWidth: "none" }}
              >
                {locations.map((loc) => (
                  <Link
                    key={loc.id}
                    href={`/locations/${loc.id}`}
                    className="shrink-0 w-64 group"
                  >
                    {/* Image */}
                    <div className="relative w-64 h-44 rounded-2xl overflow-hidden bg-bg-elevated mb-3 border border-border/50">
                      {loc.image ? (
                        <Image
                          src={loc.image}
                          alt={loc.title}
                          fill
                          sizes="256px"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          style={
                            loc.focalPoint
                              ? { objectPosition: `${loc.focalPoint.x * 100}% ${loc.focalPoint.y * 100}%` }
                              : undefined
                          }
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <MapPin size={28} className="text-text-muted" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <p className="text-sm font-semibold text-text-primary group-hover:text-gold transition-colors truncate">
                      {loc.title}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">{loc.type} · {loc.city}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      {loc.rating > 0 ? (
                        <span className="flex items-center gap-1 text-xs text-text-muted">
                          <Star size={10} className="text-gold fill-gold" />
                          {loc.rating.toFixed(1)}
                          <span className="text-text-muted/60">({loc.reviews})</span>
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted/40">Neu</span>
                      )}
                      <span className="text-sm font-bold text-gold">
                        {loc.priceLabel ?? (loc.priceOnRequest ? "Preis auf Anfrage" : `${loc.price.toLocaleString("de-DE")} €/Tag`)}
                      </span>
                    </div>
                  </Link>
                ))}

              </div>
            </section>
          ))
        )}
      </div>

      {/* ── CTA banner ────────────────────────────────────────────── */}
      {cityGroups.length > 0 && (
        <div className="mx-4 sm:mx-6 lg:mx-8 mb-16 rounded-2xl border border-border bg-bg-elevated p-8 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-7xl xl:mx-auto">
          <div>
            <p className="font-bold text-text-primary text-lg mb-1">Deine Location eintragen</p>
            <p className="text-text-muted text-sm">Vermiete deinen Space an Filmteams, Fotografen & Creator.</p>
          </div>
          <Link
            href="/inserat?group=drehorte"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gold text-bg-primary font-bold rounded-xl hover:bg-gold-light transition-colors text-sm whitespace-nowrap shrink-0"
          >
            Location eintragen <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
