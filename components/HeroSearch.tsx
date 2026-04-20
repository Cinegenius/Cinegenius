"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin } from "lucide-react";

const tabs = [
  { id: "locations", label: "Locations",  placeholder: "Wohnung, Studio, Industriehalle...", href: "/locations" },
  { id: "crew",      label: "Crew",      placeholder: "Kameramann, Regisseur, Editor...",  href: "/creators" },
  { id: "equipment", label: "Equipment", placeholder: "Kamera, Licht, Ton, Kostüme...",    href: "/props" },
  { id: "jobs",      label: "Jobs",      placeholder: "Kameraassistent, Cutter, DP...",    href: "/jobs" },
];

export default function HeroSearch() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("locations");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");

  const tab = tabs.find((t) => t.id === activeTab)!;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (city.trim()) params.set("city", city.trim());
    const qs = params.toString();
    router.push(`${tab.href}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="w-full">
      {/* Tabs — subtle pill style */}
      <div className="flex flex-wrap gap-0.5 mb-2.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setQuery(""); setCity(""); }}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeTab === t.id
                ? "bg-white/20 text-white"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search bar — always inline, compact */}
      <form
        onSubmit={handleSearch}
        className="flex items-center bg-white/92 backdrop-blur-md rounded-lg overflow-hidden border border-white/10 shadow-md"
      >
        {/* Query */}
        <div className="flex items-center gap-2 flex-1 px-3">
          <Search size={13} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab.placeholder}
            style={{ color: "#1f2937" }}
            className="w-full py-2 text-[12px] sm:text-[13px] bg-transparent focus:outline-none placeholder:text-gray-400 min-w-0"
          />
        </div>

        {/* City — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 w-36 border-l border-gray-200">
          <MapPin size={12} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Stadt"
            style={{ color: "#1f2937" }}
            className="w-full py-2 text-[13px] bg-transparent focus:outline-none placeholder:text-gray-400"
          />
        </div>

        {/* Button */}
        <button
          type="submit"
          className="m-1 px-3 py-1.5 bg-bg-primary hover:bg-bg-elevated text-white font-medium text-[12px] sm:text-[13px] rounded-md transition-colors shrink-0 flex items-center gap-1"
        >
          <Search size={12} />
          <span className="hidden sm:inline">Suchen</span>
        </button>
      </form>
    </div>
  );
}
