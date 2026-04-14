"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Car, MapPin, CheckCircle, Filter, X, Zap, Truck, Search } from "lucide-react";
import EmptyState from "@/components/EmptyState";

const vehicleTypes = ["Alle", "Bild-Fahrzeug", "Classic Car", "Vintage Van", "Military Vehicle", "Vintage Limousine", "Stunt Vehicle", "Luxury Classic"];
const eras = ["Alle", "1950s", "1960s–70s", "1970s", "1970s–80s", "1980s–90s", "2000s", "Modern"];

type Vehicle = {
  id: string; title: string; type: string; make: string; model: string; year: number;
  color: string; era: string | null; condition: string; location: string; vendor: string;
  dailyRate: number; image: string; tags: string[]; instantBook: boolean; verified: boolean;
  delivery: boolean; description?: string; ownerId?: string; ownerName?: string; isReal?: boolean;
};

export default function VehiclesContent({ serverVehicles }: { serverVehicles: Vehicle[] }) {
  const allVehicles = useMemo(() => serverVehicles, [serverVehicles]);

  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("Alle");
  const [selectedEra, setSelectedEra] = useState("Alle");
  const [deliveryOnly, setDeliveryOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(3000);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return allVehicles.filter((v) => {
      if (search && !v.title.toLowerCase().includes(search.toLowerCase()) && !v.make.toLowerCase().includes(search.toLowerCase()) && !v.location.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedType !== "Alle" && v.type !== selectedType) return false;
      if (selectedEra !== "Alle" && v.era !== selectedEra) return false;
      if (deliveryOnly && !v.delivery) return false;
      if (verifiedOnly && !v.verified) return false;
      if (v.dailyRate > maxPrice) return false;
      return true;
    });
  }, [allVehicles, search, selectedType, selectedEra, deliveryOnly, verifiedOnly, maxPrice]);

  const clearFilters = () => {
    setSearch(""); setSelectedType("Alle"); setSelectedEra("Alle");
    setDeliveryOnly(false); setVerifiedOnly(false); setMaxPrice(3000);
  };

  const activeFilterCount = [
    selectedType !== "Alle", selectedEra !== "Alle",
    deliveryOnly, verifiedOnly, maxPrice < 3000,
  ].filter(Boolean).length;

  return (
    <div className="pt-16 min-h-screen">
      <div className="relative py-16 border-b border-border bg-bg-secondary overflow-hidden">
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1920&q=40')", backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
              <Car size={16} className="text-gold" />
            </div>
            <p className="text-xs uppercase tracking-widest text-gold font-semibold">Fahrzeuge</p>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-text-primary mb-3">Film-Fahrzeuge mieten</h1>
          <p className="text-text-secondary max-w-2xl leading-relaxed mb-6">
            Classic Cars, Military Vehicles, Vintage Vans, Stunt Cars — authentische Fahrzeuge für jede Produktion.
            Direkt buchen, sicher bezahlen.
          </p>
          <div className="relative max-w-xl">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Marke, Modell oder Ort suchen..."
              className="w-full pl-10 pr-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className={`lg:w-60 shrink-0 ${showFilters ? "block" : "hidden lg:block"}`}>
            <div className="sticky top-24 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-text-primary text-sm">Filter</h3>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-xs text-gold hover:text-gold-light flex items-center gap-1">
                    <X size={12} /> Zurücksetzen
                  </button>
                )}
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-2">Fahrzeugtyp</p>
                <div className="space-y-1">
                  {vehicleTypes.map((t) => (
                    <button key={t} onClick={() => setSelectedType(t)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${selectedType === t ? "bg-gold-subtle text-gold font-medium" : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-2">Ära / Epoche</p>
                <div className="space-y-1">
                  {eras.map((e) => (
                    <button key={e} onClick={() => setSelectedEra(e)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${selectedEra === e ? "bg-gold-subtle text-gold font-medium" : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"}`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-2">
                  Max. Preis: <span className="text-gold">{maxPrice.toLocaleString()} €/Tag</span>
                </p>
                <input type="range" min={200} max={3000} step={100} value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))} className="w-full accent-gold" />
                <div className="flex justify-between text-xs text-text-muted mt-1">
                  <span>200 €</span><span>3.000 €</span>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-2">Optionen</p>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input type="checkbox" className="accent-gold" checked={deliveryOnly} onChange={(e) => setDeliveryOnly(e.target.checked)} />
                  <span className="text-sm text-text-secondary">Lieferung verfügbar</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="accent-gold" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
                  <span className="text-sm text-text-secondary">Nur Verifizierte</span>
                </label>
              </div>
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-6 gap-4">
              <p className="text-sm text-text-muted">
                <span className="text-text-primary font-semibold">{filtered.length}</span> Fahrzeuge gefunden
              </p>
              <button onClick={() => setShowFilters((v) => !v)}
                className="lg:hidden flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-text-secondary hover:border-gold hover:text-gold transition-all">
                <Filter size={14} /> Filter
                {activeFilterCount > 0 && (
                  <span className="w-5 h-5 bg-gold text-bg-primary text-xs rounded-full flex items-center justify-center">{activeFilterCount}</span>
                )}
              </button>
            </div>

            {filtered.length === 0 ? (
              <EmptyState icon={Car} title="Keine Fahrzeuge gefunden" description="Passe die Filter an oder setze sie zurück." action={{ label: "Filter zurücksetzen", onClick: clearFilters }} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {filtered.map((v) => (
                  <Link key={v.id} href={`/vehicles/${v.id}`} className="card-hover group rounded-xl border border-border bg-bg-secondary overflow-hidden block">
                    <div className="relative aspect-video overflow-hidden bg-bg-elevated">
                      {v.image
                        ? <img src={v.image} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        : <div className="w-full h-full flex items-center justify-center text-text-muted/20"><svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg></div>
                      }
                      <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/60 to-transparent" />
                      <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
                        {v.isReal && <span className="px-2 py-0.5 bg-success text-white text-xs font-bold rounded">NEU</span>}
                        {v.instantBook && <span className="px-2 py-0.5 bg-gold text-bg-primary text-xs font-semibold rounded flex items-center gap-1"><Zap size={10} /> Sofortbuchung</span>}
                        {v.verified && <span className="px-2 py-0.5 bg-bg-primary/80 border border-border text-text-secondary text-xs rounded flex items-center gap-1"><CheckCircle size={10} className="text-success" /> Verifiziert</span>}
                      </div>
                      <div className="absolute bottom-3 left-3 right-3">
                        <div className="flex flex-wrap gap-1">
                          {v.tags.slice(0, 2).map((t) => (
                            <span key={t} className="px-2 py-0.5 bg-bg-primary/70 text-text-secondary text-xs rounded">{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-text-primary text-sm leading-snug">{v.title}</h3>
                        {v.year > 0 && <span className="text-xs px-2 py-0.5 bg-bg-elevated border border-border text-text-muted rounded shrink-0">{v.year}</span>}
                      </div>
                      <p className="text-xs text-text-muted mb-1 flex items-center gap-1"><MapPin size={11} /> {v.location}</p>
                      <p className="text-xs text-text-muted mb-3">{v.vendor}</p>
                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                          <span className="px-1.5 py-0.5 bg-bg-elevated rounded">{v.type}</span>
                          {v.delivery && <span className="flex items-center gap-0.5 text-success"><Truck size={10} /> Lieferung</span>}
                        </div>
                        <span className="text-sm font-semibold text-gold">{v.dailyRate.toLocaleString()} €<span className="text-text-muted font-normal text-xs">/Tag</span></span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
