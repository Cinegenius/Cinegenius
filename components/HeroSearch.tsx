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

      {/* Search bar — compact, refined */}
      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row items-stretch sm:items-center bg-white/92 backdrop-blur-md rounded-xl overflow-hidden shadow-lg border border-white/10"
      >
        {/* Query */}
        <div className="flex items-center gap-2 flex-1 px-3.5 border-b border-gray-100 sm:border-b-0">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab.placeholder}
            style={{ color: "#1f2937" }}
            className="w-full py-2.5 text-[13px] bg-transparent focus:outline-none placeholder:text-gray-400"
          />
        </div>

        {/* Divider — desktop only */}
        <div className="hidden sm:block w-px h-6 bg-gray-200 shrink-0" />

        {/* City */}
        <div className="flex items-center gap-2 px-3.5 sm:w-36">
          <MapPin size={13} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Stadt"
            style={{ color: "#1f2937" }}
            className="w-full py-2.5 text-[13px] bg-transparent focus:outline-none placeholder:text-gray-400"
          />
        </div>

        {/* Button — compact, dark */}
        <button
          type="submit"
          className="m-1.5 px-4 py-2 bg-bg-primary hover:bg-bg-elevated text-white font-semibold text-[13px] rounded-lg transition-colors shrink-0 flex items-center justify-center gap-1.5"
        >
          <Search size={13} />
          Suchen
        </button>
      </form>
    </div>
  );
}
