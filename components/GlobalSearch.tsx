"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations , useLocale } from "next-intl";
import {
  Search, X, MapPin, Car, Package, Briefcase, Users,
  Loader2, Clock, ArrowRight, User, Building2, PawPrint,
} from "lucide-react";
import MediaImage from "@/components/MediaImage";
import ListingImage from "@/components/ListingImage";
import MessagingDialog from "@/components/messaging/MessagingDialog";

type Result = {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  price: number;
  priceLabel?: string;
  image: string | null;
  available: boolean | null;
};

// Type order for display
const TYPE_ORDER = ["profile", "creator", "job", "location", "vehicle", "prop", "company", "animal"];

const RECENT_KEY = "cg_recent_searches";
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; }
}
function addRecentSearch(q: string) {
  const prev = getRecentSearches().filter((s) => s !== q);
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
}
function clearRecentSearches() {
  localStorage.removeItem(RECENT_KEY);
}

export default function GlobalSearch() {
  const uiText = useTranslations();
  const uiLocale = useLocale();

  const t = useTranslations("search");
  const animals = useTranslations("FilmAnimals");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const typeConfig: Record<string, {
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    href: (id: string) => string;
    color: string;
  }> = {
    location: { label: t("typeLocations"), icon: MapPin,    href: (id) => `/locations/${id}`,  color: "text-sky-400"     },
    vehicle:  { label: t("typeVehicles"),  icon: Car,       href: (id) => `/vehicles/${id}`,   color: "text-orange-400"  },
    prop:     { label: t("typeProps"),     icon: Package,   href: (id) => `/props/${id}`,      color: "text-violet-400"  },
    job:      { label: t("typeJobs"),      icon: Briefcase, href: (id) => `/jobs/${id}`,       color: "text-emerald-400" },
    creator:  { label: t("typeCreators"), icon: Users,     href: (id) => `/profile/${id}`,    color: "text-gold"        },
    profile:  { label: t("typeCreators"), icon: User,      href: (id) => `/profile/${id}`,    color: "text-gold"        },
    animal: {label: animals("portfolio"), icon: PawPrint, href: id => `/tiere/${id}`, color: "text-amber-400"},
    company:  { label: t("typeCompanies"),icon: Building2, href: (id) => `/companies/${id}`,  color: "text-blue-400"    },
  };

  // Cmd+K / Ctrl+K + custom event from mobile nav button
  useEffect(() => {
    const openFromEvent = () => {
      setQuery(""); setResults([]); setSelectedIdx(-1);
      setFailed(false); setLoading(false); setRecent(getRecentSearches()); setOpen(true);
    };
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); openFromEvent(); }
    };
    document.addEventListener("keydown", handler);
    document.addEventListener("cg:opensearch", openFromEvent);
    return () => {
      document.removeEventListener("keydown", handler);
      document.removeEventListener("cg:opensearch", openFromEvent);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

  function updateQuery(value: string) {
    setQuery(value); setResults([]); setFailed(false); setSelectedIdx(-1);
    setLoading(value.trim().length >= 2);
  }

  useEffect(() => {
    if (!open || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Search unavailable");
        const { results: data } = await res.json();
        if (!controller.signal.aborted) setResults(Array.isArray(data) ? data : []);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, open, attempt]);

  const navigate = (result: Result) => {
    const config = typeConfig[result.type];
    if (!config) return;
    addRecentSearch(query || result.title);
    setOpen(false);
    router.push(config.href(result.id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (selectedIdx >= 0 && results[selectedIdx]) {
        navigate(results[selectedIdx]);
      } else if (query.trim()) {
        addRecentSearch(query);
        setOpen(false);
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
  };

  // Group by type, sorted by TYPE_ORDER
  const grouped = TYPE_ORDER.reduce<Record<string, Result[]>>((acc, t) => {
    const items = results.filter((r) => r.type === t);
    if (items.length) acc[t] = items;
    return acc;
  }, {});
  // Remaining types not in TYPE_ORDER
  results.forEach((r) => {
    if (!TYPE_ORDER.includes(r.type) && typeConfig[r.type]) {
      if (!grouped[r.type]) grouped[r.type] = [];
      if (!grouped[r.type].includes(r)) grouped[r.type].push(r);
    }
  });

  if (!open) return null;

  return (
    <MessagingDialog open={open} title={t("accessibleLabel")} onClose={() => setOpen(false)} compact>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          {loading
            ? <Loader2 size={18} className="text-gold shrink-0 animate-spin" />
            : <Search size={18} className="text-text-muted shrink-0" />
          }
          <input
            aria-label={t("accessibleLabel")}
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { updateQuery(e.target.value); }}
            onKeyDown={handleKeyDown}
            placeholder={t("inputPlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-text-primary placeholder:text-text-muted text-base focus:outline-none"
          />
          <div className="flex items-center gap-2 shrink-0">{uiText.rich("Ui.text_0633df8995bbb3", { value1: () => (query && (
              <button type="button" aria-label={t("clearSearch")} onClick={() => {updateQuery(""); inputRef.current?.focus();}} className="min-h-11 min-w-11 flex items-center justify-center text-text-muted hover:text-gold transition-colors">
                <X size={16} />
              </button>
            )), part2: chunks => (<kbd className="text-[10px] px-1.5 py-0.5 bg-bg-secondary border border-border rounded text-text-muted">{chunks}</kbd>) })}</div>
        </div>

        {/* Results */}
        <div>

          {/* Recent searches */}
          {!query && recent.length > 0 && (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">{t("recent")}</p>
                <button onClick={() => { clearRecentSearches(); setRecent([]); }} className="min-h-11 min-w-11 text-[10px] text-text-muted hover:text-gold transition-colors">
                  {t("clear")}
                </button>
              </div>
              <div className="space-y-0.5">
                {recent.map((r) => (
                  <button key={r} onClick={() => updateQuery(r)}
                    className="flex min-h-11 items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-bg-secondary transition-colors text-left">
                    <Clock size={13} className="text-text-muted shrink-0" />
                    <span className="text-sm text-text-secondary">{r}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty suggestion chips */}
          {!query && recent.length === 0 && (
            <div className="px-4 py-8 text-center space-y-4">
              <p className="text-xs text-text-muted">{t("hint")}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[t("suggestion1"), t("suggestion2"), t("suggestion3"), t("suggestion4")].map((term) => (
                  <button key={term} onClick={() => updateQuery(term)}
                    className="min-h-11 min-w-11 px-3 py-1.5 text-xs border border-border rounded-full text-text-secondary hover:border-gold hover:text-gold transition-all">
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {failed && <div role="alert" className="p-4 text-sm text-text-secondary">
            <p>{t("loadError")}</p>
            <button type="button" onClick={() => { setFailed(false); setLoading(true); setAttempt(value => value + 1); }} className="mt-2 min-h-11 rounded-lg border border-border px-3 text-gold">{t("retry")}</button>
          </div>}

          {/* No results */}
          {query.length >= 2 && !loading && !failed && results.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-text-muted text-sm">{t("noResults", { query })}</p>
              <p className="text-xs text-text-muted mt-1 opacity-70">{t("noResultsHint")}</p>
            </div>
          )}

          {/* Grouped results */}
          {Object.entries(grouped).map(([type, items]) => {
            const config = typeConfig[type];
            if (!config) return null;
            const Icon = config.icon;
            return (
              <div key={type}>
                <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                  <Icon size={11} className={config.color} />
                  <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">
                    {config.label}
                  </p>
                </div>
                {items.map((r) => {
                  const globalIdx = results.indexOf(r);
                  const isSelected = selectedIdx === globalIdx;
                  const isProfile = r.type === "profile" || r.type === "creator";
                  const PreviewImage = ["location", "vehicle", "prop", "animal"].includes(r.type) ? ListingImage : MediaImage;
                  return (
                    <button
                      key={r.id}
                      onClick={() => navigate(r)}
                      className={`flex min-h-11 items-center gap-3 w-full px-4 py-2.5 transition-colors text-left ${
                        isSelected ? "bg-gold/10" : "hover:bg-bg-secondary"
                      }`}
                    >
                      {r.image ? (
                        <PreviewImage src={r.image} alt="" width={36} height={36} mediaSize="thumbnail"
                          className={`w-9 h-9 object-cover shrink-0 border border-border ${isProfile ? "rounded-full" : "rounded-lg"}`}
                        />
                      ) : (
                        <div className={`w-9 h-9 bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 ${isProfile ? "rounded-full" : "rounded-lg"}`}>
                          <Icon size={14} className={config.color} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{r.title}</p>
                        <p className="text-xs text-text-muted truncate">{r.subtitle}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isProfile && r.available !== null && (
                          <span className={`w-2 h-2 rounded-full ${r.available ? "bg-success" : "bg-text-muted"}`} />
                        )}
                        {!isProfile && r.type !== "animal" && (r.priceLabel || r.price > 0) && (
                          <span className="text-xs font-mono text-gold">{r.priceLabel ?? uiText("Ui.text_4a44946c8fc283", { value1: String(r.price.toLocaleString(uiLocale)) })}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}

          {/* Footer */}
          {query.length >= 2 && results.length > 0 && (
            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <p className="text-xs text-text-muted">{t("resultCount", { count: results.length })}</p>
              <button
                onClick={() => { addRecentSearch(query); setOpen(false); router.push(`/search?q=${encodeURIComponent(query.trim())}`); }}
                className="flex min-h-11 items-center gap-1.5 text-xs font-medium text-gold hover:text-gold-light transition-colors"
              >
                {t("viewAll")} <ArrowRight size={11} />
              </button>
            </div>
          )}
          {query.length >= 2 && results.length === 0 && !loading && (
            <div className="px-4 py-3 border-t border-border text-center">
              <button
                onClick={() => { setOpen(false); router.push(`/search?q=${encodeURIComponent(query.trim())}`); }}
                className="text-xs text-text-muted hover:text-gold transition-colors"
              >
                {t("openFull")} <ArrowRight size={10} className="inline" />
              </button>
            </div>
          )}
        </div>
    </MessagingDialog>
  );
}
