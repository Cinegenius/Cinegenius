"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";

function getLocalizedTabs(translate: (key: string) => string) {
  return ([
  { id: "locations", label: translate("nav.locations"), placeholder: translate("Ui.text_64869d31081bb8"),    href: "/locations" },
  { id: "crew",      label: translate("nav.crew"),      placeholder: translate("Ui.text_323d7dd4417e20"), href: "/creators" },
  { id: "equipment", label: translate("companies.groupAusstattung"), placeholder: translate("Ui.text_debf8074d5b54f"),   href: "/props" },
  { id: "jobs",      label: translate("nav.jobs"),      placeholder: translate("Ui.text_73c2890fe0d243"),      href: "/jobs" },
]);
}

export default function HeroSearch() {
  const uiText = useTranslations();
  const tabs = getLocalizedTabs(uiText);

  const router = useRouter();
  const [activeTab, setActiveTab] = useState("locations");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");

  const tab = tabs.find((t) => t.id === activeTab)!;
  const cityParam = "cityText";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (city.trim()) params.set(cityParam, city.trim());
    const qs = params.toString();
    router.push(`${tab.href}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="w-full rounded-2xl border border-border bg-bg-primary/85 p-2 shadow-lg shadow-black/15 sm:p-3">
      <div role="group" aria-label={uiText("home.heroSearchAction")} className="mb-2 flex flex-wrap gap-1 px-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            className={`relative min-h-11 min-w-0 max-w-full rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              activeTab === t.id
                ? "bg-gold-subtle text-gold after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-gold"
                : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <form
        onSubmit={handleSearch}
        action={tab.href}
        method="get"
        className="flex min-h-[52px] items-center overflow-hidden rounded-xl border border-border bg-bg-secondary shadow-sm transition-colors focus-within:border-gold"
      >
        {/* Query */}
        <div className="flex items-center gap-2 flex-1 px-4">
          <Search size={15} className="text-text-muted shrink-0" />
          <input
            type="text"
            name="q"
            aria-label={tab.placeholder}
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
            name={cityParam}
            aria-label={uiText("creators.filterCity")}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={uiText("creators.filterCity")}
            className="w-full py-4 text-sm bg-transparent focus:outline-none placeholder:text-text-muted text-text-primary"
          />
        </div>

        {/* Button */}
        <button
          type="submit"
          aria-label={uiText("home.heroSearchAction")}
          className="m-1 min-h-11 min-w-11 shrink-0 flex items-center justify-center gap-1.5 rounded-lg bg-gold px-3.5 text-sm font-bold text-bg-primary transition-colors hover:bg-gold-light sm:px-4"
        >{uiText.rich("Ui.text_43abcbcce10e6d", { part1: () => (<Search size={15} className="sm:w-3.5 sm:h-3.5" />), part2: chunks => (<span className="hidden sm:inline">{chunks}</span>) })}</button>
      </form>
    </div>
  );
}
