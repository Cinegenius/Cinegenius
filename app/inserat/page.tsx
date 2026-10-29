"use client";
import { useTranslations } from "next-intl";
import { useFormRouter as useRouter } from "@/lib/use-form-router";
import ResponsiblePersonFields, { focusResponsiblePerson } from "@/components/ResponsiblePersonFields";
import { EMPTY_RESPONSIBLE_PERSON, responsiblePersonDraft, responsiblePersonErrors, marketplaceResponsibleErrors, type ResponsiblePerson } from "@/lib/responsible-person";

import ListingPriceOptions from "@/components/ListingPriceOptions";

import UnoptimizedImage from "@/components/UnoptimizedImage";

import { useFormDraft } from "@/lib/use-form-draft";
import FormDraftStatus from "@/components/FormDraftStatus";
import React, { useState, useRef, useEffect } from "react";
import { compressImage, MAX_FUNCTION_UPLOAD_BYTES, safeObjectURL } from "@/lib/compressImage";

import { useAuth } from "@clerk/nextjs";
import {
  Package, Car, Shirt, Camera, Lightbulb, Mic, Layers, Wrench,
  Home, Building2, TreePine, Clapperboard, MapPin,
  Users, GraduationCap, Briefcase, Sparkles,
  ArrowRight, CheckCircle, Loader2, AlertTriangle, ChevronLeft, ChevronDown,
  Coffee, Truck, Monitor, Box,
  Film, Palette, Drama, X, ImageIcon, Search,
  Smartphone, Video, Aperture, PawPrint,
} from "lucide-react";
import { animalSpecies, animalRoleLabel, ANIMAL_DEPARTMENT_ID, ANIMAL_SPECIES } from "@/lib/animal-taxonomy";
import { FILM_DEPARTMENTS } from "@/lib/filmRoles";
import MarketplaceOfferSummary from "@/components/MarketplaceOfferSummary";
import MediaImage from "@/components/MediaImage";
import MarketplaceOfferFields, { MarketplaceCategoryPicker } from "@/components/MarketplaceOfferFields";
import { marketplaceDraft, marketplaceMetadataPatch, marketplaceBasePrice, serializeMarketplaceDraft, validateMarketplaceOffer, marketplaceCategoryLabel } from "@/lib/marketplace-offer";
import { marketplaceCategory } from "@/lib/marketplaceCategories";
import FocalPointPicker, { type FocalPoint } from "@/components/FocalPointPicker";
import ListingImageManager from "@/components/ListingImageManager";
import { MAX_LOCATION_IMAGES } from "@/lib/listing-image-gallery";
import { ProductionCreditsEditor } from "@/components/ProductionCredits";
import { serializeProductionCredits, type ProductionCreditDraft } from "@/lib/production-credits";

// ─── FormSelect ──────────────────────────────────────────────────────────────

function FormSelect({ value, onChange, options, placeholder, className = "" }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const selected = options.find(o => o.value === value);
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between gap-2 px-4 py-3 bg-bg-elevated border rounded-xl text-sm transition-colors text-left ${open ? "border-gold" : "border-border hover:border-gold/40"} ${selected ? "text-text-primary" : "text-text-muted"}`}>
        <span className="truncate">{selected?.label ?? placeholder ?? "Bitte wählen…"}</span>
        <ChevronDown size={14} className={`shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-bg-elevated border border-border rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
          {placeholder && (
            <button type="button" onClick={() => { onChange(""); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/[0.04] ${!value ? "text-gold font-medium" : "text-text-muted"}`}>
              {placeholder}
            </button>
          )}
          {options.map((o) => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/[0.04] ${value === o.value ? "text-gold font-medium" : "text-text-secondary"}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

type LucideIcon = React.ElementType;

type CategoryItem = {
  id: string;
  label: string;
  sub?: string;
  icon: LucideIcon;
  type: "creator" | "job" | "prop" | "vehicle" | "location" | "animal";
  category: string;
  color: string;
  bg: string;
};

type Group = { id: string; label: string; desc: string; color: string; border: string; items: CategoryItem[] };

// ─── Custom Role Dropdown ────────────────────────────────────────────────────

type RoleOption = { id: string; label: string; labelEn?: string; aliases?: readonly string[]; description?: string };

function RoleDropdown({
  value,
  onChange,
  options,
  placeholder = "Rolle auswählen…",
}: {
  value: string;
  onChange: (val: string) => void;
  options: RoleOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.label === value);
  const normalizedQuery = query.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("de");
  const filteredOptions = options.filter((option) =>
    !normalizedQuery || `${option.label} ${option.labelEn ?? ""} ${(option.aliases ?? []).join(" ")}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("de").includes(normalizedQuery),
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => { setOpen((o) => !o); setQuery(""); }}
        className={`w-full px-4 py-3 bg-bg-elevated border rounded-xl text-sm flex items-center justify-between transition-colors ${
          open ? "border-gold" : "border-border hover:border-border-hover"
        } ${selected ? "text-text-primary" : "text-text-muted"}`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-text-muted transition-transform duration-200 ml-2 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 right-0 bg-bg-secondary border border-border rounded-xl shadow-2xl overflow-hidden">
          <label className="flex items-center gap-2.5 px-3.5 py-3 border-b border-border bg-bg-elevated">
            <Search size={15} className="shrink-0 text-gold" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Gewerk oder Rolle suchen …"
              aria-label="Gewerk oder Rolle suchen"
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </label>
          <div role="listbox" className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <p className="px-4 py-5 text-center text-sm text-text-muted">Keine passende Rolle gefunden.</p>
            ) : filteredOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={opt.label === value}
                onClick={() => { onChange(opt.label); setOpen(false); setQuery(""); }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors hover:bg-bg-elevated ${
                  opt.label === value ? "text-gold bg-gold/5" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <span className="min-w-0">{opt.label}{opt.description && <span className="mt-0.5 block whitespace-normal text-[10px] leading-4 text-text-muted">{opt.description}</span>}</span>
                <span className="flex items-center gap-2 shrink-0 ml-2">
                  {opt.labelEn && (
                    <span className="text-[11px] text-text-muted hidden sm:block">{opt.labelEn}</span>
                  )}
                  {opt.label === value && <CheckCircle size={13} className="text-gold" />}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Icon + color mapping per department ────────────────────────────────────

const deptMeta: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  // Film
  "vor-der-kamera":   { icon: Drama,        color: "text-rose-400",    bg: "bg-rose-500/10 border-rose-500/20" },
  regie:              { icon: Clapperboard, color: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/20" },
  kamera:             { icon: Camera,       color: "text-sky-400",     bg: "bg-sky-500/10 border-sky-500/20" },
  licht:              { icon: Lightbulb,    color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
  grip:               { icon: Wrench,       color: "text-slate-400",   bg: "bg-slate-500/10 border-slate-500/20" },
  ton:                { icon: Mic,          color: "text-teal-400",    bg: "bg-teal-500/10 border-teal-500/20" },
  maske:              { icon: Sparkles,     color: "text-pink-400",    bg: "bg-pink-500/10 border-pink-500/20" },
  kostuem:            { icon: Shirt,        color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20" },
  szenenbild:         { icon: Palette,      color: "text-indigo-400",  bg: "bg-indigo-500/10 border-indigo-500/20" },
  produktion:         { icon: Briefcase,    color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  post:               { icon: Monitor,      color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
  // Social Media
  "content-creation": { icon: Smartphone,  color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20" },
  "social-video":     { icon: Video,        color: "text-fuchsia-400", bg: "bg-fuchsia-500/10 border-fuchsia-500/20" },
  // Fotografie
  fotografie:         { icon: Aperture,     color: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/20" },
  "foto-post":        { icon: ImageIcon,    color: "text-lime-400",    bg: "bg-lime-500/10 border-lime-500/20" },
};

// ─── Category structure ───────────────────────────────────────────────────────

const groups: Group[] = [
  {
    id: "jobs",
    label: "Jobs",
    desc: "Stelle ausschreiben — für jedes Gewerk einzeln",
    color: "text-emerald-400",
    border: "border-emerald-500/30",
    items: [
      ...FILM_DEPARTMENTS.map((d) => ({
        id: `job_${d.id}`,
        label: d.label,
        icon: deptMeta[d.id]?.icon ?? Users,
        type: "job" as const,
        category: d.label,
        color: deptMeta[d.id]?.color ?? "text-text-secondary",
        bg: deptMeta[d.id]?.bg ?? "bg-bg-elevated border-border",
      })),
      { id: "job_praktikum",      label: "Praktikum / Volontariat",    icon: GraduationCap, type: "job" as const, category: "Praktikum",        color: "text-gold",        bg: "bg-gold/10 border-gold/20" },
      { id: "job_projekt",        label: "Projektbasiert / Kurzfilm",  icon: Film,          type: "job" as const, category: "Projekt",          color: "text-indigo-400",  bg: "bg-indigo-500/10 border-indigo-500/20" },
    ],
  },
  {
    id: "marktplatz",
    label: "Marktplatz",
    desc: "Equipment, Requisiten, Kostüme & Fahrzeuge vermieten",
    color: "text-violet-400",
    border: "border-violet-500/30",
    items: [
      // Film Equipment
      { id: "mk_fahrzeuge",           label: "Bildfahrzeug vermieten",        sub: "Auto, Boot, Flugzeug, Heli, Motorrad…",       icon: Car,         type: "vehicle", category: "Bild-Fahrzeug",          color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20" },
      { id: "mk_produktionsfahrzeug", label: "Produktionsfahrzeug vermieten", sub: "Kostümbus, Equipmenttransporter, Maske…",     icon: Truck,       type: "vehicle", category: "Produktionsfahrzeug",     color: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/20" },
      { id: "mk_kostuem",        label: "Kostüme & Kleidung",     sub: "Verkleidungen, Uniformen, Zeitgeist…",     icon: Shirt,       type: "prop",    category: "Kostüme",              color: "text-rose-400",    bg: "bg-rose-500/10 border-rose-500/20" },
      { id: "mk_requisiten",     label: "Objekte & Dekoration",   sub: "Alltagsgegenstände, Kunstwerke, Deko…",    icon: Package,     type: "prop",    category: "Requisiten",           color: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/20" },
      { id: "mk_moebel",         label: "Möbel & Einrichtung",    sub: "Sofas, Lampen, Tische, Wanddeko…",         icon: Layers,      type: "prop",    category: "Möbel / Szenenbild",   color: "text-indigo-400",  bg: "bg-indigo-500/10 border-indigo-500/20" },
      { id: "mk_kamera",         label: "Kamera & Zubehör",       sub: "Kameras, Objektive, Gimbal, Monitor…",     icon: Camera,      type: "prop",    category: "Kameraequipment",      color: "text-sky-400",     bg: "bg-sky-500/10 border-sky-500/20" },
      { id: "mk_licht",          label: "Licht & Beleuchtung",    sub: "LED-Panels, Scheinwerfer, Softboxen…",     icon: Lightbulb,   type: "prop",    category: "Lichttechnik",         color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
      { id: "mk_ton",            label: "Ton & Audio",            sub: "Mikrofone, Recorder, Funksysteme…",        icon: Mic,         type: "prop",    category: "Ton & Audio",          color: "text-teal-400",    bg: "bg-teal-500/10 border-teal-500/20" },
      { id: "mk_grip",           label: "Stative & Träger",       sub: "Stative, Dolly, Schienen, Slider…",        icon: Wrench,      type: "prop",    category: "Grip & Rigging",       color: "text-slate-400",   bg: "bg-slate-500/10 border-slate-500/20" },
      { id: "mk_produktion",     label: "Diverses & Zubehör",     sub: "Cases, Monitore, Akkus, Kabel…",           icon: Box,         type: "prop",    category: "Produktionsausstattung",color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
      // Foto Equipment
      { id: "mk_fotoequipment",  label: "Foto-Equipment",         sub: "Kameras, Blitze, Objektive, Studiosets…",  icon: Aperture,    type: "prop",    category: "Fotoequipment",        color: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/20" },
      { id: "mk_backdrops",      label: "Hintergründe & Stoffe",  sub: "Backdrops, Chroma Key, Vorhänge…",         icon: ImageIcon,   type: "prop",    category: "Backdrops",            color: "text-lime-400",    bg: "bg-lime-500/10 border-lime-500/20" },
      // Creator / Social
      { id: "mk_contentsets",    label: "Content-Studio / Set",   sub: "Ring Light, Greenscreen, Creator-Zubehör…",icon: Smartphone,  type: "prop",    category: "Content Sets",         color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20" },
    ],
  },
  {
    id: "tiere",
    label: "Film-Tiere",
    desc: "Ausgebildete Tiere für Film, Foto & Werbung anbieten",
    color: "text-amber-400",
    border: "border-amber-500/30",
    items: [
      { id: "tier_hunde",    label: "Hunde",          sub: "Ausgebildete Filmhunde aller Rassen…",   icon: PawPrint, type: "animal" as const, category: "Hunde",          color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
      { id: "tier_pferde",   label: "Pferde & Ponys", sub: "Reit- und Kutschpferde, Ponys…",         icon: PawPrint, type: "animal" as const, category: "Pferde",         color: "text-stone-400",   bg: "bg-stone-500/10 border-stone-500/20" },
      { id: "tier_katzen",   label: "Katzen",         sub: "Rassekatzen, dressierte Hauskatzen…",    icon: PawPrint, type: "animal" as const, category: "Katzen",         color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20" },
      { id: "tier_voegel",   label: "Vögel",          sub: "Papageien, Greifvögel, Hühner…",         icon: PawPrint, type: "animal" as const, category: "Vögel",          color: "text-sky-400",     bg: "bg-sky-500/10 border-sky-500/20" },
      { id: "tier_reptilien",label: "Reptilien",      sub: "Schlangen, Echsen, Schildkröten…",       icon: PawPrint, type: "animal" as const, category: "Reptilien",      color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
      { id: "tier_nutztiere",label: "Nutztiere",      sub: "Kühe, Schafe, Ziegen, Schweine…",        icon: PawPrint, type: "animal" as const, category: "Nutztiere",      color: "text-lime-400",    bg: "bg-lime-500/10 border-lime-500/20" },
      { id: "tier_exoten",   label: "Exoten",         sub: "Lamas, Alpakas, Minischweine, Füchse…",  icon: PawPrint, type: "animal" as const, category: "Exoten",         color: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/20" },
      { id: "tier_sonstige", label: "Sonstige Tiere", sub: "Alle anderen Tierarten…",                icon: PawPrint, type: "animal" as const, category: "Sonstige Tiere", color: "text-zinc-400",    bg: "bg-zinc-500/10 border-zinc-500/20" },
    ],
  },
  {
    id: "drehorte",
    label: "Locations",
    desc: "Location für Film, Foto oder Werbung anbieten",
    color: "text-sky-400",
    border: "border-sky-500/30",
    items: [
      { id: "loc_wohnen",        label: "Wohnung / Haus",        icon: Home,         type: "location", category: "Wohnen",        color: "text-sky-400",     bg: "bg-sky-500/10 border-sky-500/20" },
      { id: "loc_villa",         label: "Villa / Luxusobjekt",   icon: Home,         type: "location", category: "Villa",         color: "text-gold",        bg: "bg-gold/10 border-gold/20" },
      { id: "loc_gewerbe",       label: "Büro / Gewerbe",        icon: Building2,    type: "location", category: "Büro",          color: "text-slate-400",   bg: "bg-slate-500/10 border-slate-500/20" },
      { id: "loc_industrie",     label: "Industrie / Halle",     icon: Truck,        type: "location", category: "Industrie",     color: "text-zinc-400",    bg: "bg-zinc-500/10 border-zinc-500/20" },
      { id: "loc_natur",         label: "Natur / Outdoor",       icon: TreePine,     type: "location", category: "Natur",         color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
      { id: "loc_gastro",        label: "Restaurant / Bar / Café",icon: Coffee,      type: "location", category: "Gastronomie",   color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
      { id: "loc_studio",        label: "Filmstudio",            icon: Clapperboard, type: "location", category: "Studio",        color: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/20" },
      { id: "loc_fotostudio",    label: "Fotostudio",            icon: Aperture,     type: "location", category: "Fotostudio",    color: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/20" },
      { id: "loc_special",       label: "Speziallocation",       icon: MapPin,       type: "location", category: "Speziallocation",color: "text-fuchsia-400", bg: "bg-fuchsia-500/10 border-fuchsia-500/20" },
    ],
  },
];

const projectTypes = [
  // Film
  "Spielfilm", "Kurzfilm", "Werbung", "Musikvideo", "TV / Serie", "Dokumentarfilm", "Corporate",
  // Social
  "Instagram / Reels", "TikTok", "YouTube", "UGC Content", "Brand Content",
  // Foto
  "Fashion Shooting", "Produkt-Shooting", "Event-Fotografie", "Hochzeits-Fotografie", "Portrait-Shooting", "Werbe-Fotografie",
  "Sonstiges",
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function InseratPage() {
  const moderation = useTranslations("OfferModeration");
  const marketplaceText = useTranslations("MarketplacePublishing");
  const animals = useTranslations("FilmAnimals");
  const [createdPublished, setCreatedPublished] = useState(false);
  const router = useRouter();
  const { userId, isLoaded } = useAuth();
  const [responsible, setResponsible] = useState<ResponsiblePerson>(EMPTY_RESPONSIBLE_PERSON);
  const [responsibleErrors, setResponsibleErrors] = useState<Record<string, string>>({});

  const LOCATION_ROOMS: Record<string, [string, string][]> = {
    "Wohnen": [
      ["living_room", "Wohnzimmer"], ["bedroom", "Schlafzimmer"], ["dining_room", "Esszimmer"],
      ["kitchen_room", "Küche"], ["bathroom", "Badezimmer"], ["home_office", "Arbeitszimmer"],
      ["garden", "Garten"], ["garage", "Garage"], ["basement", "Keller"],
      ["attic", "Dachboden"], ["balcony", "Balkon / Terrasse"], ["pool", "Pool"],
    ],
    "Villa": [
      ["living_room", "Wohnzimmer"], ["bedroom", "Schlafzimmer"], ["dining_room", "Esszimmer"],
      ["kitchen_room", "Küche"], ["bathroom", "Badezimmer"], ["garden", "Garten"],
      ["garage", "Garage"], ["pool", "Pool / Swimmingpool"], ["spa", "Sauna / Spa"],
      ["home_cinema", "Heimkino"], ["wine_cellar", "Weinkeller"], ["library", "Bibliothek"],
      ["balcony", "Balkon / Terrasse"], ["rooftop", "Rooftop"],
    ],
    "Büro": [
      ["open_space", "Open Space"], ["conference_room", "Konferenzraum"], ["meeting_room", "Besprechungsraum"],
      ["reception", "Empfang / Lobby"], ["kitchen_room", "Teeküche"], ["coworking", "Coworking-Bereich"],
      ["server_room", "Serverraum"], ["archive", "Archiv"], ["terrace", "Dachterrasse"],
    ],
    "Industrie": [
      ["warehouse", "Lagerhalle"], ["production", "Produktion / Werkstatt"], ["office_area", "Bürobereich"],
      ["changing_room_area", "Umkleide"], ["loading_area", "Verladebereich"], ["cold_storage", "Kühlraum"],
      ["rooftop", "Dach / Außenbereich"], ["showroom", "Showroom"],
    ],
    "Natur": [
      ["forest", "Wald"], ["meadow", "Wiese / Feld"], ["lake", "See / Gewässer"],
      ["beach", "Strand"], ["mountain", "Berg / Hügel"], ["park", "Park / Gartenanlage"],
      ["farm", "Bauernhof / Hof"], ["ruins", "Ruine / Lost Place"],
    ],
    "Gastronomie": [
      ["restaurant_area", "Restaurantbereich"], ["bar_area", "Bar / Theke"], ["terrace", "Terrasse / Außenbereich"],
      ["private_room", "Privatraum / VIP"], ["kitchen_room", "Profiküche"], ["storage", "Lager"],
      ["rooftop", "Rooftop"],
    ],
    "Studio": [
      ["main_stage", "Hauptstage"], ["green_room_area", "Green Room"], ["makeup_room", "Maske / Make-up"],
      ["control_room", "Regieraum"], ["prop_storage", "Requisitenlager"], ["changing_room_area", "Umkleide"],
      ["office_area", "Bürobereich"], ["outdoor_set", "Außenset"],
    ],
    "Fotostudio": [
      ["shooting_area", "Shootingfläche"], ["cyclorama", "Cyclorama / Hohlkehle"], ["makeup_room", "Maske / Make-up"],
      ["changing_room_area", "Umkleide"], ["lounge", "Lounge / Wartebereich"], ["storage", "Fundus / Lager"],
      ["office_area", "Bürobereich"],
    ],
    "Speziallocation": [
      ["main_area", "Hauptbereich"], ["garden", "Garten / Außenbereich"], ["basement", "Keller / UG"],
      ["rooftop", "Dach / Rooftop"], ["terrace", "Terrasse"], ["private_room", "Nebenraum"],
      ["storage", "Lager"],
    ],
  };

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdIsDraft, setCreatedIsDraft] = useState(false);
  const [marketReview,setMarketReview]=useState(false);
  const [savingPrivate,setSavingPrivate]=useState(false);
  const [publishingDraft, setPublishingDraft] = useState(false);
  const [selected, setSelected] = useState<CategoryItem | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null); // null = main view
  // Category-specific metadata (dynamic per prop category)
  const [marketplace, setMarketplace] = useState(() => marketplaceDraft());
  const optionalMedia = useTranslations("OptionalMedia");
  const marketText = useTranslations("MarketplaceOffer");
  const marketCatalog = useTranslations("MarketplaceCatalog");
  const [catMeta, setCatMeta] = useState<Record<string, string>>({});


  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [articleImages, setArticleImages] = useState<string[]>([]);
  const [articleGalleryState, setArticleGalleryState] = useState({ uploading: false, failed: 0 });
  const [locationGalleryState, setLocationGalleryState] = useState({ uploading: false, failed: 0 });
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [focalPoint, setFocalPoint] = useState<FocalPoint | null>(null);
  const [showFocalPicker, setShowFocalPicker] = useState(false);
  const [error, setError] = useState("");

  // Location extras
  const [locAmenities, setLocAmenities] = useState<string[]>([]);
  const [locRooms, setLocRooms] = useState<string[]>([]);
  const [locBlockedDates, setLocBlockedDates] = useState<string[]>([]);
  const [locExtraImages, setLocExtraImages] = useState<string[]>([]);
  const [locPriceOnRequest, setLocPriceOnRequest] = useState(true);
  const [priceNegotiable, setPriceNegotiable] = useState(false);
  const [locFloorPlanUrl, setLocFloorPlanUrl] = useState<string | null>(null);
  const [locFloorPlanPreview, setLocFloorPlanPreview] = useState<string | null>(null);
  const [locFloorUploading, setLocFloorUploading] = useState(false);
  const [productionCredits, setProductionCredits] = useState<ProductionCreditDraft[]>([]);
  const [locationDraftReady, setLocationDraftReady] = useState(false);
  const [locationDraftStatus, setLocationDraftStatus] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");
  // Calendar state for blocked dates
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    city: "",
    // vehicle
    make: "",
    model: "",
    year: "",
    fuel_type: "",
    license_class: "",
    condition: "",
    vehicle_subtype: "",
    // animal
    animal_training: "",
    animal_handler: true,
    animal_count: "1",
    animal_skills: "",
    // location
    sqm: "",
    ceiling_height: "",
    max_crew: "",
    indoor_outdoor: "innen" as "innen" | "außen" | "beides",
    power_available: false,
    power_details: "",
    parking_spots: "",
    natural_light: false,
    blackout_possible: false,
    loading_access: false,
    access_notes: "",
    shooting_hours: "",
    availability_notes: "",
    // job
    company: "",
    projectType: "",
    shoot_start: "",
    shoot_end: "",
    pay_type: "",
    role_label: "",   // exact role from filmRoles (e.g. "1. AC / Focus Puller")
    urgent: false,
    content_nudity: false,
    content_violence: false,
    content_stunts: false,
    // prop / vehicle extras
    delivery: false,
    rental_type: "miete" as "miete" | "kauf",
    dimensions: "",
    safety_note: "",
    // creator
    skills: "",
    experience: "",
  });

  const [myCompanies, setMyCompanies] = useState<{ id: string; name: string; logo_url: string | null }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      setLocationDraftReady(true);
      setLocationDraftStatus("idle");
      return;
    }

    let active = true;
    setLocationDraftReady(false);
    setLocationDraftStatus("loading");
    fetch("/api/onboarding", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? "Der gespeicherte Locationentwurf konnte nicht geladen werden.");
        return data.draft?.locationFormDraft as Record<string, unknown> | undefined;
      })
      .then((saved) => {
        if (!active) return;
        if (saved?.version === 1 && typeof saved.categoryId === "string") {
          const item = groups.flatMap((group) => group.items).find((candidate) => candidate.id === saved.categoryId && candidate.type === "location");
          if (item) {
            const savedForm = saved.form && typeof saved.form === "object" && !Array.isArray(saved.form)
              ? saved.form as Record<string, unknown>
              : {};
            const text = (key: string) => typeof savedForm[key] === "string" ? String(savedForm[key]).slice(0, key === "description" ? 5000 : 500) : "";
            setResponsible(responsiblePersonDraft(saved.responsible));
            setSelected(item);
            setActiveGroup(typeof saved.groupId === "string" && groups.some((group) => group.id === saved.groupId) ? saved.groupId : "drehorte");
            setStep(2);
            setForm((current) => ({
              ...current,
              title: text("title"), description: text("description"), city: text("city"), price: text("price"),
              sqm: text("sqm"), ceiling_height: text("ceiling_height"), max_crew: text("max_crew"),
              indoor_outdoor: ["innen", "außen", "beides"].includes(String(savedForm.indoor_outdoor)) ? savedForm.indoor_outdoor as "innen" | "außen" | "beides" : "innen",
              power_available: savedForm.power_available === true, power_details: text("power_details"), parking_spots: text("parking_spots"),
              natural_light: savedForm.natural_light === true, blackout_possible: savedForm.blackout_possible === true,
              loading_access: savedForm.loading_access === true, access_notes: text("access_notes"),
              shooting_hours: text("shooting_hours"), availability_notes: text("availability_notes"),
            }));
            setLocAmenities(Array.isArray(saved.amenities) ? saved.amenities.filter((value): value is string => typeof value === "string").slice(0, 80) : []);
            setLocRooms(Array.isArray(saved.rooms) ? saved.rooms.filter((value): value is string => typeof value === "string").slice(0, 80) : []);
            setLocBlockedDates(Array.isArray(saved.blockedDates) ? saved.blockedDates.filter((value): value is string => typeof value === "string").slice(0, 500) : []);
            const imageUrls = Array.isArray(saved.imageUrls) ? saved.imageUrls.filter((value): value is string => typeof value === "string" && (value.startsWith("https://") || value.startsWith("/api/media/"))).slice(0, MAX_LOCATION_IMAGES) : [];
            setLocExtraImages(imageUrls);
            setLocPriceOnRequest(savedForm.price_on_request !== false);
            setPriceNegotiable(savedForm.price_negotiable === true);
            const floorPlanUrl = typeof saved.floorPlanUrl === "string" && (saved.floorPlanUrl.startsWith("https://") || saved.floorPlanUrl.startsWith("/api/media/")) ? saved.floorPlanUrl : null;
            setLocFloorPlanUrl(floorPlanUrl);
            setLocFloorPlanPreview(floorPlanUrl);
            setSelectedCompanyId(typeof saved.selectedCompanyId === "string" ? saved.selectedCompanyId.slice(0, 100) : "");
            const point = saved.focalPoint && typeof saved.focalPoint === "object" ? saved.focalPoint as Record<string, unknown> : null;
            setFocalPoint(point && typeof point.x === "number" && typeof point.y === "number" && point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100 ? { x: point.x, y: point.y } : null);
            setProductionCredits(Array.isArray(saved.productionCredits) ? saved.productionCredits.slice(0, 20) as ProductionCreditDraft[] : []);
            setLocationDraftStatus("saved");
          }
        }
        setLocationDraftReady(true);
      })
      .catch(() => {
        if (!active) return;
        setLocationDraftReady(true);
        setLocationDraftStatus("error");
      });
    return () => { active = false; };
  }, [isLoaded, userId]);

  const listingDraft = useFormDraft({
    formKey: "listing:new",
    value: { form, responsible, categoryId: selected?.id ?? "", activeGroup, step, catMeta, marketplace,
      imageUrl, articleImages, focalPoint, locAmenities, locRooms, locBlockedDates, locExtraImages,
      locPriceOnRequest, priceNegotiable, locFloorPlanUrl, productionCredits, selectedCompanyId },
    ready: locationDraftReady && isLoaded && !!userId,
    enabled: !createdId,
    busy: uploading || articleGalleryState.uploading || articleGalleryState.failed > 0 || locationGalleryState.uploading || locationGalleryState.failed > 0 || locFloorUploading || !!pendingImageFile || loading,
    restore: (draft) => {
      setForm(draft.form); setResponsible(responsiblePersonDraft(draft.responsible));
      setSelected(groups.flatMap(group => group.items).find(item => item.id === draft.categoryId) ?? (draft.marketplace?.category ? marketplaceItem(draft.marketplace.category) : null));
      setActiveGroup(draft.activeGroup); setStep(draft.step); setCatMeta(draft.catMeta);
      if(draft.marketplace)setMarketplace(draft.marketplace);
      setImageUrl(draft.imageUrl); setImagePreview(draft.imageUrl); setArticleImages(draft.articleImages);
      setFocalPoint(draft.focalPoint); setLocAmenities(draft.locAmenities); setLocRooms(draft.locRooms);
      setLocBlockedDates(draft.locBlockedDates); setLocExtraImages(draft.locExtraImages);
      setLocPriceOnRequest(draft.locPriceOnRequest); setPriceNegotiable(draft.priceNegotiable);
      setLocFloorPlanUrl(draft.locFloorPlanUrl); setLocFloorPlanPreview(draft.locFloorPlanUrl);
      setProductionCredits(draft.productionCredits); setSelectedCompanyId(draft.selectedCompanyId);
    },
  });

  useEffect(() => {
    if (!userId) return;
    fetch("/api/companies?mine=true&limit=50")
      .then((r) => r.json())
      .then((d) => setMyCompanies(d.data ?? d.companies ?? []))
      .catch(() => {});
  }, [userId]);

  const f = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  function handleSelect(item: CategoryItem) {
    if (item.type === "location" && !locationDraftReady) {
      setError("Einen gespeicherten Locationentwurf prüfen wir gerade. Bitte versuche es gleich noch einmal.");
      return;
    }
    setMarketReview(false);
    setSelected(item);
    setCatMeta({});
    setProductionCredits([]);
    setStep(2);
  }

  useEffect(() => {
    if (!listingDraft.loaded || selected || form.title || createdId) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("animal") !== "1") return;
    const companyId = params.get("company_id");
    if (companyId && !myCompanies.some(company => company.id === companyId)) return;
    const category = groups.flatMap(group => group.items).find(item => item.type === "animal");
    if (!category) return;
    setSelected(category); setStep(2);
    if (companyId) setSelectedCompanyId(companyId);
  }, [listingDraft.loaded, selected, form.title, createdId, myCompanies]);

  function marketplaceItem(category:string):CategoryItem {
    const department=marketplaceCategory(category)?.department;
    const vehicle=department==='fahrzeuge';
    return {id:`market_${category}`,label:marketplaceCategoryLabel(category,marketCatalog),icon:vehicle?Car:Package,type:vehicle?'vehicle':'prop',category,color:'text-gold',bg:'bg-gold/10 border-gold/20'};
  }
  function chooseMarketplace(category:string){
    setMarketplace(current=>({...current,category}));
    if(category){setMarketReview(false);setSelected(marketplaceItem(category));setStep(2);}
  }
  function buildPayload() {
    if (!selected) return null;
    const { type } = selected;
    const category = (type === "prop" || type === "vehicle") && marketplace.category ? marketplace.category : selected.category;

    if (type === "vehicle") {
      return {
        type,
        category,
        title: form.title || (category === "Produktionsfahrzeug" && form.vehicle_subtype
          ? `${form.vehicle_subtype}${form.make ? ` – ${form.make}` : ""}`
          : `${form.make} ${form.model}${form.year ? ` (${form.year})` : ""}`).trim(),
        description: form.description || "",
        price: marketplaceBasePrice(marketplace),
        city: form.city,
        metadata: {
          ...marketplaceMetadataPatch(marketplace),
          make: form.make || null,
          model: form.model || null,
          year: form.year ? parseInt(form.year) : null,
          fuel_type: form.fuel_type || null,
          license_class: form.license_class || null,
          condition: form.condition || null,
          vehicle_subtype: form.vehicle_subtype || null,
          delivery: form.delivery,
          focal_point: focalPoint ?? null,
        },
      };
    }

    if (type === "location") {
      return {
        type,
        category,
        title: form.title,
        description: form.description || "",
        price: locPriceOnRequest ? 0 : parseFloat(form.price) || 0,
        city: form.city,
        metadata: {
          sqm: form.sqm ? parseFloat(form.sqm) : null,
          ceiling_height_m: form.ceiling_height ? parseFloat(form.ceiling_height) : null,
          max_crew: form.max_crew ? parseInt(form.max_crew) : null,
          indoor_outdoor: form.indoor_outdoor,
          power_available: form.power_available,
          power_details: form.power_details || null,
          parking_spots: form.parking_spots ? parseInt(form.parking_spots) : null,
          natural_light: form.natural_light,
          blackout_possible: form.blackout_possible,
          loading_access: form.loading_access,
          access_notes: form.access_notes || null,
          shooting_hours: form.shooting_hours || null,
          availability_notes: form.availability_notes || null,
          price_negotiable: priceNegotiable, price_on_request: locPriceOnRequest,
          amenities: locAmenities,
          rooms: locRooms,
          focal_point: focalPoint ?? null,
          production_credits: serializeProductionCredits(productionCredits),
        },
        blocked_dates: locBlockedDates,
        floor_plan_url: locFloorPlanUrl,
        extra_images: locExtraImages.slice(1),
      };
    }

    if (type === "job") {
      const dateRange = form.shoot_start
        ? form.shoot_end
          ? `${new Date(form.shoot_start).toLocaleDateString("de-DE", { day: "numeric", month: "long" })} – ${new Date(form.shoot_end).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}`
          : `Ab ${new Date(form.shoot_start).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}`
        : "";
      const contentWarnings = [
        form.content_nudity && "⚠ Nacktheit",
        form.content_violence && "⚠ Gewalt",
        form.content_stunts && "⚠ Stunts / Risiko",
      ].filter(Boolean).join(", ");
      const meta = [
        form.role_label && `Rolle: ${form.role_label}`,
        form.company && `Produktion: ${form.company}`,
        form.projectType && `Typ: ${form.projectType}`,
        dateRange && `Drehtage: ${dateRange}`,
        form.pay_type && `Vergütung: ${form.pay_type}`,
        form.urgent && "⚡ Dringend",
        contentWarnings && `Inhalt: ${contentWarnings}`,
      ].filter(Boolean).join(" · ");
      return {
        type,
        category,
        title: form.title,
        description: meta ? `${meta}\n\n${form.description}` : form.description,
        price: parseFloat(form.price) || 0,
        city: form.city,
      };
    }

    if (type === "animal") {
      return {
        type,
        category,
        title: form.title,
        description: form.description || "",
        price: 0,
        city: form.city,
        metadata: {
          offer_kind: "animal_portfolio",
          species: animalSpecies(category)?.id,
          training_level: form.animal_training || null,
          handler_included: form.animal_handler,
          count: form.animal_count || null,
          special_skills: form.animal_skills || null,
          delivery: form.delivery,
          focal_point: focalPoint ?? null,
        },
      };
    }

    if (type === "creator") {
      return {
        type,
        category,
        title: form.title,
        description: [
          form.skills && `Skills: ${form.skills}`,
          form.experience && `Erfahrung: ${form.experience}`,
        ].filter(Boolean).join("\n") + (form.description ? `\n\n${form.description}` : ""),
        price: parseFloat(form.price) || 0,
        city: form.city,
      };
    }

    // Prop: only the active canonical technical fields leave the private draft.
    return {
      type,
      category,
      title: form.title,
      description: form.description || "",
      price: marketplaceBasePrice(marketplace),
      city: form.city,
      rental_type: marketplaceMetadataPatch(marketplace).rental_type,
      metadata: {
        ...marketplaceMetadataPatch(marketplace),
        condition: form.condition || null,
        delivery: form.delivery,
        dimensions: form.dimensions || null,
        safety_note: form.safety_note || null,
        focal_point: focalPoint ?? null,
        production_credits: serializeProductionCredits(productionCredits),
      },
    };
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = e.target.files?.[0];
    if (!file) return;

    const _prev = safeObjectURL(file); if (_prev) setImagePreview(_prev);
    if (selected?.type === "job") {
      setPendingImageFile(file);
      setImageUrl(null);
      setError("");
      input.value = "";
      return;
    }
    setUploading(true);
    setError("");
    try {
      const compressed = await compressImage(file, { maxWidth: 1920, quality: 0.85, maxBytes: MAX_FUNCTION_UPLOAD_BYTES });
      const fd = new FormData();
      fd.append("file", compressed);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) {
        throw new Error(res.status === 413
          ? "Das Foto war für den Upload zu groß. Bitte wähle ein kleineres Bild."
          : json.error ?? "Das Foto konnte nicht hochgeladen werden.");
      }
      setImageUrl(json.url);
      setImagePreview(json.url);
    } catch (cause) {
      setImageUrl(null);
      setImagePreview(null);
      setError(cause instanceof Error ? cause.message : "Das Foto konnte nicht hochgeladen werden. Bitte versuche es erneut.");
    } finally {
      setUploading(false);
      input.value = "";
    }
  }

  function removeImage() {
    setImageUrl(null);
    setImagePreview(null);
    setPendingImageFile(null);
  }

  async function handleSubmit(privateDraft = false) {
    if (!userId) {
      const destination = `${window.location.pathname}${window.location.search}`;
      router.push(`/sign-in?redirect_url=${encodeURIComponent(destination)}`);
      return;
    }
    if (!listingDraft.loaded) return;
    const personErrors = (selected?.type === "prop" || selected?.type === "vehicle") ? marketplaceResponsibleErrors(responsible) : responsiblePersonErrors(responsible);
    setResponsibleErrors(personErrors);
    if (!privateDraft && Object.keys(personErrors).length && selected?.type !== "location" && selected?.type !== "job") { focusResponsiblePerson(); return; }
    const usesGallery = selected?.type === "prop" || selected?.type === "vehicle" || selected?.type === "animal" || selected?.type === "location";
    const galleryState = selected?.type === "location" ? locationGalleryState : articleGalleryState;
    if (usesGallery && galleryState.uploading) {
      setError("Bitte warte, bis alle Bilder fertig hochgeladen sind.");
      return;
    }
    if (usesGallery && galleryState.failed > 0) {
      setError("Bitte lade fehlgeschlagene Bilder erneut hoch oder entferne sie.");
      return;
    }
    if(selected?.type === "prop" || selected?.type === "vehicle") {
      const issue=validateMarketplaceOffer(marketplace.category,selected.type,serializeMarketplaceDraft(marketplace),!privateDraft);
      if(issue){setError(marketText(issue));return;}
    }
    if((selected?.type === "prop" || selected?.type === "vehicle") && !privateDraft && !marketReview){setMarketReview(true);window.scrollTo({top:0,behavior:'instant'});return;}
    setSavingPrivate(privateDraft);
    setLoading(true);
    setError("");
    const payload = buildPayload();
    if (!payload) { setLoading(false); return; }

    let json: { error?: string; publicationError?: string; data?: { id?: string; published?: boolean; moderation_status?: string } } = {};
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          responsible_person: responsible,
          image_url: selected?.type === "job" ? null
            : selected?.type === "location" ? locExtraImages[0] ?? null
            : (selected?.type === "prop" || selected?.type === "vehicle" || selected?.type === "animal") ? articleImages[0] ?? null
            : imageUrl,
          ...((selected?.type === "location") ? { extra_images: locExtraImages.slice(1) }
            : (selected?.type === "prop" || selected?.type === "vehicle" || selected?.type === "animal") ? { extra_images: articleImages.slice(1) } : {}),
          company_id: selectedCompanyId || null,
          draft: privateDraft || selected?.type === "job" || selected?.type === "location",
        }),
      });
      json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Fehler beim Speichern");
        setLoading(false);
        return;
      }
    } catch {
      setError("Speichern fehlgeschlagen. Deine Eingaben sind weiterhin als privater Entwurf gesichert. Bitte versuche es erneut.");
      setLoading(false);
      return;
    }
    setLoading(false);
    await listingDraft.complete();
    setCreatedId(json.data?.id ?? null);
    setCreatedIsDraft(json.data?.moderation_status === "draft" || selected?.type === "job" || selected?.type === "location");
    setCreatedPublished(json.data?.published === true);
    if (json.publicationError) setError(json.publicationError);
    if (selected?.type === "location") {
      const cleared = await fetch("/api/onboarding?type=location-form", { method: "DELETE" }).catch(() => null);
      if (!cleared?.ok) setError("Die Location ist sicher als Entwurf gespeichert. Der private Formularstand konnte noch nicht bereinigt werden.");
    }
    setStep(3);
  }

  async function handlePublishDraft() {
    if (!createdId || !createdIsDraft) return;
    const errors = (selected?.type === "prop" || selected?.type === "vehicle") ? marketplaceResponsibleErrors(responsible) : responsiblePersonErrors(responsible); setResponsibleErrors(errors);
    if (Object.keys(errors).length) { focusResponsiblePerson(); return; }
    setPublishingDraft(true);
    setError("");
    try {
      const responsibleSave = await fetch(`/api/listings/${createdId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ responsible_person: responsible }) });
      if (!responsibleSave.ok) { const failure = await responsibleSave.json(); throw new Error(failure.error); }
      let response: Response;
      if (pendingImageFile) {
        const compressed = await compressImage(pendingImageFile, { maxWidth: 1920, quality: 0.85, maxBytes: MAX_FUNCTION_UPLOAD_BYTES });
        const formData = new FormData();
        formData.append("file", compressed);
        response = await fetch(`/api/listings/${createdId}/publish`, { method: "POST", body: formData });
      } else {
        response = await fetch(`/api/listings/${createdId}/publish`, { method: "POST" });
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? moderation("saveError"));
      setCreatedIsDraft(false);
      setCreatedPublished(result.published === true);
      setPendingImageFile(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : moderation("saveError"));
    } finally {
      setPublishingDraft(false);
    }
  }

  const successHref = (id?: string | null) => {
    if (!selected) return "/";
    const base = selected.type === "location" ? "/locations"
      : selected.type === "vehicle" ? "/vehicles"
      : selected.type === "job" ? "/jobs"
      : selected.type === "creator" ? "/creators"
      : selected.type === "animal" ? "/tiere"
      : "/props";
    return id ? `${base}/${id}` : base;
  };

  const canSubmit = () => {
    if (!selected) return false;
    const { type } = selected;
    const hasCity = form.city.trim() !== "";
    if (type === "vehicle") {
      const base = (form.make.trim() || form.title.trim()) && hasCity && !!form.vehicle_subtype;
      return base;
    }
    if (type === "job") return form.role_label.trim() && form.title.trim() && hasCity && form.shoot_start !== "";
    if (type === "creator") return form.title.trim() && hasCity;
    if (type === "location") return form.title.trim() && hasCity;
    return form.title.trim() && hasCity;
  };

  if (isLoaded && !userId) {
    const destination = `${window.location.pathname}${window.location.search}`;
    router.push(`/sign-in?redirect_url=${encodeURIComponent(destination)}`);
    return null;
  }

  // ── STEP 1 ──────────────────────────────────────────────────────────────────

  // Main category tiles
  const mainTiles = [
    {
      id: "jobs",
      label: "Job ausschreiben",
      sub: "Film · Social Media · Fotografie",
      icon: Briefcase,
      color: "text-emerald-400",
      border: "border-emerald-500/30 hover:border-emerald-400",
      bg: "bg-emerald-500/5",
      activeBorder: "border-emerald-400",
    },
    {
      id: "drehorte",
      label: "Location inserieren",
      sub: "Locations · Fotostudios · Studios",
      icon: MapPin,
      color: "text-sky-400",
      border: "border-sky-500/30 hover:border-sky-400",
      bg: "bg-sky-500/5",
      activeBorder: "border-sky-400",
    },
    {
      id: "marktplatz",
      label: "Marktplatz",
      sub: "Equipment · Fotoequipment · Creator Sets",
      icon: Package,
      color: "text-violet-400",
      border: "border-violet-500/30 hover:border-violet-400",
      bg: "bg-violet-500/5",
      activeBorder: "border-violet-400",
    },
    {
      id: "tiere",
      label: "Film-Tiere inserieren",
      sub: "Hunde · Pferde · Katzen · Exoten",
      icon: PawPrint,
      color: "text-amber-400",
      border: "border-amber-500/30 hover:border-amber-400",
      bg: "bg-amber-500/5",
      activeBorder: "border-amber-400",
    },
    {
      id: "firma",
      label: "Firma eintragen",
      sub: "Produktionsfirma · Agentur · Studio",
      icon: Building2,
      color: "text-gold",
      border: "border-gold/20 hover:border-gold/60",
      bg: "bg-gold/5",
      activeBorder: "border-gold",
    },
  ];

  const currentGroup = activeGroup ? groups.find((g) => g.id === activeGroup) ?? null : null;

  if (step === 1) {
    return (
      <div className="pt-16 min-h-screen bg-bg-primary">
        <div className="max-w-2xl mx-auto px-4 py-10">

          {/* Header */}
          <div className="mb-8">
            {activeGroup && (
              <button
                onClick={() => setActiveGroup(null)}
                className="flex items-center gap-1.5 text-text-muted hover:text-text-primary text-sm mb-5 transition-colors"
              >
                <ChevronLeft size={16} /> Zurück
              </button>
            )}
            <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">Inserat erstellen</p>
            <h1 className="font-display text-2xl font-bold text-text-primary mb-1">
              {activeGroup === "tiere" ? animals("portfolio") : activeGroup ? currentGroup?.label : "Was möchtest du inserieren?"}
            </h1>
            <p className="text-text-muted text-sm">
              {activeGroup ? "Wähle eine Kategorie aus." : "Wähle einen Bereich — der Rest passt sich an."}
            </p>
            {activeGroup === "drehorte" && locationDraftStatus === "loading" && (
              <p role="status" className="mt-3 text-xs text-text-muted">Gespeicherten Locationfortschritt prüfen …</p>
            )}
          </div>

          {/* Main category tiles */}
          {!activeGroup && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mainTiles.map((tile) => (
                <button
                  key={tile.id}
                  onClick={() => {
                    if (tile.id === "firma") { router.push("/dashboard?tab=firma"); return; }
                    setActiveGroup(tile.id);
                  }}
                  className={`group flex items-start gap-4 p-5 rounded-2xl border-2 transition-all text-left ${tile.bg} ${tile.border}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-bg-secondary`}>
                    <tile.icon size={20} className={tile.color} />
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary text-sm mb-0.5">{tile.id === "tiere" ? animals("addPortfolio") : tile.label}</p>
                    <p className="text-xs text-text-muted leading-relaxed">{tile.id === "tiere" ? animals("description") : tile.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Sub-category grid */}
          {activeGroup === "marktplatz" && <MarketplaceCategoryPicker value={marketplace.category} onChange={chooseMarketplace} />}
          {activeGroup && activeGroup !== "marktplatz" && currentGroup && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {currentGroup.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`group flex items-center gap-3.5 p-4 rounded-xl border border-border bg-bg-secondary hover:bg-bg-elevated hover:border-current transition-all text-left ${item.color}`}
                >
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${item.bg}`}>
                    <item.icon size={18} className={item.color} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary leading-snug group-hover:text-current transition-colors">
                      {item.type === "animal" ? animals(`species.${animalSpecies(item.category)!.id}`) : item.id.endsWith(ANIMAL_DEPARTMENT_ID) ? animals("department") : item.label}
                    </p>
                    {item.sub && (
                      <p className="text-xs text-text-muted mt-0.5 leading-relaxed truncate">{item.type === "animal" ? animals("portfolioHelp") : item.sub}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

        </div>
      </div>
    );
  }

  // ── STEP 2 ──────────────────────────────────────────────────────────────────
  if (step === 2 && selected) {
    const { type, label, icon: Icon, color, bg } = selected;
    const isVehicle = type === "vehicle";
    const isAnimal = type === "animal";
    const isLocation = type === "location";
    const isJob = type === "job";
    const isCreator = type === "creator";

    // Derive which FILM_DEPARTMENT this item belongs to
    const deptId = selected.id.replace(/^(job_|crew_)/, "");
    const dept = FILM_DEPARTMENTS.find((d) => d.id === deptId) ?? null;

    return (
      <>
      <div className="pt-16 min-h-screen bg-bg-primary">
        <div className="max-w-2xl mx-auto px-4 py-10">

          {/* Header */}
          <button disabled={articleGalleryState.uploading} onClick={() => { setStep(1); if(selected?.type!=="prop"&&selected?.type!=="vehicle"){setImageUrl(null);setImagePreview(null);} setSelected(null); }} className="flex items-center gap-1.5 text-text-muted hover:text-text-primary text-sm mb-6 transition-colors disabled:cursor-not-allowed disabled:opacity-50">
            <ChevronLeft size={16} /> Zurück zur Auswahl
          </button>

          <div className="flex items-center gap-3 mb-8">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${bg}`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-gold font-semibold">Inserat erstellen</p>
              <FormDraftStatus draft={listingDraft} />
              <h1 className="font-display text-2xl font-bold text-text-primary">{isAnimal ? animals("portfolio") : dept?.id === ANIMAL_DEPARTMENT_ID ? animals("department") : label}</h1>
            </div>
          </div>

          {marketReview && (type === "prop" || type === "vehicle") && <div className="space-y-4"><h2 className="font-display text-xl">{marketText("preview")}</h2><h3 className="break-words text-lg font-semibold">{buildPayload()?.title}</h3><p className="text-text-secondary">{form.city}</p><p className="whitespace-pre-wrap break-words text-sm">{form.description}</p>{articleImages.length>0&&<div className="grid grid-cols-3 gap-2">{articleImages.map((src,index)=><div key={src} className="relative aspect-square overflow-hidden rounded-lg"><MediaImage src={src} alt={String(index+1)} fill sizes="200px" className="object-contain"/></div>)}</div>}<MarketplaceOfferSummary category={marketplace.category} price={marketplaceBasePrice(marketplace)} metadata={marketplaceMetadataPatch(marketplace)} /><button type="button" className="min-h-11 text-gold" onClick={()=>setMarketReview(false)}>{marketText("edit")}</button></div>}
          <div className="space-y-5">
          <div hidden={marketReview} className="space-y-5">
            <ResponsiblePersonFields value={responsible} onChange={setResponsible} errors={responsibleErrors} accountPrefill compactWhenProfile={selected?.type === "prop" || selected?.type === "vehicle"} />
            {/* ── FIRMA VERKNÜPFEN ── */}
            {myCompanies.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Zu Firma verknüpfen (optional)</label>
                <FormSelect value={selectedCompanyId} onChange={setSelectedCompanyId}
                  placeholder="Kein Firmenprofil"
                  options={myCompanies.map((c) => ({ value: c.id, label: c.name }))} />
                {selectedCompanyId && (
                  <p className="text-xs text-text-muted mt-1.5">Dieses Inserat erscheint auf deinem Firmenprofil.</p>
                )}
              </div>
            )}

            {/* ── VEHICLE FIELDS ── */}
            {isVehicle && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Marke *</label>
                    <input value={form.make} onChange={(e) => f("make", e.target.value)} placeholder="Ford"
                      className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Modell *</label>
                    <input value={form.model} onChange={(e) => f("model", e.target.value)} placeholder="Mustang"
                      className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Baujahr</label>
                    <input type="number" value={form.year} onChange={(e) => f("year", e.target.value)} placeholder="1969"
                      className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Fahrzeugtyp *</label>
                  <FormSelect value={form.vehicle_subtype} onChange={(v) => f("vehicle_subtype", v)}
                    placeholder="Bitte wählen…"
                    options={((selected.category === "Produktionsfahrzeug" || (marketplaceCategory(selected.category)?.department === "fahrzeuge" && marketplaceCategory(selected.category)?.subcategory !== "fahrzeuge-bild"))
                      ? ["Kostümbus", "Maske & Hair", "Equipment-Transporter", "Kamera-Van", "Generator-Fahrzeug", "Catering / Crafty", "Produktions-Van", "Regisseur-Trailer", "Darsteller-Trailer", "Motorboot / Tender", "Produktionsschiff", "Helikopter (Transport)", "Kleinflugzeug (Transport)", "Sonstiges"]
                      : ["PKW / Limousine", "Sportwagen / Cabrio", "SUV / Geländewagen", "Oldtimer / Classic Car", "Motorrad", "Roller / Scooter", "LKW / Truck", "Bus / Reisebus", "Wohnmobil / Camper", "Militärfahrzeug", "Kutsche / Pferdewagen", "Motorboot", "Segelboot / Yacht", "Jet-Ski", "Schiff / Fähre", "U-Boot (Requisite)", "Flugzeug (Prop / Stunt)", "Helikopter / Gyrocopter", "Heißluftballon", "Sonstiges"]
                    ).map(o => ({ value: o, label: o }))} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Antrieb / Kraftstoff</label>
                    <FormSelect value={form.fuel_type} onChange={(v) => f("fuel_type", v)}
                      placeholder="Bitte wählen…"
                      options={["Benzin", "Diesel", "Elektro", "Hybrid", "LPG", "Marine-Diesel", "Kerosin / Avgas", "Wind (Segel)", "Muskelkraft / Ruder", "Sonstiges"].map(o => ({ value: o, label: o }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Lizenz / Führerschein</label>
                    <FormSelect value={form.license_class} onChange={(v) => f("license_class", v)}
                      placeholder="Bitte wählen…"
                      options={["B", "BE", "C", "CE", "D", "A", "Bootsführerschein (SBF Binnen)", "Bootsführerschein (SBF See / SKS)", "Sportküstenschifferschein (SKS)", "Privatpilotenlizenz (PPL)", "Berufspilotenlizenz (CPL)", "Keine / Nicht erforderlich"].map(o => ({ value: o, label: o }))} />
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div onClick={() => f("delivery", !form.delivery)}
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${form.delivery ? "bg-gold" : "bg-border"}`}>
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.delivery ? "left-5" : "left-1"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">Lieferung zum Set möglich</p>
                    <p className="text-xs text-text-muted">Das Fahrzeug kann zur Location geliefert werden</p>
                  </div>
                </label>
              </div>
            )}

            {/* Animal information describes a supervised production portfolio. */}
            {isAnimal && <fieldset className="space-y-4 rounded-xl border border-border p-4">
              <legend className="px-1 text-sm font-semibold">{animals("portfolioDetails")}</legend>
              <label className="block text-sm">{animals("speciesField")}
                <select value={animalSpecies(selected.category)?.id ?? "dogs"} onChange={event => { const species = ANIMAL_SPECIES.find(item => item.id === event.target.value); const item = groups.flatMap(group => group.items).find(item => item.type === "animal" && item.category === species?.category); if (item) setSelected(item); }} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-bg-elevated px-3 text-text-primary">
                  {ANIMAL_SPECIES.map(species => <option key={species.id} value={species.id}>{animals(`species.${species.id}`)}</option>)}
                </select>
              </label>
              <label className="block text-sm">{animals("training")}<input value={form.animal_training} onChange={event => f("animal_training",event.target.value)} maxLength={120} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-bg-elevated px-3" /></label>
              <label className="block text-sm">{animals("count")}<input value={form.animal_count} onChange={event => f("animal_count",event.target.value)} maxLength={40} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-bg-elevated px-3" /></label>
              <label className="block text-sm">{animals("skills")}<textarea value={form.animal_skills} onChange={event => f("animal_skills",event.target.value)} maxLength={2000} className="mt-2 min-h-24 w-full rounded-xl border border-border bg-bg-elevated p-3" /></label>
              <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={form.animal_handler} onChange={event => f("animal_handler",event.target.checked)} className="accent-gold" />{animals("handler")}</label>
              <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={form.delivery} onChange={event => f("delivery",event.target.checked)} className="accent-gold" />{animals("delivery")}</label>
              <p className="text-xs leading-5 text-text-muted">{animals("selfReported")}</p>
            </fieldset>}

            {/* ── LOCATION FIELDS ── */}
            {isLocation && (
              <div className="space-y-5">

                {/* Grunddaten */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Fläche (m²)</label>
                    <input type="number" value={form.sqm} onChange={(e) => f("sqm", e.target.value)} placeholder="120"
                      className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Deckenhöhe (m)</label>
                    <input type="number" step="0.1" value={form.ceiling_height} onChange={(e) => f("ceiling_height", e.target.value)} placeholder="3.5"
                      className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Max. Crew</label>
                    <input type="number" value={form.max_crew} onChange={(e) => f("max_crew", e.target.value)} placeholder="20"
                      className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Parkplätze</label>
                    <input type="number" value={form.parking_spots} onChange={(e) => f("parking_spots", e.target.value)} placeholder="5"
                      className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors text-sm" />
                  </div>
                </div>

                {/* Lage */}
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Lage *</label>
                  <div className="flex rounded-xl border border-border overflow-hidden">
                    {(["innen", "außen", "beides"] as const).map((opt) => (
                      <button key={opt} type="button" onClick={() => f("indoor_outdoor", opt)}
                        className={`flex-1 py-2.5 text-sm font-medium transition-colors capitalize ${form.indoor_outdoor === opt ? "bg-gold text-bg-primary" : "bg-bg-elevated text-text-muted hover:text-text-primary"}`}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Strom */}
                <div>
                  <label className="flex items-center gap-3 cursor-pointer mb-2">
                    <div onClick={() => f("power_available", !form.power_available)}
                      className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 cursor-pointer shrink-0 ${form.power_available ? "bg-gold" : "bg-bg-elevated border border-border"}`}>
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${form.power_available ? "translate-x-4" : ""}`} />
                    </div>
                    <p className="text-sm font-medium text-text-primary">Stromanschluss vorhanden</p>
                  </label>
                  {form.power_available && (
                    <input type="text" value={form.power_details} onChange={(e) => f("power_details", e.target.value)}
                      placeholder="z.B. 2× 32A CEE, 1× 63A CEE 3-phasig, 230V Steckdosen"
                      className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors text-sm" />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">Licht und Anlieferung</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {([
                      ["natural_light", "Tageslicht vorhanden"],
                      ["blackout_possible", "Verdunkelbar"],
                      ["loading_access", "Gute Be-/Entladung"],
                    ] as const).map(([key, label]) => (
                      <button key={key} type="button" aria-pressed={form[key]} onClick={() => f(key, !form[key])}
                        className={`min-h-11 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${form[key] ? "border-gold bg-gold/10 text-gold" : "border-border bg-bg-elevated text-text-secondary hover:border-gold/40"}`}>
                        {form[key] ? "✓ " : ""}{label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Mögliche Drehzeiten</label>
                    <input value={form.shooting_hours} onChange={(e) => f("shooting_hours", e.target.value)} maxLength={160}
                      placeholder="z. B. werktags ab 9 Uhr, nach Absprache"
                      className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Anfahrt und Zugang</label>
                    <input value={form.access_notes} onChange={(e) => f("access_notes", e.target.value)} maxLength={240}
                      placeholder="z. B. Zufahrt über den Innenhof"
                      className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Verfügbarkeit oder Einschränkungen</label>
                  <textarea value={form.availability_notes} onChange={(e) => f("availability_notes", e.target.value)} maxLength={500} rows={2}
                    placeholder="z. B. nicht an Sonn- und Feiertagen, Belegung bitte anfragen"
                    className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors text-sm resize-y" />
                </div>

                {/* Räume — kategoriespezifisch */}
                {selected?.category && LOCATION_ROOMS[selected.category] && (
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">Räume & Bereiche</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {LOCATION_ROOMS[selected.category].map(([id, label]) => {
                        const active = locRooms.includes(id);
                        return (
                          <button key={id} type="button"
                            onClick={() => setLocRooms(prev => active ? prev.filter(r => r !== id) : [...prev, id])}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-medium transition-all ${active ? "border-gold bg-gold/10 text-gold" : "border-border bg-bg-elevated text-text-secondary hover:border-border-light"}`}>
                            {active && <span className="text-gold">✓</span>} {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Ausstattung */}
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">Ausstattung</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      ["wifi", "Wi-Fi"], ["restrooms", "WC / Sanitär"], ["green_room", "Green Room"],
                      ["loading_bay", "Laderampe"], ["kitchen", "Küche"], ["changing_room", "Umkleide"],
                      ["generator", "Generator"], ["sound_insulated", "Schallisoliert"], ["ac", "Klimaanlage"],
                      ["heating", "Heizung"], ["elevator", "Aufzug"], ["disabled_access", "Barrierefreiheit"],
                    ].map(([id, label]) => {
                      const active = locAmenities.includes(id);
                      return (
                        <button key={id} type="button"
                          onClick={() => setLocAmenities(prev => active ? prev.filter(a => a !== id) : [...prev, id])}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-medium transition-all ${active ? "border-gold bg-gold/10 text-gold" : "border-border bg-bg-elevated text-text-secondary hover:border-border-light"}`}>
                          {active && <span className="text-gold">✓</span>} {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grundriss */}
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Grundriss (optional)</label>
                  {locFloorPlanPreview ? (
                    <div className="relative w-full max-w-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={locFloorPlanPreview} alt="Grundriss" className="w-full rounded-xl border border-border object-contain max-h-48" />
                      <button type="button" onClick={() => { setLocFloorPlanUrl(null); setLocFloorPlanPreview(null); }}
                        className="absolute top-2 right-2 w-6 h-6 bg-bg-primary/80 rounded-full flex items-center justify-center text-text-muted hover:text-crimson-light text-xs">✕</button>
                    </div>
                  ) : (
                    <label className={`flex items-center gap-2 px-4 py-3 bg-bg-elevated border border-dashed border-border rounded-xl cursor-pointer hover:border-gold transition-colors text-sm text-text-muted w-fit ${locFloorUploading ? "opacity-60 pointer-events-none" : ""}`}>
                      {locFloorUploading ? <span className="animate-spin text-gold">⟳</span> : <span>+</span>} Grundriss hochladen
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        const _fp = safeObjectURL(file); if (_fp) setLocFloorPlanPreview(_fp);
                        setLocFloorUploading(true);
                        const fd = new FormData(); fd.append("file", file);
                        const res = await fetch("/api/upload", { method: "POST", body: fd });
                        const json = await res.json();
                        setLocFloorUploading(false);
                        if (json.url) setLocFloorPlanUrl(json.url);
                      }} />
                    </label>
                  )}
                </div>

                {/* Verfügbarkeit / Gesperrte Tage */}
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-1">Gesperrte Tage</label>
                  <p className="text-xs text-text-muted mb-3">Klicke auf Tage die nicht buchbar sind (rot = gesperrt)</p>
                  {(() => {
                    const today = new Date(); today.setHours(0,0,0,0);
                    const monthNames = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
                    const firstDay = new Date(calYear, calMonth, 1);
                    const startOffset = (firstDay.getDay() + 6) % 7;
                    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                    const cells: (number | null)[] = Array(startOffset).fill(null);
                    for (let i = 1; i <= daysInMonth; i++) cells.push(i);
                    while (cells.length % 7 !== 0) cells.push(null);
                    const toggleDay = (day: number) => {
                      const key = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                      setLocBlockedDates(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]);
                    };
                    return (
                      <div className="bg-bg-elevated border border-border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <button type="button" onClick={() => { if (calMonth === 0) { setCalYear(y => y-1); setCalMonth(11); } else setCalMonth(m => m-1); }}
                            className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-gold rounded-lg hover:bg-bg-secondary transition-all">‹</button>
                          <span className="text-sm font-semibold text-text-primary">{monthNames[calMonth]} {calYear}</span>
                          <button type="button" onClick={() => { if (calMonth === 11) { setCalYear(y => y+1); setCalMonth(0); } else setCalMonth(m => m+1); }}
                            className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-gold rounded-lg hover:bg-bg-secondary transition-all">›</button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 mb-1">
                          {["Mo","Di","Mi","Do","Fr","Sa","So"].map(d => <div key={d} className="text-center text-[10px] text-text-muted font-semibold py-1">{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {cells.map((day, i) => {
                            if (!day) return <div key={i} />;
                            const key = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                            const cellDate = new Date(calYear, calMonth, day);
                            const isPast = cellDate < today;
                            const isBlocked = locBlockedDates.includes(key);
                            return (
                              <button key={i} type="button" onClick={() => !isPast && toggleDay(day)}
                                className={`aspect-square flex items-center justify-center text-xs rounded-full transition-all font-medium ${
                                  isPast ? "text-text-muted/30 cursor-not-allowed" :
                                  isBlocked ? "bg-crimson/20 text-crimson-light border border-crimson/40 cursor-pointer" :
                                  "text-text-primary hover:bg-gold/20 cursor-pointer"
                                }`}>
                                {day}
                              </button>
                            );
                          })}
                        </div>
                        {locBlockedDates.length > 0 && (
                          <p className="text-xs text-text-muted mt-3">{locBlockedDates.length} Tag{locBlockedDates.length !== 1 ? "e" : ""} gesperrt</p>
                        )}
                      </div>
                    );
                  })()}
                </div>

              </div>
            )}

            {/* ── JOB FIELDS ── */}
            {isJob && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">
                    Gesuchte Rolle *
                  </label>
                  <RoleDropdown
                    value={form.role_label}
                    onChange={(val) => { f("role_label", val); if (!form.title) f("title", val); }}
                    options={dept ? dept.roles : FILM_DEPARTMENTS.flatMap((d) => d.roles)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Produktion / Unternehmen</label>
                    <input value={form.company} onChange={(e) => f("company", e.target.value)} placeholder="Parallax Films"
                      className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Projekttyp</label>
                    <FormSelect value={form.projectType} onChange={(v) => f("projectType", v)}
                      placeholder="Bitte wählen…"
                      options={projectTypes.map(t => ({ value: t, label: t }))} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">
                      {dept?.id === "post" ? "Projektstart *" : "Drehstart *"}
                    </label>
                    <input type="date" value={form.shoot_start} onChange={(e) => f("shoot_start", e.target.value)}
                      className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary focus:outline-none focus:border-gold transition-colors text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">
                      {dept?.id === "post" ? "Abgabe / Deadline" : "Drehende"}
                    </label>
                    <input type="date" value={form.shoot_end} onChange={(e) => f("shoot_end", e.target.value)}
                      min={form.shoot_start || undefined}
                      className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary focus:outline-none focus:border-gold transition-colors text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Vergütung *</label>
                  <div className="flex flex-wrap gap-2">
                    {["Bezahlt", "Deferred Pay", "Spesen & Reise", "Ehrenamtlich / Übung"].map((opt) => (
                      <button key={opt} onClick={() => f("pay_type", opt)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${form.pay_type === opt ? "bg-gold text-bg-primary border-gold" : "border-border text-text-secondary hover:border-gold/40"}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                  {!form.pay_type && <p className="text-xs text-amber-400 mt-1">Vergütung angeben erhöht die Bewerbungsrate deutlich</p>}
                </div>
                {(() => {
                  // Department-specific content warnings
                  // Only show what's actually relevant for each department
                  // Nacktheit / Intimszenen → NUR Vor der Kamera
                  const deptWarnings: Record<string, { key: string; label: string; hint?: string }[]> = {
                    "vor-der-kamera": [
                      { key: "content_nudity",  label: "Nacktheit / Intimszenen",      hint: "Nacktaufnahmen, Körperbetonung" },
                      { key: "content_violence", label: "Gewalt / Blut / Waffen",       hint: "Kampfszenen, Verletzungen" },
                      { key: "content_stunts",  label: "Stunts / körperliches Risiko", hint: "Akrobatik, Actionszenen" },
                    ],
                    regie: [
                      { key: "content_violence", label: "Gewalt / Blut / Waffen" },
                      { key: "content_stunts",  label: "Stunts / Action-Koordination" },
                    ],
                    kamera: [
                      { key: "content_violence", label: "Gewalt / Blut / Waffen" },
                      { key: "content_stunts",  label: "Stunts / Action-Setups" },
                    ],
                    licht: [
                      { key: "content_violence", label: "Gewalt / Blut / Waffen" },
                      { key: "content_stunts",  label: "Stunts / körperliches Risiko" },
                    ],
                    grip: [
                      { key: "content_stunts",  label: "Stunts / Rigging-Risiko", hint: "Aufbauten mit erhöhtem Sicherheitsaufwand" },
                    ],
                    ton: [
                      { key: "content_violence", label: "Gewalt / Blut / Waffen" },
                      { key: "content_stunts",  label: "Stunts / Action-Setups" },
                    ],
                    maske: [
                      { key: "content_violence", label: "SFX-Wunden / Blut / Prothesen", hint: "Verletzungs-Make-up, Latexarbeiten" },
                    ],
                    kostuem:    [],
                    szenenbild: [
                      { key: "content_violence", label: "Gewalt-Requisiten / Waffen / Blut", hint: "Set-Dekoration für Kampf- oder Tatortszenen" },
                      { key: "content_stunts",  label: "Stunt-Set / erhöhter Sicherheitsaufwand" },
                    ],
                    produktion: [
                      { key: "content_violence", label: "Gewalt / Blut / Waffen" },
                      { key: "content_stunts",  label: "Stunts / körperliches Risiko" },
                    ],
                    post: [
                      { key: "content_violence", label: "Explizites Material in Post", hint: "Rohschnitt enthält Gewalt oder explizite Szenen" },
                    ],
                  };

                  const warnings = dept ? (deptWarnings[dept.id] ?? []) : [
                    { key: "content_nudity",  label: "Nacktheit / Intimszenen" },
                    { key: "content_violence", label: "Gewalt / Blut / Waffen" },
                    { key: "content_stunts",  label: "Stunts / körperliches Risiko" },
                  ];

                  if (warnings.length === 0) return null;

                  return (
                    <div>
                      <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Inhaltliche Hinweise</label>
                      <p className="text-xs text-text-muted mb-2">Transparenz schützt alle Beteiligten — bitte ankreuzen wenn zutreffend.</p>
                      <div className="space-y-2">
                        {warnings.map(({ key, label, hint }) => (
                          <label key={key} className="flex items-start gap-3 cursor-pointer">
                            <div onClick={() => f(key, !form[key as keyof typeof form])}
                              className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer shrink-0 ${form[key as keyof typeof form] ? "bg-amber-500 border-amber-500" : "border-border bg-bg-elevated"}`}>
                              {form[key as keyof typeof form] && <CheckCircle size={12} className="text-white" />}
                            </div>
                            <div>
                              <span className="text-sm text-text-secondary">{label}</span>
                              {hint && <p className="text-[11px] text-text-muted">{hint}</p>}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <label className="flex items-center gap-3 cursor-pointer">
                  <div onClick={() => f("urgent", !form.urgent)}
                    className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 cursor-pointer ${form.urgent ? "bg-gold" : "bg-bg-elevated border border-border"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${form.urgent ? "translate-x-4" : ""}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">Dringend gesucht</p>
                    <p className="text-xs text-text-muted">Wird mit „Urgent“-Badge hervorgehoben</p>
                  </div>
                </label>
              </div>
            )}

            {/* ── CREATOR FIELDS ── */}
            {isCreator && dept && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">
                    Deine Rolle im Bereich {dept.label}
                  </label>
                  <RoleDropdown
                    value={form.skills}
                    onChange={(val) => f("skills", val)}
                    options={dept.roles}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Erfahrung</label>
                  <input value={form.experience} onChange={(e) => f("experience", e.target.value)}
                    placeholder="z.B. 5 Jahre, Kinofilm-Credits, Werbung"
                    className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors text-sm" />
                </div>
              </div>
            )}
            {isCreator && !dept && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Skills / Kenntnisse</label>
                  <input value={form.skills} onChange={(e) => f("skills", e.target.value)} placeholder="z.B. ARRI, Anamorphic, Low Light"
                    className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Erfahrung</label>
                  <input value={form.experience} onChange={(e) => f("experience", e.target.value)} placeholder="z.B. 5 Jahre, Kinofilm-Credits"
                    className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors text-sm" />
                </div>
              </div>
            )}

            {/* ── TITLE ── */}
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">
                {isAnimal ? animals("animalName") : isVehicle ? "Titel (optional)" : isJob ? "Anzeigentitel *" : isCreator ? "Dein Name *" : "Titel *"}
              </label>
              <input
                value={form.title}
                onChange={(e) => f("title", e.target.value)}
                placeholder={
                  isAnimal ? animals("animalName") : isVehicle ? "z.B. 1969 Ford Mustang Fastback" :
                  isLocation ? "z.B. Loft-Wohnung mit Industriecharme, Berlin Mitte" :
                  isJob ? (form.role_label ? `z.B. ${form.role_label} für Kurzfilm gesucht` : `z.B. ${dept?.label ?? ""}-Stelle für Kurzfilm`) :
                  isCreator ? "z.B. Max Müller" :
                  "z.B. ARRI Alexa 35 Komplettpaket"
                }
                className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors"
              />
            </div>

            {/* ── DESCRIPTION ── */}
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">
                {isJob ? "Beschreibung & Anforderungen" : isCreator ? "Kurzbiografie / Über mich" : "Beschreibung"}
              </label>
              <textarea
                value={form.description}
                onChange={(e) => f("description", e.target.value)}
                rows={4}
                placeholder={
                  isJob ? "Was wird erwartet? Anforderungen, Ausstattung, besondere Bedingungen…" :
                  isCreator ? "Erfahrungen, Credits, Arbeitsstil, Verfügbarkeit…" :
                  isLocation ? "Besonderheiten, Ausstattung, Parkplätze, Strom, Verfügbarkeit…" :
                  "Zustand, Besonderheiten, Verfügbarkeit, Lieferung möglich…"
                }
                className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors resize-none"
              />
            </div>

            {(type === "prop" || type === "vehicle") && <MarketplaceOfferFields value={marketplace} vehicleOnly={type === "vehicle"} onChange={value=>{setMarketplace(value);if(value.category)setSelected(marketplaceItem(value.category));}} />}

            {/* ── CONDITION + EXTRAS (props only) ── */}
            {(isLocation || selected.type === "prop") && (
              <ProductionCreditsEditor
                value={productionCredits}
                onChange={setProductionCredits}
                heading={isLocation ? "Drehhistorie dieser Location" : "In Produktionen eingesetzt"}
                description={isLocation
                  ? "Zeige, welche Filme, Serien, Werbungen oder Shootings bereits hier gedreht wurden."
                  : "Zeige, in welchen Filmen, Werbungen oder Shootings dieser Artikel bereits eingesetzt wurde – mit Fotos vom Set."}
              />
            )}

            {isAnimal && <p className="text-sm leading-6 text-text-muted">{animals("portfolioHelp")}</p>}
            {/* ── PRICE + CITY ── */}
            <div className={`grid gap-4 ${type === "prop" || type === "vehicle" ? "grid-cols-1" : "grid-cols-2"}`}>
              <div>
                {type === "prop" || type === "vehicle" ? null : isAnimal ? <p className="text-sm text-text-secondary">{animals("conditions")}</p> : isLocation ? (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest">Preis</label>
                    <ListingPriceOptions onRequest={locPriceOnRequest} negotiable={priceNegotiable} onChange={value=>{setLocPriceOnRequest(value.priceOnRequest);setPriceNegotiable(value.priceNegotiable);}} />
                    {!locPriceOnRequest && <label className="block text-xs text-text-muted">Preis pro Drehtag (€)
                      <input type="number" min="0" value={form.price} onChange={(e) => f("price", e.target.value)} placeholder="z. B. 500" className="mt-1 w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-gold focus:outline-none" />
                    </label>}
                  </div>
                ) : (
                  <>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">
                      {isJob ? "Gage / Tag (€) — 0 = Auf Anfrage" : isCreator ? "Tagesrate (€)" : form.rental_type === "kauf" ? "Kaufpreis (€) *" : "Preis / Tag (€) *"}
                    </label>
                    {!isJob && !isCreator && <label className="mb-2 flex min-h-11 items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={priceNegotiable} onChange={event=>{setPriceNegotiable(event.target.checked);if(event.target.checked)setLocPriceOnRequest(false);}} />VB – Verhandlungsbasis (Betrag optional)</label>}
                    <input type="number" min="0" value={form.price} onChange={(e) => f("price", e.target.value)} placeholder={isJob || isCreator ? "z. B. 500" : form.rental_type === "kauf" ? "z. B. 1200" : "z. B. 800"} className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-gold focus:outline-none" />
                  </>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">
                  {isJob ? "Ort *" : "Stadt *"}
                </label>
                <input
                  value={form.city}
                  onChange={(e) => f("city", e.target.value)}
                  placeholder={isJob ? "z.B. Berlin oder Remote" : "z.B. Berlin"}
                  className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>

            {/* ── IMAGE UPLOAD ── */}
            <div>
              {selected?.type === "prop" || selected?.type === "vehicle" || selected?.type === "animal" ? (
                <div className="space-y-3">
                  <ListingImageManager
                    value={articleImages}
                    onChange={(urls) => {
                      if (articleImages[0] !== urls[0]) setFocalPoint(null);
                      setArticleImages(urls);
                    }}
                    onStatusChange={setArticleGalleryState}
                    label={isAnimal ? animals("gallery") : "Artikelbilder"}
                  />
                  {articleImages[0] && (
                    <button
                      type="button"
                      onClick={() => setShowFocalPicker(true)}
                      className="flex min-h-10 items-center gap-2 rounded-lg border border-gold/30 px-3 py-2 text-xs text-gold transition-colors hover:border-gold"
                    >
                      <ImageIcon size={12} />
                      {focalPoint ? "Fokuspunkt des Hauptbilds ändern" : "Fokuspunkt für das Hauptbild setzen"}
                    </button>
                  )}
                </div>
              ) : selected?.type === "location" ? (
                <div className="space-y-2">
                  <ListingImageManager
                    value={locExtraImages}
                    maxImages={MAX_LOCATION_IMAGES}
                    onChange={(urls) => {
                      if (locExtraImages[0] !== urls[0]) setFocalPoint(null);
                      setLocExtraImages(urls);
                    }}
                    onStatusChange={setLocationGalleryState}
                    label="Locationfotos"
                  />
                  {locExtraImages[0] && <button type="button" onClick={() => setShowFocalPicker(true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gold/30 px-3 py-2 text-xs text-gold transition-colors hover:border-gold"><ImageIcon size={12} />{focalPoint ? "Fokuspunkt des Hauptbilds ändern" : "Fokuspunkt des Hauptbilds setzen"}</button>}
                </div>
              ) : (
                <>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">
                {optionalMedia("cover")}
              </label>
              <p className="mb-3 text-xs text-text-muted">{optionalMedia("hint")}</p>
              {imagePreview ? (
                <div className="space-y-2">
                  <div className="relative rounded-xl overflow-hidden border border-border aspect-video w-full">
                    <UnoptimizedImage
                      src={imagePreview}
                      alt="Vorschau"
                      className="w-full h-full object-cover"
                      style={{ objectPosition: focalPoint ? `${focalPoint.x}% ${focalPoint.y}%` : "50% 50%" }}
                    />
                    {uploading && (
                      <div className="absolute inset-0 bg-bg-primary/70 flex items-center justify-center">
                        <Loader2 size={24} className="animate-spin text-gold" />
                      </div>
                    )}
                    {!uploading && (
                      <button
                        onClick={removeImage}
                        className="absolute top-2 right-2 w-7 h-7 bg-bg-primary/80 rounded-full flex items-center justify-center hover:bg-crimson transition-colors"
                      >
                        <X size={14} className="text-white" />
                      </button>
                    )}
                    {imageUrl && (
                      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-success/20 border border-success/30 text-success text-xs px-2 py-1 rounded-full">
                        <CheckCircle size={11} /> Hochgeladen
                      </div>
                    )}
                  </div>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setShowFocalPicker(true)}
                      className="flex items-center gap-2 text-xs text-gold hover:text-gold-light border border-gold/30 hover:border-gold px-3 py-1.5 rounded-lg transition-colors w-fit"
                    >
                      <ImageIcon size={12} />
                      {focalPoint ? "Fokuspunkt ändern" : "Fokuspunkt setzen"} — wo soll das Hauptmotiv sichtbar sein?
                    </button>
                  )}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-3 w-full border-2 border-dashed border-border rounded-xl py-10 cursor-pointer hover:border-gold/50 transition-colors group">
                  <div className="w-12 h-12 rounded-full bg-bg-elevated border border-border flex items-center justify-center group-hover:border-gold transition-colors">
                    <ImageIcon size={20} className="text-text-muted group-hover:text-gold transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-text-primary">Bild auswählen</p>
                    <p className="text-xs text-text-muted mt-0.5">JPG, PNG, WEBP oder HEIC · wird automatisch verkleinert</p>
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>
              )}
                </>
              )}
            </div>

            {/* ── HINT ── */}
            <div className="p-4 bg-bg-secondary border border-border rounded-xl text-sm text-text-muted">
              <p className="font-semibold text-text-secondary mb-1">Kostenlos inserieren</p>
              <p>CineGenius ist vollständig kostenlos — keine Provision, keine Gebühren.</p>
            </div>

            </div>
            {error && (
              <div className="flex items-start gap-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* ── SUBMIT ── */}
            <button
              onClick={() => handleSubmit()}
              disabled={!listingDraft.loaded || !canSubmit() || loading || uploading || ((selected?.type === "prop" || selected?.type === "vehicle" || selected?.type === "animal") && (articleGalleryState.uploading || articleGalleryState.failed > 0)) || (selected?.type === "location" && (locationGalleryState.uploading || locationGalleryState.failed > 0))}
              className="w-full py-4 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> {savingPrivate ? marketText("savingDraft") : selected?.type === "job" || selected?.type === "location" ? "Entwurf wird gespeichert…" : (selected?.type === "prop" || selected?.type === "vehicle") && responsible.profileName ? marketplaceText("publishing") : moderation("submitting")}</>
              ) : (
                <>{(type === "prop" || type === "vehicle") && !marketReview ? marketText("review") : selected?.type === "job" ? "Als Entwurf speichern" : selected?.type === "location" ? "Entwurf speichern und prüfen" : (selected?.type === "prop" || selected?.type === "vehicle") && responsible.profileName ? marketplaceText("publish") : moderation("submit")} <ArrowRight size={18} /></>
              )}
            </button>
            {(type === "prop" || type === "vehicle") && <button type="button" disabled={loading || uploading || articleGalleryState.uploading || articleGalleryState.failed>0} className="min-h-11 w-full rounded-xl border border-border px-4 py-3 text-sm" onClick={()=>handleSubmit(true)}>{marketText("saveDraft")}</button>}
          </div>
        </div>
      </div>
    {showFocalPicker && (imageUrl || articleImages[0] || locExtraImages[0]) && (
      <FocalPointPicker
        imageUrl={articleImages[0] ?? locExtraImages[0] ?? imageUrl ?? ""}
        initial={focalPoint ?? undefined}
        onSave={(pt) => { setFocalPoint(pt); setShowFocalPicker(false); }}
        onClose={() => setShowFocalPicker(false)}
      />
    )}
      </>
    );
  }

  // ── STEP 3 — SUCCESS ─────────────────────────────────────────────────────────
  return (
    <div className="pt-16 min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 text-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${createdIsDraft ? "bg-gold/10 border border-gold/20" : "bg-success/10 border border-success/20"}`}>
          <CheckCircle size={40} className={createdIsDraft ? "text-gold" : "text-success"} />
        </div>
        {createdIsDraft && <ResponsiblePersonFields value={responsible} onChange={setResponsible} errors={responsibleErrors} accountPrefill compactWhenProfile={selected?.type === "prop" || selected?.type === "vehicle"} />}
        <h2 className="font-display text-3xl font-bold text-text-primary mb-3">{createdPublished ? marketplaceText("publishedTitle") : error && (selected?.type === "prop" || selected?.type === "vehicle") ? marketplaceText("savedTitle") : moderation(createdIsDraft ? "draftSaved" : "statuses.pending")}</h2>
        <p className="text-text-muted mb-8">
          {createdPublished ? marketplaceText("published") : error && (selected?.type === "prop" || selected?.type === "vehicle") ? marketplaceText("saveError") : (createdIsDraft && (selected?.type === "prop" || selected?.type === "vehicle") ? marketText("privateNotice") : moderation(createdIsDraft ? "privateNotice" : "submitted"))}
        </p>
        {error && <p role="alert" className="mb-5 text-sm text-red-400">{error}</p>}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => {
              setStep(1);
              setSelected(null);
              setMarketReview(false);setMarketplace(marketplaceDraft());setArticleImages([]);
              setError("");
              setImageUrl(null);
              setImagePreview(null);
              setPendingImageFile(null);
              setCreatedId(null);
              setCreatedIsDraft(false); setCreatedPublished(false);
              setForm({ title: "", description: "", price: "", city: "", make: "", model: "", year: "", fuel_type: "", license_class: "", condition: "", vehicle_subtype: "", sqm: "", ceiling_height: "", max_crew: "", indoor_outdoor: "innen", power_available: false, power_details: "", parking_spots: "", natural_light: false, blackout_possible: false, loading_access: false, access_notes: "", shooting_hours: "", availability_notes: "", company: "", projectType: "", shoot_start: "", shoot_end: "", pay_type: "", role_label: "", urgent: false, content_nudity: false, content_violence: false, content_stunts: false, delivery: false, rental_type: "miete", dimensions: "", safety_note: "", skills: "", experience: "", animal_training: "", animal_handler: true, animal_count: "1", animal_skills: "" });
              setLocAmenities([]); setLocBlockedDates([]); setLocExtraImages([]); setLocFloorPlanUrl(null); setLocFloorPlanPreview(null);
              setLocRooms([]); setLocPriceOnRequest(true); setPriceNegotiable(false); setSelectedCompanyId(""); setFocalPoint(null);
              setArticleImages([]); setLocationGalleryState({ uploading: false, failed: 0 }); setArticleGalleryState({ uploading: false, failed: 0 });
            }}
            className="px-6 py-3 border border-border text-text-secondary rounded-xl hover:border-gold hover:text-gold transition-all text-sm font-medium"
          >
            {moderation("another")}
          </button>
          {createdIsDraft ? (
            <>
              {selected?.type === "location" ? (
                <a href="/dashboard?tab=listings" className="px-6 py-3 border border-border text-text-secondary rounded-xl hover:border-gold hover:text-gold transition-all text-sm font-medium">Später im Dashboard bearbeiten</a>
              ) : (
                <a href={`${successHref(createdId)}?preview=1`} target="_blank" rel="noreferrer" className="px-6 py-3 border border-border text-text-secondary rounded-xl hover:border-gold hover:text-gold transition-all text-sm font-medium">Vorschau ansehen</a>
              )}
              <button type="button" onClick={handlePublishDraft} disabled={publishingDraft} className="px-6 py-3 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm disabled:opacity-50">
                {!publishingDraft && (selected?.type === "prop" || selected?.type === "vehicle") && responsible.profileName ? marketplaceText("publish") : moderation(publishingDraft ? "submitting" : "submit")}
              </button>
            </>
          ) : (
            <a href={createdPublished ? successHref(createdId) : "/dashboard?tab=listings"} className="px-6 py-3 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm">
              {createdPublished ? marketplaceText("view") : moderation("myOffers")}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
