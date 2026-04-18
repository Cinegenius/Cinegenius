"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft, Clapperboard, CheckCircle, Loader2, X, Plus,
  Search, Building2, MapPin, Users,
} from "lucide-react";
import Link from "next/link";

const PROJECT_TYPES = [
  "Spielfilm", "Kurzfilm", "Serie", "Dokumentation", "Musikvideo",
  "Werbefilm / Commercial", "Corporate Film", "Event / Live", "Foto / Shooting",
  "Social Media Content", "Imagefilm", "Sonstiges",
];

type TypeConfig = {
  rolePlaceholder: string; directorLabel: string; directorPlaceholder: string;
  genreLabel: string; genrePlaceholder: string; locationLabel: string;
  locationPlaceholder: string; companyLabel: string; companyPlaceholder: string;
  linkPlaceholder: string; descPlaceholder: string; titlePlaceholder: string;
};

const TYPE_CONFIG: Record<string, TypeConfig> = {
  "Spielfilm": { rolePlaceholder: "z. B. Regisseur, Kameramann, Produzent", directorLabel: "Regie", directorPlaceholder: "Name des Regisseurs", genreLabel: "Genre", genrePlaceholder: "Drama, Thriller, Komödie …", locationLabel: "Drehort / Region", locationPlaceholder: "z. B. Berlin, Hamburg, Wien", companyLabel: "Produktionsfirma", companyPlaceholder: "z. B. X Filme, UFA", linkPlaceholder: "IMDb, Vimeo, YouTube …", descPlaceholder: "Worum geht es in diesem Film?", titlePlaceholder: "z. B. Der letzte Sommer" },
  "Kurzfilm": { rolePlaceholder: "z. B. Regisseur, Kameramann, Cutter", directorLabel: "Regie", directorPlaceholder: "Name des Regisseurs", genreLabel: "Genre", genrePlaceholder: "Drama, Komödie, Horror …", locationLabel: "Drehort / Region", locationPlaceholder: "z. B. München, Leipzig", companyLabel: "Hochschule / Produktionsfirma", companyPlaceholder: "z. B. HFF München, unabhängig", linkPlaceholder: "Vimeo, YouTube, Kurzfilmtage …", descPlaceholder: "Worum geht es in diesem Kurzfilm?", titlePlaceholder: "z. B. Stille Wasser" },
  "Serie": { rolePlaceholder: "z. B. Regisseur, Showrunner, DOP", directorLabel: "Regie / Showrunner", directorPlaceholder: "Name des Showrunners oder Regisseurs", genreLabel: "Genre", genrePlaceholder: "Drama, Krimi, Comedy …", locationLabel: "Drehort / Region", locationPlaceholder: "z. B. Köln, Berlin, Wien", companyLabel: "Produktionsfirma / Sender", companyPlaceholder: "z. B. Wiedemann & Berg, ARD", linkPlaceholder: "IMDb, Streaming-Link …", descPlaceholder: "Worum geht es in dieser Serie?", titlePlaceholder: "z. B. Dark Horizons" },
  "Dokumentation": { rolePlaceholder: "z. B. Regisseur, Kameramann, Cutter", directorLabel: "Regie", directorPlaceholder: "Name des Regisseurs", genreLabel: "Thema", genrePlaceholder: "Gesellschaft, Natur, Geschichte, Sport …", locationLabel: "Drehort / Region", locationPlaceholder: "z. B. weltweit, DACH, Berlin", companyLabel: "Produktionsfirma / Sender", companyPlaceholder: "z. B. NDR, ZDF, unabhängig", linkPlaceholder: "Mediathek, Vimeo, YouTube …", descPlaceholder: "Was ist das Thema dieser Dokumentation?", titlePlaceholder: "z. B. Am Rande der Welt" },
  "Musikvideo": { rolePlaceholder: "z. B. Regisseur, Kameramann, Colorist", directorLabel: "Regie", directorPlaceholder: "Name des Regisseurs", genreLabel: "Musikgenre", genrePlaceholder: "Pop, Hip-Hop, Rock, Electronic …", locationLabel: "Drehort / Region", locationPlaceholder: "z. B. Berlin, Studio, On Location", companyLabel: "Label / Künstler", companyPlaceholder: "z. B. Universal, Sony, Indie", linkPlaceholder: "YouTube, Vimeo, Spotify …", descPlaceholder: "Für welchen Künstler und Song wurde das Video gedreht?", titlePlaceholder: "z. B. Midnight Run – Max Mustermann" },
  "Werbefilm / Commercial": { rolePlaceholder: "z. B. Regisseur, Kameramann, Art Director", directorLabel: "Regie", directorPlaceholder: "Name des Regisseurs", genreLabel: "Format", genrePlaceholder: "TV-Spot, Online-Ad, Imagefilm, Product …", locationLabel: "Drehort / Region", locationPlaceholder: "z. B. Studio Berlin, München", companyLabel: "Agentur / Auftraggeber", companyPlaceholder: "z. B. BBDO, Jung von Matt, Markenname", linkPlaceholder: "YouTube, Vimeo, Agentur-Link …", descPlaceholder: "Für welches Produkt oder welche Marke wurde der Spot gedreht?", titlePlaceholder: "z. B. BMW Frühjahrs-Kampagne 2024" },
  "Corporate Film": { rolePlaceholder: "z. B. Kameramann, Produzent, Cutter", directorLabel: "Projektleitung", directorPlaceholder: "Verantwortliche Person oder Agentur", genreLabel: "Art des Films", genrePlaceholder: "Imagefilm, Employer Branding, Erklärfilm …", locationLabel: "Drehort / Unternehmen", locationPlaceholder: "z. B. Frankfurt, Hamburg, On Location", companyLabel: "Auftraggeber / Unternehmen", companyPlaceholder: "z. B. Siemens AG, Startup GmbH", linkPlaceholder: "Unternehmenswebsite, Vimeo, YouTube …", descPlaceholder: "Welches Unternehmen wurde porträtiert und was war das Ziel?", titlePlaceholder: "z. B. Imagefilm Muster GmbH" },
  "Event / Live": { rolePlaceholder: "z. B. Hochzeitsfilmer, Hochzeitsfotograf, Stylist, Kameramann, Live-Cutter, Tonmeister", directorLabel: "Veranstaltungsort / Location", directorPlaceholder: "z. B. Schloss Elmau, Olympiastadion, Messe Hamburg", genreLabel: "Art des Events", genrePlaceholder: "Hochzeit, Konzert, Festival, Konferenz, Standesamt, Feier …", locationLabel: "Stadt / Region", locationPlaceholder: "z. B. Berlin, München, Wien", companyLabel: "Veranstalter / Auftraggeber", companyPlaceholder: "z. B. Brautpaar, Live Nation, Eventfirma", linkPlaceholder: "YouTube, Instagram, Event-Website …", descPlaceholder: "Welches Event wurde gefilmt? Bei einer Hochzeit: Wo, wann, was war besonders?", titlePlaceholder: "z. B. Hochzeit Müller – Schloss Elmau 2024" },
  "Foto / Shooting": { rolePlaceholder: "z. B. Fotograf, Art Director, Stylist", directorLabel: "Art Direction", directorPlaceholder: "Name des Art Directors oder Stylisten", genreLabel: "Art des Shootings", genrePlaceholder: "Fashion, Portrait, Editorial, Werbung, Beauty …", locationLabel: "Location / Studio", locationPlaceholder: "z. B. Studio Berlin, On Location, Paris", companyLabel: "Agentur / Auftraggeber", companyPlaceholder: "z. B. Magazin, Marke, Modelagentur", linkPlaceholder: "Portfolio, Instagram, Behance …", descPlaceholder: "Worum ging es bei diesem Shooting? Wer war involviert?", titlePlaceholder: "z. B. Editorial Vogue DE Herbst 2024" },
  "Social Media Content": { rolePlaceholder: "z. B. Creator, Videograf, Editor", directorLabel: "Plattform / Kanal", directorPlaceholder: "z. B. @username auf TikTok, YouTube-Kanal", genreLabel: "Content-Art", genrePlaceholder: "TikTok, Reels, YouTube, Podcast, Story …", locationLabel: "Drehort / Setting", locationPlaceholder: "z. B. Homeoffice, On Location, Studio", companyLabel: "Brand Deal / Auftraggeber", companyPlaceholder: "z. B. Nike, eigener Kanal", linkPlaceholder: "TikTok, YouTube, Instagram …", descPlaceholder: "Was ist das Thema dieses Projekts? Für welche Plattform?", titlePlaceholder: "z. B. Travel-Serie Südostasien" },
  "Imagefilm": { rolePlaceholder: "z. B. Regisseur, Kameramann, Produzent", directorLabel: "Regie / Projektleitung", directorPlaceholder: "Verantwortliche Person", genreLabel: "Zielgruppe / Format", genrePlaceholder: "B2B, Employer Branding, Produktvideo …", locationLabel: "Drehort / Region", locationPlaceholder: "z. B. Köln, Hamburg, Zürich", companyLabel: "Auftraggeber", companyPlaceholder: "z. B. Unternehmensname, Agentur", linkPlaceholder: "Vimeo, Unternehmenswebsite …", descPlaceholder: "Welches Unternehmen oder Produkt wurde präsentiert?", titlePlaceholder: "z. B. Imagevideo Musterfirma AG" },
  "Sonstiges": { rolePlaceholder: "z. B. Regisseur, Kameramann, Produzent", directorLabel: "Regie / Verantwortlich", directorPlaceholder: "Name der verantwortlichen Person", genreLabel: "Kategorie / Thema", genrePlaceholder: "Beliebige Kategorie", locationLabel: "Drehort / Region", locationPlaceholder: "z. B. Berlin, Wien, Zürich", companyLabel: "Auftraggeber / Firma", companyPlaceholder: "Auftraggeber oder Produktionsfirma", linkPlaceholder: "Website, YouTube, Vimeo …", descPlaceholder: "Beschreib dein Projekt.", titlePlaceholder: "Projekttitel eingeben" },
};

const DEFAULT_CONFIG: TypeConfig = TYPE_CONFIG["Spielfilm"];

// ── Linked item types ─────────────────────────────────────────────
type LinkedItem = { id?: string; name: string; subtitle?: string };
type CrewEntry  = { name: string; role: string };

// ── Generic searchable linker ─────────────────────────────────────
function LinkedSearch({
  label, icon: Icon, placeholder, items, onAdd, onRemove, onSearch, searchResults, searching,
}: {
  label: string;
  icon: React.ElementType;
  placeholder: string;
  items: LinkedItem[];
  onAdd: (item: LinkedItem) => void;
  onRemove: (idx: number) => void;
  onSearch: (q: string) => void;
  searchResults: LinkedItem[];
  searching: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function handleQuery(val: string) {
    setQ(val);
    setOpen(true);
    onSearch(val);
  }

  function addManual() {
    if (!q.trim()) return;
    onAdd({ name: q.trim() });
    setQ("");
    setOpen(false);
  }

  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
        <Icon size={11} /> {label}
      </label>

      {/* Added items */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {items.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gold/10 border border-gold/25 text-gold text-xs rounded-full font-medium">
              {item.name}
              {item.subtitle && <span className="text-gold/60">· {item.subtitle}</span>}
              <button type="button" onClick={() => onRemove(i)} className="hover:text-red-400 transition-colors">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div ref={ref} className="relative">
        <div className="flex items-center gap-2 bg-bg-elevated border border-border rounded-xl px-3 focus-within:border-gold/50 transition-colors">
          <Search size={13} className="text-text-muted shrink-0" />
          <input
            type="text"
            value={q}
            onChange={(e) => handleQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="flex-1 bg-transparent py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none"
          />
          {searching && <Loader2 size={12} className="text-text-muted animate-spin shrink-0" />}
          {q && (
            <button type="button" onClick={addManual}
              className="shrink-0 text-[11px] text-gold hover:text-gold-light font-semibold whitespace-nowrap">
              + Hinzufügen
            </button>
          )}
        </div>

        {open && (searchResults.length > 0) && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-bg-secondary border border-border rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto">
            {searchResults.map((r) => (
              <button key={r.id ?? r.name} type="button"
                onClick={() => { onAdd(r); setQ(""); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-elevated transition-colors text-left">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{r.name}</p>
                  {r.subtitle && <p className="text-xs text-text-muted truncate">{r.subtitle}</p>}
                </div>
                {r.id && <span className="text-[10px] text-gold/60 shrink-0">Verknüpfen</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Crew manual adder ─────────────────────────────────────────────
function CrewAdder({ crew, onChange }: { crew: CrewEntry[]; onChange: (c: CrewEntry[]) => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  function add() {
    if (!name.trim() || !role.trim()) return;
    onChange([...crew, { name: name.trim(), role: role.trim() }]);
    setName(""); setRole("");
  }

  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
        <Users size={11} /> Crew eintragen
      </label>

      {crew.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {crew.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-bg-elevated border border-border text-text-secondary text-xs rounded-full">
              <span className="font-medium text-text-primary">{c.name}</span>
              <span className="text-text-muted">· {c.role}</span>
              <button type="button" onClick={() => onChange(crew.filter((_, j) => j !== i))} className="hover:text-red-400 transition-colors ml-0.5">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          className="flex-1 px-3 py-2.5 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
        />
        <input
          type="text"
          placeholder="Rolle"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          className="flex-1 px-3 py-2.5 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
        />
        <button type="button" onClick={add}
          className="px-3 py-2.5 bg-bg-elevated border border-border rounded-xl text-text-muted hover:text-gold hover:border-gold/40 transition-all">
          <Plus size={15} />
        </button>
      </div>
      <p className="text-[11px] text-text-muted mt-1.5">Enter drücken oder + klicken zum Hinzufügen</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function NewProjectPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();

  const [form, setForm] = useState({
    title: "", type: "", year: "", director: "", myRole: "",
    genre: "", productionCompany: "", location: "", description: "",
    poster_url: "", link: "",
  });

  // Linked entities
  const [linkedCompanies, setLinkedCompanies] = useState<LinkedItem[]>([]);
  const [linkedLocations, setLinkedLocations] = useState<LinkedItem[]>([]);
  const [crew, setCrew] = useState<CrewEntry[]>([]);

  // Search state
  const [companyResults, setCompanyResults] = useState<LinkedItem[]>([]);
  const [locationResults, setLocationResults] = useState<LinkedItem[]>([]);
  const [searchingCompany, setSearchingCompany] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced company search
  const companyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCompanies = useCallback((q: string) => {
    if (companyTimer.current) clearTimeout(companyTimer.current);
    if (q.length < 2) { setCompanyResults([]); return; }
    companyTimer.current = setTimeout(async () => {
      setSearchingCompany(true);
      try {
        const res = await fetch(`/api/companies?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setCompanyResults(
          (json.data ?? []).map((c: { id: string; name: string; city?: string }) => ({
            id: c.id, name: c.name, subtitle: c.city,
          }))
        );
      } finally { setSearchingCompany(false); }
    }, 300);
  }, []);

  // Debounced location search
  const locationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchLocations = useCallback((q: string) => {
    if (locationTimer.current) clearTimeout(locationTimer.current);
    if (q.length < 2) { setLocationResults([]); return; }
    locationTimer.current = setTimeout(async () => {
      setSearchingLocation(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=location`);
        const json = await res.json();
        setLocationResults(
          (json.results ?? []).map((r: { id: string; title: string; city?: string }) => ({
            id: r.id, name: r.title, subtitle: r.city,
          }))
        );
      } finally { setSearchingLocation(false); }
    }, 300);
  }, []);

  if (!isSignedIn) {
    return (
      <div className="pt-16 min-h-screen bg-bg-primary flex items-center justify-center">
        <p className="text-text-muted">Bitte einloggen.</p>
      </div>
    );
  }

  const cfg: TypeConfig = form.type ? (TYPE_CONFIG[form.type] ?? DEFAULT_CONFIG) : DEFAULT_CONFIG;
  function set(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Titel ist Pflichtfeld"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          type: form.type || null,
          year: form.year || null,
          director: form.director || null,
          myRole: form.myRole || null,
          genre: form.genre || null,
          productionCompany: form.productionCompany || null,
          location: form.location || null,
          description: form.description || null,
          poster_url: form.poster_url || null,
          link: form.link || null,
          images: [],
          // Linked relations stored in metadata
          linked_companies: linkedCompanies,
          linked_locations: linkedLocations,
          crew_entries: crew,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler beim Speichern");
      router.push(`/projects/${json.project.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setSaving(false);
    }
  }

  const inputCls = "w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors";

  return (
    <div className="pt-16 min-h-screen bg-bg-primary">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/projects" className="text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-gold/15 border border-gold/25 flex items-center justify-center">
            <Clapperboard size={18} className="text-gold" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-text-primary leading-tight">Projekt eintragen</h1>
            <p className="text-xs text-text-muted">Zeig der Community deine Arbeit</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Produktionsart */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Produktionsart</label>
            <select value={form.type} onChange={(e) => set("type", e.target.value)}
              className={inputCls + " appearance-none"}>
              <option value="">Bitte wählen</option>
              {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Titel + Jahr */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Projekttitel <span className="text-gold">*</span></label>
              <input type="text" placeholder={cfg.titlePlaceholder} value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Jahr</label>
              <input type="number" placeholder="2024" min="1900" max="2030" value={form.year} onChange={(e) => set("year", e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Meine Rolle + Regie */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Meine Rolle</label>
              <input type="text" placeholder={cfg.rolePlaceholder} value={form.myRole} onChange={(e) => set("myRole", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">{cfg.directorLabel}</label>
              <input type="text" placeholder={cfg.directorPlaceholder} value={form.director} onChange={(e) => set("director", e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Genre + Firma */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">{cfg.genreLabel}</label>
              <input type="text" placeholder={cfg.genrePlaceholder} value={form.genre} onChange={(e) => set("genre", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">{cfg.companyLabel}</label>
              <input type="text" placeholder={cfg.companyPlaceholder} value={form.productionCompany} onChange={(e) => set("productionCompany", e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Drehort */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">{cfg.locationLabel}</label>
            <input type="text" placeholder={cfg.locationPlaceholder} value={form.location} onChange={(e) => set("location", e.target.value)} className={inputCls} />
          </div>

          {/* Beschreibung */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Beschreibung</label>
            <textarea rows={4} placeholder={cfg.descPlaceholder} value={form.description} onChange={(e) => set("description", e.target.value)} className={inputCls + " resize-none"} />
          </div>

          {/* Poster + Link */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Poster URL</label>
              <input type="url" placeholder="https://..." value={form.poster_url} onChange={(e) => set("poster_url", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Link</label>
              <input type="url" placeholder={cfg.linkPlaceholder} value={form.link} onChange={(e) => set("link", e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="h-px bg-border" />

          {/* Beteiligte Firmen */}
          <LinkedSearch
            label="Beteiligte Firmen"
            icon={Building2}
            placeholder="Firma suchen oder Namen eingeben …"
            items={linkedCompanies}
            onAdd={(item) => {
              if (!linkedCompanies.find((c) => c.name === item.name))
                setLinkedCompanies((p) => [...p, item]);
            }}
            onRemove={(i) => setLinkedCompanies((p) => p.filter((_, j) => j !== i))}
            onSearch={searchCompanies}
            searchResults={companyResults}
            searching={searchingCompany}
          />

          {/* Genutzte Locations */}
          <LinkedSearch
            label="Genutzte Locations"
            icon={MapPin}
            placeholder="Location suchen oder Namen eingeben …"
            items={linkedLocations}
            onAdd={(item) => {
              if (!linkedLocations.find((l) => l.name === item.name))
                setLinkedLocations((p) => [...p, item]);
            }}
            onRemove={(i) => setLinkedLocations((p) => p.filter((_, j) => j !== i))}
            onSearch={searchLocations}
            searchResults={locationResults}
            searching={searchingLocation}
          />

          {/* Crew */}
          <CrewAdder crew={crew} onChange={setCrew} />

          {/* ── Divider ── */}
          <div className="h-px bg-border" />

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              <X size={14} />{error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Link href="/projects"
              className="flex-1 px-4 py-3 border border-border text-text-secondary rounded-xl hover:border-border-hover hover:text-text-primary transition-all text-sm font-medium text-center">
              Abbrechen
            </Link>
            <button type="submit" disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm disabled:opacity-60">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              {saving ? "Speichern …" : "Projekt eintragen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
