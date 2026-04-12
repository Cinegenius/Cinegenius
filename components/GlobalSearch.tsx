"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, X, MapPin, Car, Package, Briefcase, Users,
  Loader2, Clock, ArrowRight, User,
} from "lucide-react";

type Result = {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  price: number;
  image: string | null;
  available: boolean | null;
};

const typeConfig: Record<string, {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  href: (id: string) => string;
  color: string;
}> = {
  location: { label: "Drehorte",        icon: MapPin,    href: (id) => `/locations/${id}`,  color: "text-sky-400"     },
  vehicle:  { label: "Fahrzeuge",        icon: Car,       href: (id) => `/vehicles/${id}`,   color: "text-orange-400"  },
  prop:     { label: "Requisiten",       icon: Package,   href: (id) => `/props/${id}`,      color: "text-violet-400"  },
  job:      { label: "Jobs",             icon: Briefcase, href: (id) => `/jobs/${id}`,       color: "text-emerald-400" },
  creator:  { label: "Filmschaffende",   icon: Users,     href: (id) => `/creators/${id}`,   color: "text-gold"        },
  profile:  { label: "Filmschaffende",   icon: User,      href: (id) => `/creators/${id}`,   color: "text-gold"        },
};

// Type order for display
const TYPE_ORDER = ["profile", "creator", "job", "location", "vehicle", "prop"];

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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(true); }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setRecent(getRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setSelectedIdx(-1);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const { results: data } = await res.json();
      setResults(data ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => search(query), 220);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

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
        router.push(`/creators?q=${encodeURIComponent(query.trim())}`);
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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted border border-border rounded-lg hover:border-gold/50 hover:text-gold transition-all bg-bg-elevated/50 group"
        title="Suchen (⌘K)"
      >
        <Search size={14} />
        <span className="hidden xl:inline text-xs">Suchen…</span>
        <kbd className="hidden xl:inline text-[10px] px-1.5 py-0.5 bg-bg-primary border border-border rounded text-text-muted group-hover:border-gold/30 transition-colors">⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-2xl bg-bg-elevated border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          {loading
            ? <Loader2 size={18} className="text-gold shrink-0 animate-spin" />
            : <Search size={18} className="text-text-muted shrink-0" />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(-1); }}
            onKeyDown={handleKeyDown}
            placeholder="Nutzer, Drehorte, Crew, Requisiten, Jobs…"
            className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted text-base focus:outline-none"
          />
          <div className="flex items-center gap-2 shrink-0">
            {query && (
              <button onClick={() => setQuery("")} className="text-text-muted hover:text-gold transition-colors">
                <X size={16} />
              </button>
            )}
            <kbd className="text-[10px] px-1.5 py-0.5 bg-bg-secondary border border-border rounded text-text-muted">Esc</kbd>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[440px] overflow-y-auto">

          {/* Recent searches */}
          {!query && recent.length > 0 && (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">Letzte Suchen</p>
                <button onClick={() => { clearRecentSearches(); setRecent([]); }} className="text-[10px] text-text-muted hover:text-gold transition-colors">
                  Löschen
                </button>
              </div>
              <div className="space-y-0.5">
                {recent.map((r) => (
                  <button key={r} onClick={() => setQuery(r)}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-bg-secondary transition-colors text-left">
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
              <p className="text-xs text-text-muted">Nutzer, Drehorte, Crew, Requisiten und Jobs durchsuchen</p>
              <div className="flex flex-wrap justify-center gap-2">
                {["Kameramann", "Warehouse Berlin", "Oldtimer", "Regie gesucht"].map((term) => (
                  <button key={term} onClick={() => setQuery(term)}
                    className="px-3 py-1.5 text-xs border border-border rounded-full text-text-secondary hover:border-gold hover:text-gold transition-all">
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No results */}
          {query.length >= 2 && !loading && results.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-text-muted text-sm">Keine Ergebnisse für „{query}"</p>
              <p className="text-xs text-text-muted mt-1 opacity-70">Versuche einen anderen Namen oder Begriff</p>
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
                  return (
                    <button
                      key={r.id}
                      onClick={() => navigate(r)}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 transition-colors text-left ${
                        isSelected ? "bg-gold/10" : "hover:bg-bg-secondary"
                      }`}
                    >
                      {r.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.image} alt=""
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
                          <span className={`w-2 h-2 rounded-full ${r.available ? "bg-success" : "bg-text-muted"}`} title={r.available ? "Verfügbar" : "Gebucht"} />
                        )}
                        {!isProfile && r.price > 0 && (
                          <span className="text-xs font-mono text-gold">{r.price.toLocaleString()} €</span>
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
              <p className="text-xs text-text-muted">{results.length} Ergebnis{results.length !== 1 ? "se" : ""}</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { addRecentSearch(query); setOpen(false); router.push(`/creators?q=${encodeURIComponent(query.trim())}`); }}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-gold transition-colors"
                >
                  Crew <ArrowRight size={10} />
                </button>
                <button
                  onClick={() => { addRecentSearch(query); setOpen(false); router.push(`/locations?q=${encodeURIComponent(query.trim())}`); }}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-gold transition-colors"
                >
                  Drehorte <ArrowRight size={10} />
                </button>
                <button
                  onClick={() => { addRecentSearch(query); setOpen(false); router.push(`/jobs?q=${encodeURIComponent(query.trim())}`); }}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-gold transition-colors"
                >
                  Jobs <ArrowRight size={10} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
