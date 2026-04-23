"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin } from "lucide-react";

const tabs = [
  { id: "locations", label: "Locations",  placeholder: "Was suchst du? Locations, Equipment oder Jobs…", href: "/locations" },
  { id: "crew",      label: "Crew",      placeholder: "Fotograf, Kameramann, Editor…",                   href: "/creators" },
  { id: "equipment", label: "Equipment", placeholder: "Kamera, Licht, Ton, Kostüme…",                    href: "/props" },
  { id: "jobs",      label: "Jobs",      placeholder: "Job oder Auftrag suchen…",                        href: "/jobs" },
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
      <div className="flex gap-1 mb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setQuery(""); setCity(""); }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === t.id
                ? "bg-white/25 text-white shadow-sm"
                : "text-white/55 hover:text-white/85 hover:bg-white/10"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <form
        onSubmit={handleSearch}
        className="flex items-center bg-white rounded-full sm:rounded-xl overflow-hidden border-2 border-white/30 shadow-2xl sm:shadow-xl transition-all focus-within:border-[#C2F135]/70 focus-within:shadow-[0_0_0_3px_rgba(194,241,53,0.25),0_8px_32px_rgba(0,0,0,0.3)] min-h-[64px] sm:min-h-0"
      >
        {/* Query */}
        <div className="flex items-center gap-2.5 flex-1 px-5 sm:px-4">
          <Search size={18} className="text-gray-400 shrink-0 sm:w-4 sm:h-4" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab.placeholder}
            style={{ color: "#111827" }}
            className="w-full py-5 sm:py-4 text-sm sm:text-base bg-transparent focus:outline-none placeholder:text-gray-400 min-w-0 font-medium"
          />
        </div>

        {/* City — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-2 px-4 w-40 border-l border-gray-200">
          <MapPin size={14} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Stadt"
            style={{ color: "#111827" }}
            className="w-full py-4 text-sm bg-transparent focus:outline-none placeholder:text-gray-400"
          />
        </div>

        {/* Button */}
        <button
          type="submit"
          className="m-2 sm:m-1.5 px-4 sm:px-4 py-3.5 sm:py-2.5 bg-[#C2F135] hover:bg-[#D6F96A] text-[#0A0A0A] font-bold text-sm rounded-full sm:rounded-lg transition-colors shrink-0 flex items-center gap-1.5"
        >
          <Search size={16} className="sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">Suchen</span>
        </button>
      </form>
    </div>
  );
}
