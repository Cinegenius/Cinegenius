"use client";

import { useState } from "react";
import { Search, MapPin, ShoppingBag, Briefcase, Users } from "lucide-react";
import { useRouter } from "next/navigation";

const categories = [
  { label: "Alles",      href: "/locations",   icon: Search },
  { label: "Locations",   href: "/locations",   icon: MapPin },
  { label: "Marktplatz", href: "/marketplace", icon: ShoppingBag },
  { label: "Jobs",       href: "/jobs",        icon: Briefcase },
  { label: "Crew",       href: "/creators",    icon: Users },
];

const placeholders: Record<string, string> = {
  "Alles":      "Locations, Requisiten, Jobs oder Crew suchen...",
  "Locations":   "Lagerhallen, Anwesen, Studios in Berlin...",
  "Marktplatz": "Kamera, Kostüm, Fahrzeug, Requisite...",
  "Jobs":       "Kameramann, Gaffer, Cutter, Tonmeister...",
  "Crew":       "Regisseur, DP, Make-up-Artist, Editor...",
};

export default function SearchBar() {
  const [active, setActive] = useState("Alles");
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const target = categories.find(c => c.label === active)!;
    router.push(query.trim() ? `${target.href}?q=${encodeURIComponent(query)}` : target.href);
  };

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-up delay-200">
      {/* Search input */}
      <form
        onSubmit={handleSearch}
        className="flex items-center bg-white/90 border border-white/20 rounded-2xl overflow-hidden shadow-xl"
      >
        <Search size={18} className="ml-4 text-gray-400 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholders[active]}
          className="flex-1 bg-transparent border-none px-3 py-4 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
        />
        <button
          type="submit"
          className="m-1.5 px-5 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-xl hover:bg-gold-light transition-colors shrink-0"
        >
          Suchen
        </button>
      </form>

      {/* Category pills */}
      <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
        {categories.map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => setActive(label)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              active === label
                ? "bg-gold text-bg-primary border-gold"
                : "border-white/30 text-white/80 hover:border-gold hover:text-gold bg-white/10"
            }`}
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
