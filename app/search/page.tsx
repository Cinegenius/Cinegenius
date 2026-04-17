"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search, X, MapPin, Car, Package, Briefcase, Users, User,
  Loader2, ArrowRight, SlidersHorizontal, ChevronDown, Star,
  Building2, Film, Filter,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Result = {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  price: number;
  image: string | null;
  available: boolean | null;
};

// ─── Config ────────────────────────────────────────────────────────────────────

const typeConfig: Record<string, {
  label: string;
  pluralLabel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  href: (id: string) => string;
  color: string;
  bgColor: string;
}> = {
  profile:  { label: "Crew",        pluralLabel: "Crew",        icon: User,      href: (id) => `/creators/${id}`,  color: "text-gold",          bgColor: "bg-gold/10 border-gold/20"      },
  creator:  { label: "Crew",        pluralLabel: "Crew",        icon: Users,     href: (id) => `/creators/${id}`,  color: "text-gold",          bgColor: "bg-gold/10 border-gold/20"      },
  location: { label: "Drehort",     pluralLabel: "Drehorte",    icon: MapPin,    href: (id) => `/locations/${id}`, color: "text-sky-400",        bgColor: "bg-sky-500/10 border-sky-500/20"   },
  vehicle:  { label: "Fahrzeug",    pluralLabel: "Fahrzeuge",   icon: Car,       href: (id) => `/vehicles/${id}`,  color: "text-orange-400",    bgColor: "bg-orange-500/10 border-orange-500/20" },
  prop:     { label: "Requisite",   pluralLabel: "Requisiten",  icon: Package,   href: (id) => `/props/${id}`,     color: "text-violet-400",    bgColor: "bg-violet-500/10 border-violet-500/20" },
  job:      { label: "Job",         pluralLabel: "Jobs",        icon: Briefcase, href: (id) => `/jobs/${id}`,      color: "text-emerald-400",   bgColor: "bg-emerald-500/10 border-emerald-500/20" },
  company:  { label: "Firma",       pluralLabel: "Firmen",      icon: Building2, href: (id) => `/companies/${id}`, color: "text-blue-400",      bgColor: "bg-blue-500/10 border-blue-500/20" },
};

const TABS = [
  { id: "all",      label: "Alle",       icon: Search   },
  { id: "profile",  label: "Crew",       icon: Users    },
  { id: "location", label: "Drehorte",   icon: MapPin   },
  { id: "job",      label: "Jobs",       icon: Briefcase },
  { id: "vehicle",  label: "Fahrzeuge",  icon: Car      },
  { id: "prop",     label: "Requisiten", icon: Package  },
  { id: "company",  label: "Firmen",     icon: Building2 },
] as const;

// ─── Suggestion chips ──────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Kameramann",
  "Warehouse Berlin",
  "Oldtimer 1960s",
  "Regie Kurzfilm",
  "Studio München",
  "Schauspieler gesucht",
  "Drohnen Pilot",
  "Fotostudio Hamburg",
];

// ─── Result Card ───────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: Result }) {
  const cfg = typeConfig[result.type];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const isProfile = result.type === "profile" || result.type === "creator";

  return (
    <Link
      href={cfg.href(result.id)}
      className="group flex flex-col bg-bg-secondary border border-border rounded-xl overflow-hidden hover:border-gold/40 transition-all hover:shadow-lg hover:shadow-black/20"
    >
      {/* Image */}
      <div className="relative aspect-video bg-bg-elevated overflow-hidden">
        {result.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.image}
            alt={result.title}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${isProfile ? "object-top" : "object-center"}`}
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center border ${cfg.bgColor}`}>
            <Icon size={32} className={`${cfg.color} opacity-40`} />
          </div>
        )}
        {/* Type badge */}
        <div className={`absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold border backdrop-blur-sm ${cfg.bgColor}`}>
          <Icon size={10} className={cfg.color} />
          <span className={cfg.color}>{cfg.label}</span>
        </div>
        {/* Availability dot for profiles */}
        {isProfile && result.available !== null && (
          <div className={`absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full border-2 border-bg-secondary ${result.available ? "bg-success" : "bg-text-muted"}`}
            title={result.available ? "Verfügbar" : "Gebucht"} />
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-sm text-text-primary mb-1 leading-tight line-clamp-2 group-hover:text-gold transition-colors">
          {result.title}
        </h3>
        <p className="text-xs text-text-muted line-clamp-1 flex-1">{result.subtitle}</p>
        {!isProfile && result.price > 0 && (
          <p className="mt-2 text-sm font-semibold font-mono text-gold">
            {result.price.toLocaleString("de-DE")} €<span className="text-text-muted font-sans font-normal text-xs">/Tag</span>
          </p>
        )}
        {isProfile && (
          <div className="mt-2 flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${result.available ? "bg-success" : "bg-text-muted"}`} />
            <span className="text-xs text-text-muted">{result.available ? "Verfügbar" : "Derzeit gebucht"}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center mb-4">
        <Search size={24} className="text-text-muted" />
      </div>
      <h3 className="font-display text-lg font-bold text-text-primary mb-2">
        {query ? `Keine Ergebnisse für „${query}"` : "Womit soll ich suchen?"}
      </h3>
      <p className="text-sm text-text-muted max-w-xs leading-relaxed">
        {query
          ? "Versuche einen anderen Begriff, eine Stadt oder eine Kategorie."
          : "Tippe einen Suchbegriff oben ein — Crew, Drehorte, Jobs, Requisiten oder Fahrzeuge."}
      </p>
    </div>
  );
}

// ─── Main Search Content ───────────────────────────────────────────────────────

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialQ = searchParams.get("q") ?? "";
  const initialType = searchParams.get("type") ?? "all";

  const [query, setQuery] = useState(initialQ);
  const [inputValue, setInputValue] = useState(initialQ);
  const [activeTab, setActiveTab] = useState(initialType);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!initialQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (q: string, tab?: string) => {
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    setHasSearched(true);
    const t = tab ?? activeTab;
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}${t !== "all" ? `&type=${t}` : ""}`);
      const { results: data } = await res.json();
      setResults(data ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Run initial search if query from URL
  useEffect(() => {
    if (initialQ) doSearch(initialQ);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search on input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!inputValue.trim()) {
      setResults([]);
      setQuery("");
      setHasSearched(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      setQuery(inputValue.trim());
      doSearch(inputValue.trim());
      // Update URL
      const params = new URLSearchParams();
      if (inputValue.trim()) params.set("q", inputValue.trim());
      if (activeTab !== "all") params.set("type", activeTab);
      router.replace(`/search?${params.toString()}`, { scroll: false });
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]);

  // Re-search and update URL on tab change
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (activeTab !== "all") params.set("type", activeTab);
    router.replace(`/search?${params.toString()}`, { scroll: false });
    if (query.length >= 2) doSearch(query, activeTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Filter by active tab
  const filtered = activeTab === "all"
    ? results
    : results.filter((r) => {
        if (activeTab === "profile") return r.type === "profile" || r.type === "creator";
        return r.type === activeTab;
      });

  // Count per tab
  const countFor = (tabId: string) => {
    if (tabId === "all") return results.length;
    if (tabId === "profile") return results.filter((r) => r.type === "profile" || r.type === "creator").length;
    return results.filter((r) => r.type === tabId).length;
  };

  return (
    <div className="pt-16 min-h-screen">
      {/* ── Header / Search bar ── */}
      <div className="bg-bg-secondary border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-2">
            <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">Suche</p>
            <h1 className="font-display text-3xl font-bold text-text-primary">
              {query ? <>Ergebnisse für <span className="text-gradient-gold">„{query}"</span></> : "Alles durchsuchen"}
            </h1>
          </div>

          {/* Search input */}
          <div className="relative mt-5">
            {loading
              ? <Loader2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gold animate-spin" />
              : <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
            }
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && inputValue.trim()) {
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  setQuery(inputValue.trim());
                  doSearch(inputValue.trim());
                }
              }}
              placeholder="Crew, Drehorte, Jobs, Requisiten, Fahrzeuge…"
              className="w-full pl-11 pr-12 py-3.5 bg-bg-elevated border border-border rounded-xl text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors"
              autoFocus={!initialQ}
            />
            {inputValue && (
              <button
                onClick={() => { setInputValue(""); setResults([]); setHasSearched(false); inputRef.current?.focus(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-gold transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Suggestion chips — only when empty */}
          {!inputValue && (
            <div className="flex flex-wrap gap-2 mt-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInputValue(s); doSearch(s); setQuery(s); setHasSearched(true); }}
                  className="px-3 py-1.5 text-xs border border-border text-text-secondary rounded-full hover:border-gold/50 hover:text-gold transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Category Tabs ── */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto pb-px no-scrollbar">
            {TABS.map(({ id, label, icon: Icon }) => {
              const count = countFor(id);
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                    isActive
                      ? "border-gold text-gold"
                      : "border-transparent text-text-muted hover:text-text-secondary"
                  }`}
                >
                  <Icon size={13} />
                  {label}
                  {results.length > 0 && count > 0 && (
                    <span className={`ml-0.5 text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-gold/15 text-gold" : "bg-bg-elevated text-text-muted"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Results ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-text-muted">
              <Loader2 size={20} className="animate-spin text-gold" />
              <span className="text-sm">Suche läuft…</span>
            </div>
          </div>
        )}

        {!loading && !hasSearched && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-10 max-w-lg mx-auto">
              {Object.entries(typeConfig).filter(([k]) => k !== "creator").map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <Link
                    key={key}
                    href={cfg.href("").replace("/", "") || "#"}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border ${cfg.bgColor} hover:scale-105 transition-transform`}
                  >
                    <Icon size={18} className={cfg.color} />
                    <span className={`text-[10px] font-medium ${cfg.color}`}>{cfg.pluralLabel}</span>
                  </Link>
                );
              })}
            </div>
            <p className="text-sm text-text-muted">Gib oben einen Suchbegriff ein oder klicke auf eine Kategorie.</p>
          </div>
        )}

        {!loading && hasSearched && filtered.length === 0 && (
          <EmptyState query={query} />
        )}

        {!loading && filtered.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-text-muted">
                <span className="font-semibold text-text-primary">{filtered.length}</span>{" "}
                Ergebnis{filtered.length !== 1 ? "se" : ""}
                {activeTab !== "all" && ` in ${TABS.find((t) => t.id === activeTab)?.label}`}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.map((r) => (
                <ResultCard key={`${r.type}-${r.id}`} result={r} />
              ))}
            </div>

            {/* Quick links to category pages */}
            {query && (
              <div className="mt-10 pt-8 border-t border-border">
                <p className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-4">Erweiterte Suche in Kategorie</p>
                <div className="flex flex-wrap gap-3">
                  {[
                    { href: `/creators?q=${encodeURIComponent(query)}`, label: "Alle Crew-Mitglieder", icon: Users },
                    { href: `/locations?q=${encodeURIComponent(query)}`, label: "Alle Drehorte", icon: MapPin },
                    { href: `/jobs?q=${encodeURIComponent(query)}`, label: "Alle Jobs", icon: Briefcase },
                    { href: `/props?q=${encodeURIComponent(query)}`, label: "Alle Requisiten", icon: Package },
                    { href: `/vehicles?q=${encodeURIComponent(query)}`, label: "Alle Fahrzeuge", icon: Car },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-medium border border-border rounded-lg text-text-secondary hover:border-gold/40 hover:text-gold transition-all"
                    >
                      <Icon size={13} /> {label} <ArrowRight size={11} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="pt-32 flex items-center justify-center min-h-screen">
        <Loader2 size={24} className="animate-spin text-gold" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
