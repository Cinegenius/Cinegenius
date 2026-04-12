"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin } from "lucide-react";

const tabs = [
  { id: "locations", label: "Drehorte",  placeholder: "Wohnung, Studio, Industriehalle...", href: "/locations" },
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
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-black/30 backdrop-blur-sm border border-white/15 rounded-xl mb-2 w-fit mx-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setQuery(""); setCity(""); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === t.id
                ? "bg-gold text-bg-primary shadow-sm"
                : "text-white/70 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <form
        onSubmit={handleSearch}
        className="flex items-center gap-0 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden border border-white/20"
      >
        {/* Query */}
        <div className="flex items-center gap-2.5 flex-1 px-4">
          <Search size={17} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab.placeholder}
            style={{ color: "#1f2937" }}
            className="w-full py-4 text-sm bg-transparent focus:outline-none placeholder:text-gray-400"
          />
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-200 shrink-0" />

        {/* City */}
        <div className="flex items-center gap-2 px-4 w-44">
          <MapPin size={15} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Stadt"
            style={{ color: "#1f2937" }}
            className="w-full py-4 text-sm bg-transparent focus:outline-none placeholder:text-gray-400"
          />
        </div>

        {/* Button */}
        <button
          type="submit"
          className="m-1.5 px-5 py-3 bg-gold hover:bg-gold-light text-bg-primary font-bold text-sm rounded-xl transition-colors shrink-0 flex items-center gap-2"
        >
          <Search size={15} />
          Suchen
        </button>
      </form>
    </div>
  );
}
