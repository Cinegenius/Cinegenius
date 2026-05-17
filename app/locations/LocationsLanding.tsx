"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, MapPin, Star, ArrowRight, Plus } from "lucide-react";

type LocationCard = {
  id: string;
  title: string;
  type: string;
  city: string;
  price: number;
  image: string;
  rating: number;
  reviews: number;
  focalPoint?: { x: number; y: number } | null;
};

type CityGroup = {
  city: string;
  locations: LocationCard[];
};

const ACCENT = "99,102,241";
const g = (a: number) => `rgba(${ACCENT},${a})`;

const CATEGORIES = [
  { label: "Alle anzeigen", value: "" },
  { label: "Innenaufnahmen", value: "Wohnen" },
  { label: "Villa", value: "Villa" },
  { label: "Studio", value: "Studio" },
  { label: "Industrie", value: "Industrie" },
  { label: "Außen / Natur", value: "Natur" },
  { label: "Gastronomie", value: "Gastronomie" },
  { label: "Büro", value: "Büro" },
  { label: "Speziallocation", value: "Speziallocation" },
];

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

      {/* ── Hero / Search ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden pt-8 pb-6 px-4" style={{ background: "linear-gradient(135deg, #1a1d26 0%, #0E1016 60%)" }}>
        <div className="absolute -top-10 -right-10 w-[700px] h-[400px] rounded-full blur-[90px] pointer-events-none"
          style={{ background: `radial-gradient(ellipse at center, ${g(0.45)}, transparent 70%)` }} />
        <div className="absolute -bottom-10 left-1/4 w-72 h-48 rounded-full blur-[70px] pointer-events-none"
          style={{ background: `radial-gradient(ellipse at center, ${g(0.20)}, transparent 70%)` }} />

        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3"
            style={{ background: g(0.10), border: `1px solid ${g(0.30)}` }}>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: g(1) }}>
              Filmlocations Deutschland
            </span>
          </div>

          <h1 className="font-display text-2xl sm:text-4xl font-bold text-text-primary mb-2 leading-tight">
            Finde die perfekte <span className="text-gradient-gold">Location</span>
          </h1>

          <p className="text-text-muted text-sm mb-4">
            {totalCount > 0
              ? `${totalCount.toLocaleString("de-DE")} Locations für Film, Werbung & Foto`
              : "Apartments, Villen, Studios, Außengelände & mehr"}
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-3">
            <div className="flex items-center bg-bg-elevated border border-border rounded-xl p-1.5 shadow-xl gap-2 focus-within:border-indigo-400/50 transition-colors">
              <div className="flex items-center gap-2 flex-1 px-3">
                <Search size={15} className="text-text-muted shrink-0" />
                <input
                  type="text"
                  placeholder="Stadt, Location-Typ oder Stichwort..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted outline-none text-sm py-1.5"
                  autoComplete="off"
                />
                {query && (
                  <button type="button" onClick={() => setQuery("")} className="text-text-muted hover:text-text-primary transition-colors">
                    ×
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-5 py-2 bg-gold text-bg-primary font-bold rounded-lg hover:bg-gold-light transition-colors text-sm shrink-0"
              >
                Suchen →
              </button>
            </div>
          </form>

          {/* Quick link to full search */}
          <div className="mb-4">
            <Link
              href="/locations/suche"
              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors"
            >
              <MapPin size={11} />
              Alle Locations mit Karte & Filtern ansehen <ArrowRight size={11} />
            </Link>
          </div>

          {/* Category pills — scroll on mobile, wrap on desktop */}
          <div className="flex gap-2 overflow-x-auto sm:overflow-x-visible sm:flex-wrap sm:justify-center pb-1" style={{ scrollbarWidth: "none" }}>
            {CATEGORIES.map(({ label, value }) => (
              <Link
                key={label}
                href={`/locations/suche${value ? `?type=${encodeURIComponent(value)}` : ""}`}
                className="shrink-0 sm:shrink px-3 py-1.5 rounded-full text-xs border border-border text-text-secondary hover:text-text-primary hover:border-indigo-400/40 transition-all bg-bg-elevated whitespace-nowrap"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── City sections ─────────────────────────────────────────── */}
      <div className="pb-20 space-y-14">
        {cityGroups.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center mx-auto mb-4">
              <MapPin size={24} className="text-text-muted" />
            </div>
            <p className="text-text-primary font-semibold mb-1">Noch keine Locations</p>
            <p className="text-text-muted text-sm mb-6">Sei der Erste und trage deine Location ein.</p>
            <Link
              href="/inserat?group=drehorte"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary font-semibold rounded-xl text-sm"
            >
              <Plus size={14} /> Location eintragen
            </Link>
          </div>
        ) : (
          cityGroups.map(({ city, locations }) => (
            <section key={city} className="px-4 sm:px-6 lg:px-8">
              {/* Section header */}
              <div className="flex items-center justify-between mb-5 max-w-7xl mx-auto">
                <h2 className="text-xl sm:text-2xl font-bold text-text-primary flex items-center gap-2">
                  <MapPin size={16} style={{ color: g(1) }} />
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
                        {loc.price.toLocaleString("de-DE")} €
                        <span className="text-xs text-text-muted font-normal">/Tag</span>
                      </span>
                    </div>
                  </Link>
                ))}

                {/* "Alle anzeigen" card */}
                <Link
                  href={`/locations/suche?q=${encodeURIComponent(city)}`}
                  className="shrink-0 w-64 h-44 rounded-2xl border border-border border-dashed bg-bg-elevated hover:border-indigo-400/40 hover:bg-bg-secondary transition-all flex flex-col items-center justify-center gap-3 group"
                >
                  <div className="w-10 h-10 rounded-full border border-border group-hover:border-indigo-400/40 flex items-center justify-center transition-colors">
                    <ArrowRight size={16} className="text-text-muted group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <p className="text-sm text-text-muted group-hover:text-text-primary transition-colors">
                    Alle in {city}
                  </p>
                </Link>
              </div>
            </section>
          ))
        )}
      </div>

      {/* ── CTA banner ────────────────────────────────────────────── */}
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
    </div>
  );
}
