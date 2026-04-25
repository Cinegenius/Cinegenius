"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, PawPrint, X, Truck, MapPin, Users } from "lucide-react";

const SPECIES = ["Alle", "Hunde", "Pferde & Ponys", "Katzen", "Vögel", "Reptilien", "Nutztiere", "Exoten", "Sonstige Tiere"];
const TRAINING = ["Alle", "Kinoprofi", "Erfahren", "Grundgehorsam", "Ungeübt"];

type Animal = {
  id: string;
  title: string;
  category: string;
  location: string;
  dailyRate: number;
  image: string;
  trainingLevel: string | null;
  handlerIncluded: boolean;
  count: string;
  specialSkills: string | null;
  delivery: boolean;
  focalPoint?: { x: number; y: number } | null;
  description?: string;
};

const TRAINING_COLORS: Record<string, string> = {
  "Kinoprofi": "text-gold border-gold/30 bg-gold-subtle",
  "Erfahren": "text-success border-success/30 bg-success/10",
  "Grundgehorsam": "text-text-secondary border-border bg-bg-elevated",
  "Ungeübt": "text-text-muted border-border bg-bg-elevated",
};

export default function TiereContent({ serverListings }: { serverListings: Animal[] }) {
  const [search, setSearch] = useState("");
  const [species, setSpecies] = useState("Alle");
  const [training, setTraining] = useState("Alle");
  const [deliveryOnly, setDeliveryOnly] = useState(false);

  const filtered = useMemo(() => {
    return serverListings.filter((a) => {
      if (search && !a.title.toLowerCase().includes(search.toLowerCase()) &&
          !a.category.toLowerCase().includes(search.toLowerCase())) return false;
      if (species !== "Alle" && a.category !== species) return false;
      if (training !== "Alle" && a.trainingLevel !== training) return false;
      if (deliveryOnly && !a.delivery) return false;
      return true;
    });
  }, [serverListings, search, species, training, deliveryOnly]);

  const activeFilters = [
    species !== "Alle" && species,
    training !== "Alle" && training,
    deliveryOnly && "Lieferung",
  ].filter(Boolean) as string[];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tier suchen…"
            className="w-full pl-9 pr-4 py-2.5 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors"
          />
        </div>

        <select value={species} onChange={(e) => setSpecies(e.target.value)}
          className="px-3 py-2.5 bg-bg-elevated border border-border rounded-xl text-sm text-text-secondary focus:outline-none focus:border-gold transition-colors">
          {SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={training} onChange={(e) => setTraining(e.target.value)}
          className="px-3 py-2.5 bg-bg-elevated border border-border rounded-xl text-sm text-text-secondary focus:outline-none focus:border-gold transition-colors">
          {TRAINING.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <button onClick={() => setDeliveryOnly((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm border transition-colors ${
            deliveryOnly ? "bg-gold/10 border-gold/30 text-gold" : "bg-bg-elevated border-border text-text-muted hover:text-text-secondary"
          }`}>
          <Truck size={14} /> Lieferung
        </button>
      </div>

      {/* Active filters */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {activeFilters.map((f) => (
            <span key={f} className="flex items-center gap-1.5 px-2.5 py-1 bg-gold/10 border border-gold/20 text-gold text-xs rounded-full">
              {f}
              <button onClick={() => {
                if (f === species) setSpecies("Alle");
                if (f === training) setTraining("Alle");
                if (f === "Lieferung") setDeliveryOnly(false);
              }}><X size={11} /></button>
            </span>
          ))}
          <button onClick={() => { setSpecies("Alle"); setTraining("Alle"); setDeliveryOnly(false); setSearch(""); }}
            className="text-xs text-text-muted hover:text-gold transition-colors px-2">
            Alle zurücksetzen
          </button>
        </div>
      )}

      {/* Count */}
      <p className="text-xs text-text-muted mb-6">{filtered.length} {filtered.length === 1 ? "Tier" : "Tiere"} gefunden</p>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-16 h-16 bg-bg-secondary border border-border rounded-2xl flex items-center justify-center mb-5">
            <PawPrint size={28} className="text-text-muted" />
          </div>
          <h3 className="font-display text-xl font-bold text-text-primary mb-2">Keine Tiere gefunden</h3>
          <p className="text-text-muted text-sm max-w-xs leading-relaxed mb-6">Passe deine Filter an oder inseriere als Erster ein Tier.</p>
          <Link href="/inserat" className="px-5 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors">
            Tier inserieren
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((animal) => (
            <Link key={animal.id} href={`/tiere/${animal.id}`}
              className="group bg-bg-secondary border border-border rounded-2xl overflow-hidden hover:border-gold/40 transition-all hover:shadow-lg hover:shadow-gold/5">
              <div className="relative h-48 overflow-hidden bg-bg-elevated">
                {animal.image ? (
                  <img
                    src={animal.image}
                    alt={animal.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    style={{ objectPosition: animal.focalPoint ? `${animal.focalPoint.x}% ${animal.focalPoint.y}%` : "50% 40%" }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <PawPrint size={40} className="text-text-muted/20" />
                  </div>
                )}
                {animal.delivery && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 bg-success/90 text-white text-[10px] font-semibold rounded-full flex items-center gap-1">
                    <Truck size={9} /> Lieferung
                  </span>
                )}
              </div>

              <div className="p-4">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="px-2 py-0.5 bg-bg-elevated border border-border text-text-muted text-[10px] rounded">{animal.category}</span>
                  {animal.trainingLevel && (
                    <span className={`px-2 py-0.5 border text-[10px] rounded font-medium ${TRAINING_COLORS[animal.trainingLevel] ?? TRAINING_COLORS["Grundgehorsam"]}`}>
                      {animal.trainingLevel}
                    </span>
                  )}
                </div>

                <h3 className="font-semibold text-text-primary text-sm mb-1 line-clamp-2 group-hover:text-gold transition-colors">
                  {animal.title}
                </h3>

                <div className="flex items-center gap-1 text-xs text-text-muted mb-3">
                  <MapPin size={11} /> {animal.location || "Standort auf Anfrage"}
                </div>

                {animal.handlerIncluded && (
                  <div className="flex items-center gap-1 text-[10px] text-text-muted mb-2">
                    <Users size={10} className="text-gold" /> Handler inklusive
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="font-display font-bold text-gold">
                    {animal.dailyRate > 0 ? `${animal.dailyRate.toLocaleString()} €` : "Auf Anfrage"}
                  </span>
                  {animal.dailyRate > 0 && <span className="text-xs text-text-muted">/Tag</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
