"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Search, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";

function getLocalizedTabs(translate: (key: string) => string) {
  return ([
  { id: "all", label: translate("UnifiedSearch.tab"), placeholder: translate("UnifiedSearch.placeholder"), href: "/search" },
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
  const { isLoaded, userId } = useAuth();
  const [activeTab, setActiveTab] = useState("locations");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [memberHintOpen, setMemberHintOpen] = useState(false);
  const smartButton = useRef<HTMLButtonElement>(null);
  const memberHintId = useId();
  const canUseSmart = isLoaded && !!userId;
  const showMemberHint = memberHintOpen && !canUseSmart;

  useEffect(() => {
    if (!showMemberHint) return;
    const dismissOutside = (event: Event) => {
      if (!smartButton.current?.contains(event.target as Node)) setMemberHintOpen(false);
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMemberHintOpen(false);
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [showMemberHint]);

  const tab = tabs.find((t) => t.id === activeTab)!;
  const cityParam = "cityText";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === "all" && !canUseSmart) {
      setMemberHintOpen(true);
      return;
    }
    const params = new URLSearchParams();
    if (activeTab === "all") params.set("smart", "1");
    if (query.trim()) params.set("q", query.trim());
    if (activeTab !== "all" && city.trim()) params.set(cityParam, city.trim());
    const qs = params.toString();
    router.push(`${tab.href}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="w-full rounded-2xl border border-border bg-bg-primary/85 p-2 shadow-lg shadow-black/15 sm:p-3">
      <div className="relative">
        {showMemberHint && <div id={memberHintId} role="status" className="pointer-events-none motion-safe:animate-[fadeIn_150ms_ease-out] absolute bottom-full left-0 z-20 mb-2 max-w-full rounded-xl border border-border bg-bg-secondary px-3 py-2 text-xs font-medium text-text-primary shadow-lg shadow-black/15 after:absolute after:-bottom-1 after:left-6 after:size-2 after:rotate-45 after:border-r after:border-b after:border-border after:bg-bg-secondary">
          {uiText(isLoaded ? "UnifiedSearch.membersOnly" : "common.loading")}
        </div>}
        <div role="group" aria-label={uiText("home.heroSearchAction")} className="mb-2 flex flex-nowrap overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              ref={t.id === "all" ? smartButton : undefined}
              aria-pressed={activeTab === t.id}
              aria-describedby={t.id === "all" && showMemberHint ? memberHintId : undefined}
              onClick={(event) => {
                if (t.id === "all" && !canUseSmart) {
                  setMemberHintOpen(open => !open);
                  return;
                }
                setMemberHintOpen(false);
                setActiveTab(t.id);
                event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
              }}
              className={`relative min-h-11 min-w-11 shrink-0 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:px-3 ${
                activeTab === t.id
                  ? "bg-gold-subtle text-gold after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-gold"
                  : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search bar */}
      <form
        onSubmit={handleSearch}
        action={tab.href}
        method="get"
        className="flex min-h-[52px] items-center overflow-hidden rounded-xl border border-border bg-bg-secondary shadow-sm transition-colors focus-within:border-gold"
      >
        {activeTab === "all" && <input type="hidden" name="smart" value="1" />}
        {/* Query */}
        <div className="flex items-center gap-2 flex-1 px-4">
          <Search size={15} className="text-text-muted shrink-0" />
          <input
            type="text"
            name="q"
            maxLength={2000}
            aria-label={tab.placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab.placeholder}
            className="w-full py-3.5 sm:py-4 text-sm bg-transparent focus:outline-none placeholder:text-text-muted text-text-primary min-w-0 font-medium"
          />
        </div>

        {/* City — hidden on mobile */}
        {activeTab !== "all" && <div className="hidden sm:flex items-center gap-2 px-4 w-40 border-l border-border/60">
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
        </div>}

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
