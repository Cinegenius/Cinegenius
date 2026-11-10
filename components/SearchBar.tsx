"use client";

import { useState } from "react";
import { Search, MapPin, ShoppingBag, Briefcase, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";







function getLocalizedPlaceholders(translate: (key: string) => string): Record<string, string> { return ({
  "Alles":      translate("Ui.text_257383a2e99f13"),
  "Locations":   translate("Ui.text_9222e2bfdbb30c"),
  "Marktplatz": translate("Ui.text_949a42ae0eb9fc"),
  "Jobs":       translate("Ui.text_39e8fd5c32c3cf"),
  "Crew":       translate("Ui.text_bbf44a24d3dedb"),
}); }

function getLocalizedCategories(translate: (key: string) => string) {
  return ([
  { id: "Alles", label: translate("home.boardAll"),      href: "/locations",   icon: Search },
  { id: "Locations", label: translate("nav.locations"),   href: "/locations",   icon: MapPin },
  { id: "Marktplatz", label: translate("nav.marketplace"), href: "/marketplace", icon: ShoppingBag },
  { id: "Jobs", label: translate("nav.jobs"),       href: "/jobs",        icon: Briefcase },
  { id: "Crew", label: translate("nav.crew"),       href: "/creators",    icon: Users },
]);
}

export default function SearchBar() {
  const uiText = useTranslations();
  const placeholders = getLocalizedPlaceholders(uiText);

  const categories = getLocalizedCategories(uiText);


  const [active, setActive] = useState("Alles");
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const target = categories.find(c => c.id === active) ?? categories[0];
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
        >{uiText("locations.landingSearch")}</button>
      </form>

      {/* Category pills */}
      <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
        {categories.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              active === id
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
