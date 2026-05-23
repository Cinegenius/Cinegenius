"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin } from "lucide-react";

const tabs = [
  { id: "locations", label: "Locations", placeholder: "Location suchen…",    href: "/locations" },
  { id: "crew",      label: "Crew",      placeholder: "Fotograf, Kameramann…", href: "/creators" },
  { id: "equipment", label: "Equipment", placeholder: "Kamera, Licht, Ton…",   href: "/props" },
  { id: "jobs",      label: "Jobs",      placeholder: "Job oder Auftrag…",      href: "/jobs" },
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
      {/* Tabs — overflow-x-auto so they never clip on tiny screens */}
      <div className="flex gap-1 mb-2.5 overflow-x-auto scrollbar-none">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setQuery(""); setCity(""); }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
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
        className="flex items-center bg-bg-elevated/90 backdrop-blur-md rounded-full sm:rounded-xl overflow-hidden border border-border/60 shadow-2xl transition-all focus-within:border-gold/50 focus-within:shadow-[0_0_0_3px_rgba(194,241,53,0.15),0_8px_32px_rgba(0,0,0,0.4)] min-h-[52px] sm:min-h-0"
      >
        {/* Query */}
        <div className="flex items-center gap-2 flex-1 px-4">
          <Search size={15} className="text-text-muted shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab.placeholder}
            className="w-full py-3.5 sm:py-4 text-sm bg-transparent focus:outline-none placeholder:text-text-muted text-text-primary min-w-0 font-medium"
          />
        </div>

        {/* City — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-2 px-4 w-40 border-l border-border/60">
          <MapPin size={14} className="text-text-muted shrink-0" />
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Stadt"
            className="w-full py-4 text-sm bg-transparent focus:outline-none placeholder:text-text-muted text-text-primary"
          />
        </div>

        {/* Button */}
        <button
          type="submit"
          className="m-1.5 px-3.5 sm:px-4 py-2.5 bg-[#C2F135] hover:bg-[#D6F96A] text-[#0A0A0A] font-bold text-sm rounded-full sm:rounded-lg transition-colors shrink-0 flex items-center gap-1.5"
        >
          <Search size={15} className="sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">Suchen</span>
        </button>
      </form>
    </div>
  );
}
