"use client";

import PlaceField from "@/components/PlaceField";
import { useFormRouter as useRouter } from "@/lib/use-form-router";

import { useFormDraft } from "@/lib/use-form-draft";
import FormDraftStatus from "@/components/FormDraftStatus";
import React, { useState, useEffect, useRef, useCallback } from "react";

import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft, Clapperboard, CheckCircle, Loader2, X, Plus,
  Search, Building2, MapPin, Users, ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { uiErrorMessage } from "@/lib/ui-error-message";


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





// ── Linked item types ─────────────────────────────────────────────
type LinkedItem = { id?: string; name: string; subtitle?: string };
type CrewEntry  = { name: string; role: string };

// ── Generic searchable linker ─────────────────────────────────────

function getLocalizedTYPE_CONFIG(translate: (key: string) => string): Record<string, TypeConfig> {
  return ({
  "Spielfilm": { rolePlaceholder: translate("Ui.text_79b93c18f1f03e"), directorLabel: translate("menu.crewDirection"), directorPlaceholder: translate("Ui.text_18c9793dd4b4f7"), genreLabel: translate("profile.labelGenre"), genrePlaceholder: translate("Ui.text_3c4c96ca1af314"), locationLabel: translate("Ui.text_83382f209fd896"), locationPlaceholder: translate("Ui.text_efef29b8168ae8"), companyLabel: translate("profile.labelProductionCompany"), companyPlaceholder: translate("Ui.text_8b19f4fc396fd9"), linkPlaceholder: translate("Ui.text_e5da2a0e196592"), descPlaceholder: translate("Ui.text_5b6920b441558e"), titlePlaceholder: translate("Ui.text_68a961de48589a") },
  "Kurzfilm": { rolePlaceholder: translate("Ui.text_f8ee1f620f639c"), directorLabel: translate("menu.crewDirection"), directorPlaceholder: translate("Ui.text_18c9793dd4b4f7"), genreLabel: translate("profile.labelGenre"), genrePlaceholder: translate("Ui.text_7d2775ed364e82"), locationLabel: translate("Ui.text_83382f209fd896"), locationPlaceholder: translate("Ui.text_79e959cf80e219"), companyLabel: translate("Ui.text_d615314ed947e8"), companyPlaceholder: translate("Ui.text_b313170244b178"), linkPlaceholder: translate("Ui.text_6ffa187fe55132"), descPlaceholder: translate("Ui.text_b0b6f491df610d"), titlePlaceholder: translate("Ui.text_dee17ece7e18f3") },
  "Serie": { rolePlaceholder: translate("Ui.text_e7c0f4b6ac9f6f"), directorLabel: translate("Ui.text_ffcf59349dbdfb"), directorPlaceholder: translate("Ui.text_93d47b797e59bc"), genreLabel: translate("profile.labelGenre"), genrePlaceholder: translate("Ui.text_22edf3c8d16667"), locationLabel: translate("Ui.text_83382f209fd896"), locationPlaceholder: translate("Ui.text_2e92c5d3283d72"), companyLabel: translate("Ui.text_e548f68d6c218e"), companyPlaceholder: translate("Ui.text_d3a4b3ea456006"), linkPlaceholder: translate("Ui.text_a1c81d79bdce4a"), descPlaceholder: translate("Ui.text_575c04151ec916"), titlePlaceholder: translate("Ui.text_ed2deecbe94454") },
  "Dokumentation": { rolePlaceholder: translate("Ui.text_f8ee1f620f639c"), directorLabel: translate("menu.crewDirection"), directorPlaceholder: translate("Ui.text_18c9793dd4b4f7"), genreLabel: translate("Organizations.topicLabel"), genrePlaceholder: translate("Ui.text_d993791425308f"), locationLabel: translate("Ui.text_83382f209fd896"), locationPlaceholder: translate("Ui.text_0fffcb2801d46a"), companyLabel: translate("Ui.text_e548f68d6c218e"), companyPlaceholder: translate("Ui.text_99a70557b9cd32"), linkPlaceholder: translate("Ui.text_f3d770129fe5d2"), descPlaceholder: translate("Ui.text_c51792178969a5"), titlePlaceholder: translate("Ui.text_6c73b4f3bb9639") },
  "Musikvideo": { rolePlaceholder: translate("Ui.text_b3fc7f01d98c67"), directorLabel: translate("menu.crewDirection"), directorPlaceholder: translate("Ui.text_18c9793dd4b4f7"), genreLabel: translate("Ui.text_cc80d978a4a545"), genrePlaceholder: translate("Ui.text_70dfcb39207db6"), locationLabel: translate("Ui.text_83382f209fd896"), locationPlaceholder: translate("Ui.text_692df5dccf7096"), companyLabel: translate("Ui.text_b072c0c3e761ee"), companyPlaceholder: translate("Ui.text_dba77ceb02ccbc"), linkPlaceholder: translate("Ui.text_9178abf2d42194"), descPlaceholder: translate("Ui.text_0cc21da0e5404e"), titlePlaceholder: translate("Ui.text_74337d2174ae02") },
  "Werbefilm / Commercial": { rolePlaceholder: translate("Ui.text_9a24f34725576f"), directorLabel: translate("menu.crewDirection"), directorPlaceholder: translate("Ui.text_18c9793dd4b4f7"), genreLabel: translate("Organizations.formatLabel"), genrePlaceholder: translate("Ui.text_32296c76201cba"), locationLabel: translate("Ui.text_83382f209fd896"), locationPlaceholder: translate("Ui.text_ddc165fec8d11e"), companyLabel: translate("Ui.text_bc95e0dcca2946"), companyPlaceholder: translate("Ui.text_cc967febdeb81e"), linkPlaceholder: translate("Ui.text_d91040eb26af25"), descPlaceholder: translate("Ui.text_4449ede14bfb83"), titlePlaceholder: translate("Ui.text_3377ad2a602321") },
  "Corporate Film": { rolePlaceholder: translate("Ui.text_dbcc58ad3043fd"), directorLabel: translate("Ui.text_918982bce2096c"), directorPlaceholder: translate("Ui.text_238b33f85d75bd"), genreLabel: translate("Ui.text_3384cefe050932"), genrePlaceholder: translate("Ui.text_2361d15464cef8"), locationLabel: translate("Ui.text_f7eef21acafa37"), locationPlaceholder: translate("Ui.text_1aa8a64d2246d4"), companyLabel: translate("Ui.text_e286dd1b0712e4"), companyPlaceholder: translate("Ui.text_60ef1c58e0d0d7"), linkPlaceholder: translate("Ui.text_4010cef6f778bd"), descPlaceholder: translate("Ui.text_fa3c58c0a9d9fc"), titlePlaceholder: translate("Ui.text_a81ef97c3e0451") },
  "Event / Live": { rolePlaceholder: translate("Ui.text_3273c05f2fdbc4"), directorLabel: translate("Ui.text_623758b79eced4"), directorPlaceholder: translate("Ui.text_fa6aa869a7c449"), genreLabel: translate("Ui.text_ce2d22bccbe484"), genrePlaceholder: translate("Ui.text_6dd3f0288b55f7"), locationLabel: translate("Ui.text_9483f083ea5f25"), locationPlaceholder: translate("Ui.text_8611245c9e8d24"), companyLabel: translate("Ui.text_df756fb1891334"), companyPlaceholder: translate("Ui.text_1164cac4daaba0"), linkPlaceholder: translate("Ui.text_98fcb9c795f65b"), descPlaceholder: translate("Ui.text_f3f518ec6fb09b"), titlePlaceholder: translate("Ui.text_51d474a2b3638d") },
  "Foto / Shooting": { rolePlaceholder: translate("Ui.text_da8840a18236de"), directorLabel: translate("Ui.text_af725e1fe29a42"), directorPlaceholder: translate("Ui.text_bfcff28fc5039b"), genreLabel: translate("Ui.text_b34c8863f08d03"), genrePlaceholder: translate("Ui.text_4c9717a5343247"), locationLabel: translate("Ui.text_85d9e096db6b5d"), locationPlaceholder: translate("Ui.text_26bd5498eb0e9d"), companyLabel: translate("Ui.text_bc95e0dcca2946"), companyPlaceholder: translate("Ui.text_8a4febefb0dc7e"), linkPlaceholder: translate("Ui.text_44b2ebe2ac2f5d"), descPlaceholder: translate("Ui.text_e2a73095090136"), titlePlaceholder: translate("Ui.text_209dd7a1388739") },
  "Social Media Content": { rolePlaceholder: translate("Ui.text_527b0bc7d37df3"), directorLabel: translate("Ui.text_00bab39785045f"), directorPlaceholder: translate("Ui.text_73e57bb3486326"), genreLabel: translate("Ui.text_020658a74305df"), genrePlaceholder: translate("Ui.text_c043f4c3937f10"), locationLabel: translate("Ui.text_eedbc2857b292e"), locationPlaceholder: translate("Ui.text_c0352ffb8887e7"), companyLabel: translate("Ui.text_1186d6aab646eb"), companyPlaceholder: translate("Ui.text_0222f3e76c6007"), linkPlaceholder: translate("Ui.text_b82f1b03f2ed3d"), descPlaceholder: translate("Ui.text_d4da6ca6528a1b"), titlePlaceholder: translate("Ui.text_cbfc13af8cc95e") },
  "Imagefilm": { rolePlaceholder: translate("Ui.text_79b93c18f1f03e"), directorLabel: translate("Ui.text_b715c315ba6ed4"), directorPlaceholder: translate("responsiblePerson.title"), genreLabel: translate("Ui.text_b19fddb2cc6631"), genrePlaceholder: translate("Ui.text_42bbc731b126ec"), locationLabel: translate("Ui.text_83382f209fd896"), locationPlaceholder: translate("Ui.text_d4a509e7b8603d"), companyLabel: translate("Ui.text_f997e048f3be2a"), companyPlaceholder: translate("Ui.text_24747a148ca846"), linkPlaceholder: translate("Ui.text_15bcddfe375ad4"), descPlaceholder: translate("Ui.text_6b2affdf06bda7"), titlePlaceholder: translate("Ui.text_0435f274dc6fc6") },
  "Sonstiges": { rolePlaceholder: translate("Ui.text_79b93c18f1f03e"), directorLabel: translate("Ui.text_50c64e09823d24"), directorPlaceholder: translate("Ui.text_416e9c72f63910"), genreLabel: translate("Ui.text_10403284b9a7d2"), genrePlaceholder: translate("Ui.text_4eb337271a5f37"), locationLabel: translate("Ui.text_83382f209fd896"), locationPlaceholder: translate("Ui.text_db0877d65e1ba7"), companyLabel: translate("Ui.text_2dfade1934e72e"), companyPlaceholder: translate("Ui.text_9d3d20a56332f9"), linkPlaceholder: translate("Ui.text_5cc1ee3c157164"), descPlaceholder: translate("Ui.text_064295b0e12c23"), titlePlaceholder: translate("Ui.text_381a7d6816c07b") },
});
}

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
  const uiText = useTranslations();

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
              className="shrink-0 text-[11px] text-gold hover:text-gold-light font-semibold whitespace-nowrap">{uiText("Ui.text_993b7b55f75046")}</button>
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
                {r.id && <span className="text-[10px] text-gold/60 shrink-0">{uiText("Ui.text_8ca3f93cc45e94")}</span>}
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
  const uiText = useTranslations();

  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  function add() {
    if (!name.trim() || !role.trim()) return;
    onChange([...crew, { name: name.trim(), role: role.trim() }]);
    setName(""); setRole("");
  }

  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">{uiText.rich("Ui.text_71aec30e2a5e57", { part1: () => (<Users size={11} />) })}</label>

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
          placeholder={uiText("profile.fieldName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          className="flex-1 px-3 py-2.5 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
        />
        <input
          type="text"
          placeholder={uiText("Ui.text_0038a9cf86613c")}
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
      <p className="text-[11px] text-text-muted mt-1.5">{uiText("Ui.text_6d681d926674c0")}</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function NewProjectPage() {
  const uiText = useTranslations();
  const uiOptionLabels: Record<string, string> = {
    "Spielfilm": uiText("Ui.text_031b1c1fc4b241"),
    "Kurzfilm": uiText("Ui.text_75b346d26e4973"),
    "Serie": uiText("Ui.text_ab7743a4ad9a44"),
    "Dokumentation": uiText("projects.catDokumentation"),
    "Musikvideo": uiText("projects.catMusikvideo"),
    "Werbefilm / Commercial": uiText("Ui.text_9bf2221daf841f"),
    "Corporate Film": uiText("Ui.text_3a7f36cb4e7257"),
    "Event / Live": uiText("Ui.text_eab270724977e8"),
    "Foto / Shooting": uiText("Ui.text_f1ff7fc6fb8449"),
    "Social Media Content": uiText("Ui.text_130e3fc256922c"),
    "Imagefilm": uiText("Ui.text_411e73c2f310f4"),
    "Sonstiges": uiText("profile.typeOther"),
  };





  const TYPE_CONFIG = getLocalizedTYPE_CONFIG(uiText);


  const router = useRouter();
  const { isSignedIn } = useAuth();

  const [form, setForm] = useState({
    title: "", type: "", year: "", director: "", myRole: "",
    genre: "", productionCompany: "", location: "", selected_place_city_id: "", description: "",
    poster_url: "", link: "",
  });

  // Linked entities
  const [linkedCompanies, setLinkedCompanies] = useState<LinkedItem[]>([]);
  const [linkedLocations, setLinkedLocations] = useState<LinkedItem[]>([]);
  const [crew, setCrew] = useState<CrewEntry[]>([]);

  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const projectDraft = useFormDraft({ formKey: "project:new", value: { form, linkedCompanies, linkedLocations, crew, requestKey },
    restore: (draft) => { if (draft.requestKey) setRequestKey(draft.requestKey); setForm(draft.form); setLinkedCompanies(draft.linkedCompanies); setLinkedLocations(draft.linkedLocations); setCrew(draft.crew); },
  });

  // Search state
  const [companyResults, setCompanyResults] = useState<LinkedItem[]>([]);
  const [locationResults, setLocationResults] = useState<LinkedItem[]>([]);
  const [searchingCompany, setSearchingCompany] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const typeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (typeRef.current && !typeRef.current.contains(e.target as Node)) setTypeOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

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
        <p className="text-text-muted">{uiText("Ui.text_603df3632ba85f")}</p>
      </div>
    );
  }

  const cfg: TypeConfig = form.type ? (TYPE_CONFIG[form.type] ?? TYPE_CONFIG["Spielfilm"]) : TYPE_CONFIG["Spielfilm"];
  function set(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectDraft.loaded) return;
    if (!form.title.trim()) { setError(uiText("Ui.text_c2018abde6e3d8")); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestKey,
          title: form.title,
          type: form.type || null,
          year: form.year || null,
          director: form.director || null,
          myRole: form.myRole || null,
          genre: form.genre || null,
          productionCompany: form.productionCompany || null,
          location: form.location || null,
          selected_place_city_id: form.selected_place_city_id || undefined,
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
      if (!res.ok) throw new Error(json.error ?? uiText("profile.savingError"));
      await projectDraft.complete();
      router.push(`/dashboard/projects/drafts/${json.draft.id}`);
    } catch (err: unknown) {
      setError(uiErrorMessage(err, uiText("profile.unknownError")));
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
            <h1 className="font-display text-xl font-bold text-text-primary leading-tight">{uiText("projects.addProject")}</h1>
            <p className="text-xs text-text-muted">{uiText("Ui.text_cc3cb81a556f84")}</p>
          </div>
        </div>

        <FormDraftStatus draft={projectDraft} /><form onSubmit={handleSubmit} className="space-y-5">

          {/* Produktionsart */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">{uiText("Ui.text_0557707e2982c0")}</label>
            <div ref={typeRef} className="relative">
              <button
                type="button"
                onClick={() => setTypeOpen((o) => !o)}
                className={inputCls + " flex items-center justify-between text-left"}
              >
                <span className={form.type ? "text-text-primary" : "text-text-muted"}>
                  {form.type || uiText("Ui.text_4112179c8995fc")}
                </span>
                <ChevronDown size={15} className={`text-text-muted transition-transform duration-200 ${typeOpen ? "rotate-180" : ""}`} />
              </button>
              {typeOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-bg-elevated border border-border rounded-xl shadow-2xl overflow-hidden">
                  {PROJECT_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { set("type", t); setTypeOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-bg-hover ${form.type === t ? "text-gold bg-gold/8" : "text-text-primary"}`}
                    >
                      {(uiOptionLabels[t] ?? t)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Titel + Jahr */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">{uiText.rich("Ui.text_021a7d57480275", { part1: chunks => (<span className="text-gold">{chunks}</span>) })}</label>
              <input type="text" placeholder={cfg.titlePlaceholder} value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">{uiText("projects.filterYear")}</label>
              <input type="number" placeholder={String(new Date().getFullYear())} min="1900" max={new Date().getFullYear() + 5} value={form.year} onChange={(e) => set("year", e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Meine Rolle + Regie */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">{uiText("profile.labelMyRole")}</label>
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
            <PlaceField value={form.location} onChange={(value, cityId) => setForm(current => ({ ...current, location: value, selected_place_city_id: cityId || "" }))} />
          </div>

          {/* Beschreibung */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">{uiText("setup.description")}</label>
            <textarea rows={4} placeholder={cfg.descPlaceholder} value={form.description} onChange={(e) => set("description", e.target.value)} className={inputCls + " resize-none"} />
          </div>

          {/* Poster + Link */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">{uiText("Ui.text_af9f2155477cda")}</label>
              <input type="url" placeholder={uiText("Ui.text_e98a62ef23bb46")} value={form.poster_url} onChange={(e) => set("poster_url", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">{uiText("Ui.text_a6a32dbc5618ea")}</label>
              <input type="url" placeholder={cfg.linkPlaceholder} value={form.link} onChange={(e) => set("link", e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="h-px bg-border" />

          {/* Beteiligte Firmen */}
          <LinkedSearch
            label={uiText("Ui.text_2b5c201d2afdd5")}
            icon={Building2}
            placeholder={uiText("Ui.text_11f9aa786253be")}
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
            label={uiText("Ui.text_6aeb8a772267d5")}
            icon={MapPin}
            placeholder={uiText("Ui.text_7954d6c03a8736")}
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
              className="flex-1 px-4 py-3 border border-border text-text-secondary rounded-xl hover:border-border-hover hover:text-text-primary transition-all text-sm font-medium text-center">{uiText("home.boardCancel")}</Link>
            <button type="submit" disabled={saving || !projectDraft.loaded}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm disabled:opacity-60">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              {saving ? uiText("Ui.text_52cc3bf250a92e") : uiText("Ui.text_3f392fd0af41b6")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
