"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import ProfileGuard from "@/components/ProfileGuard";
import {
  Package, Car, Shirt, Camera, Lightbulb, Mic, Layers, Wrench,
  Home, Building2, TreePine, Clapperboard, MapPin,
  User, Users, GraduationCap, Briefcase, Sparkles, Scissors,
  ArrowRight, CheckCircle, Loader2, AlertTriangle, ChevronLeft, ChevronDown,
  Shield, Radio, Coffee, Truck, Monitor, Box, ClipboardList,
  Film, Palette, Drama, Upload, X, ImageIcon,
  Smartphone, Video, Aperture,
} from "lucide-react";
import { FILM_DEPARTMENTS } from "@/lib/filmRoles";
import { PROP_CATEGORY_FIELDS } from "@/lib/propCategoryFields";

// ─── Types ───────────────────────────────────────────────────────────────────

type LucideIcon = React.ElementType;

type CategoryItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  type: "creator" | "job" | "prop" | "vehicle" | "location";
  category: string;
  color: string;
  bg: string;
};

type Group = { id: string; label: string; desc: string; color: string; border: string; items: CategoryItem[] };

// ─── Custom Role Dropdown ────────────────────────────────────────────────────

type RoleOption = { id: string; label: string; labelEn?: string };

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.label === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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
        <div className="absolute z-50 top-full mt-1.5 left-0 right-0 bg-bg-secondary border border-border rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { onChange(opt.label); setOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors hover:bg-bg-elevated ${
                opt.label === value ? "text-gold bg-gold/5" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <span>{opt.label}</span>
              <span className="flex items-center gap-2 shrink-0 ml-2">
                {opt.labelEn && (
                  <span className="text-[11px] text-text-muted hidden sm:block">{opt.labelEn}</span>
                )}
                {opt.label === value && <CheckCircle size={13} className="text-gold" />}
              </span>
            </button>
          ))}
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
      { id: "mk_kostuem",        label: "Kostüme & Garderobe",    icon: Shirt,       type: "prop",    category: "Kostüme",              color: "text-rose-400",    bg: "bg-rose-500/10 border-rose-500/20" },
      { id: "mk_requisiten",     label: "Requisiten",             icon: Package,     type: "prop",    category: "Requisiten",           color: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/20" },
      { id: "mk_fahrzeuge",      label: "Bild-Fahrzeuge",         icon: Car,         type: "vehicle", category: "Bild-Fahrzeug",        color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20" },
      { id: "mk_moebel",         label: "Möbel & Szenenbild",     icon: Layers,      type: "prop",    category: "Möbel / Szenenbild",   color: "text-indigo-400",  bg: "bg-indigo-500/10 border-indigo-500/20" },
      { id: "mk_kamera",         label: "Kameraequipment",        icon: Camera,      type: "prop",    category: "Kameraequipment",      color: "text-sky-400",     bg: "bg-sky-500/10 border-sky-500/20" },
      { id: "mk_licht",          label: "Lichttechnik",           icon: Lightbulb,   type: "prop",    category: "Lichttechnik",         color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
      { id: "mk_ton",            label: "Ton & Audio",            icon: Mic,         type: "prop",    category: "Ton & Audio",          color: "text-teal-400",    bg: "bg-teal-500/10 border-teal-500/20" },
      { id: "mk_grip",           label: "Grip & Rigging",         icon: Wrench,      type: "prop",    category: "Grip & Rigging",       color: "text-slate-400",   bg: "bg-slate-500/10 border-slate-500/20" },
      { id: "mk_produktion",     label: "Produktionsausstattung", icon: Box,         type: "prop",    category: "Produktionsausstattung",color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
      // Foto Equipment
      { id: "mk_fotoequipment",  label: "Fotoequipment",          icon: Aperture,    type: "prop",    category: "Fotoequipment",        color: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/20" },
      { id: "mk_backdrops",      label: "Backdrops & Hintergründe",icon: ImageIcon,  type: "prop",    category: "Backdrops",            color: "text-lime-400",    bg: "bg-lime-500/10 border-lime-500/20" },
      // Creator / Social
      { id: "mk_contentsets",    label: "Content Sets",           icon: Smartphone,  type: "prop",    category: "Content Sets",         color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20" },
    ],
  },
  {
    id: "drehorte",
    label: "Drehorte",
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
  "Fashion Shooting", "Produkt-Shooting", "Event-Fotografie", "Portrait-Shooting", "Werbe-Fotografie",
  "Sonstiges",
];
const conditionOptions = ["Neuwertig", "Sehr gut", "Gut", "Akzeptabel"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function InseratPage() {
  const router = useRouter();
  const { userId, isLoaded } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CategoryItem | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null); // null = main view
  const [dropdownId, setDropdownId] = useState("");
  // Category-specific metadata (dynamic per prop category)
  const [catMeta, setCatMeta] = useState<Record<string, string>>({});
  const setCatField = (key: string, value: string) =>
    setCatMeta((prev) => ({ ...prev, [key]: value }));

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Location extras
  const [locAmenities, setLocAmenities] = useState<string[]>([]);
  const [locBlockedDates, setLocBlockedDates] = useState<string[]>([]);
  const [locExtraImages, setLocExtraImages] = useState<string[]>([]);
  const [locFloorPlanUrl, setLocFloorPlanUrl] = useState<string | null>(null);
  const [locFloorPlanPreview, setLocFloorPlanPreview] = useState<string | null>(null);
  const [locExtraUploading, setLocExtraUploading] = useState(false);
  const [locFloorUploading, setLocFloorUploading] = useState(false);
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
    // location
    sqm: "",
    ceiling_height: "",
    max_crew: "",
    indoor_outdoor: "innen" as "innen" | "außen" | "beides",
    power_available: false,
    power_details: "",
    parking_spots: "",
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

  const f = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  function handleSelect(item: CategoryItem) {
    setSelected(item);
    setCatMeta({});
    setStep(2);
  }

  function buildPayload() {
    if (!selected) return null;
    const { type, category } = selected;

    if (type === "vehicle") {
      return {
        type,
        category,
        title: form.title || `${form.make} ${form.model}${form.year ? ` (${form.year})` : ""}`.trim(),
        description: form.description || "",
        price: parseFloat(form.price) || 0,
        city: form.city,
        metadata: {
          make: form.make || null,
          model: form.model || null,
          year: form.year ? parseInt(form.year) : null,
          fuel_type: form.fuel_type || null,
          license_class: form.license_class || null,
          condition: form.condition || null,
          delivery: form.delivery,
        },
      };
    }

    if (type === "location") {
      return {
        type,
        category,
        title: form.title,
        description: form.description || "",
        price: parseFloat(form.price) || 0,
        city: form.city,
        metadata: {
          sqm: form.sqm ? parseFloat(form.sqm) : null,
          ceiling_height_m: form.ceiling_height ? parseFloat(form.ceiling_height) : null,
          max_crew: form.max_crew ? parseInt(form.max_crew) : null,
          indoor_outdoor: form.indoor_outdoor,
          power_available: form.power_available,
          power_details: form.power_details || null,
          parking_spots: form.parking_spots ? parseInt(form.parking_spots) : null,
          amenities: locAmenities,
        },
        blocked_dates: locBlockedDates,
        floor_plan_url: locFloorPlanUrl,
        extra_images: locExtraImages,
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

    // prop
    // Build category-specific metadata (only non-empty values)
    const catMetaFiltered = Object.fromEntries(
      Object.entries(catMeta).filter(([, v]) => v !== "")
    );
    return {
      type,
      category,
      title: form.title,
      description: form.description || "",
      price: parseFloat(form.price) || 0,
      city: form.city,
      rental_type: form.rental_type,
      metadata: {
        condition: form.condition || null,
        delivery: form.delivery,
        dimensions: form.dimensions || null,
        safety_note: form.safety_note || null,
        ...catMetaFiltered,
      },
    };
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImagePreview(URL.createObjectURL(file));
    setUploading(true);
    setError("");

    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json();
    setUploading(false);

    if (!res.ok) { setError(json.error ?? "Upload fehlgeschlagen"); setImagePreview(null); return; }
    setImageUrl(json.url);
  }

  function removeImage() {
    setImageUrl(null);
    setImagePreview(null);
  }

  async function handleSubmit() {
    if (!userId) { router.push("/sign-in"); return; }
    const payload = buildPayload();
    if (!payload) return;

    setLoading(true);
    setError("");

    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, image_url: imageUrl }),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) { setError(json.error ?? "Fehler beim Speichern"); return; }
    setCreatedId(json.data?.id ?? null);
    setStep(3);
  }

  const successHref = (id?: string | null) => {
    if (!selected) return "/";
    const base = selected.type === "location" ? "/locations"
      : selected.type === "vehicle" ? "/vehicles"
      : selected.type === "job" ? "/jobs"
      : selected.type === "creator" ? "/creators"
      : "/props";
    return id ? `${base}/${id}` : base;
  };

  const canSubmit = () => {
    if (!selected) return false;
    const { type } = selected;
    const hasCity = form.city.trim() !== "";
    if (type === "vehicle") return (form.make.trim() || form.title.trim()) && hasCity;
    if (type === "job") return form.role_label.trim() && form.title.trim() && hasCity && form.shoot_start !== "";
    if (type === "creator") return form.title.trim() && hasCity;
    return form.title.trim() && hasCity;
  };

  if (!isLoaded) return null;
  if (!userId) { router.push("/sign-in"); return null; }

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
      sub: "Drehorte · Fotostudios · Studios",
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
  ];

  const currentGroup = activeGroup ? groups.find((g) => g.id === activeGroup) ?? null : null;

  if (step === 1) {
    return (<ProfileGuard>
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
              {activeGroup ? currentGroup?.label : "Was möchtest du inserieren?"}
            </h1>
            <p className="text-text-muted text-sm">
              {activeGroup ? "Wähle eine Kategorie aus." : "Wähle einen Bereich — der Rest passt sich an."}
            </p>
          </div>

          {/* Main category tiles */}
          {!activeGroup && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {mainTiles.map((tile) => (
                <button
                  key={tile.id}
                  onClick={() => setActiveGroup(tile.id)}
                  className={`group flex sm:flex-col items-center sm:items-start gap-4 sm:gap-0 p-5 rounded-2xl border-2 transition-all text-left ${tile.bg} ${tile.border}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-bg-secondary`}>
                    <tile.icon size={20} className={tile.color} />
                  </div>
                  <p className="font-semibold text-text-primary text-sm mb-0.5">{tile.label}</p>
                  <p className="text-xs text-text-muted leading-relaxed">{tile.sub}</p>
                </button>
              ))}
            </div>
          )}

          {/* Sub-category grid */}
          {activeGroup && currentGroup && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {currentGroup.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`group flex flex-col items-center gap-2.5 p-4 rounded-xl border border-border bg-bg-secondary hover:bg-bg-elevated hover:border-current transition-all text-center ${item.color}`}
                >
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${item.bg}`}>
                    <item.icon size={18} className={item.color} />
                  </div>
                  <span className="text-xs font-semibold text-text-primary leading-snug group-hover:text-current transition-colors">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          )}

        </div>
      </div>
    </ProfileGuard>);
  }

  // ── STEP 2 ──────────────────────────────────────────────────────────────────
  if (step === 2 && selected) {
    const { type, label, icon: Icon, color, bg } = selected;
    const isVehicle = type === "vehicle";
    const isLocation = type === "location";
    const isJob = type === "job";
    const isCreator = type === "creator";

    // Derive which FILM_DEPARTMENT this item belongs to
    const deptId = selected.id.replace(/^(job_|crew_)/, "");
    const dept = FILM_DEPARTMENTS.find((d) => d.id === deptId) ?? null;

    return (<ProfileGuard>
      <div className="pt-16 min-h-screen bg-bg-primary">
        <div className="max-w-2xl mx-auto px-4 py-10">

          {/* Header */}
          <button onClick={() => { setStep(1); setSelected(null); setDropdownId(""); setImageUrl(null); setImagePreview(null); }} className="flex items-center gap-1.5 text-text-muted hover:text-text-primary text-sm mb-6 transition-colors">
            <ChevronLeft size={16} /> Zurück zur Auswahl
          </button>

          <div className="flex items-center gap-3 mb-8">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${bg}`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-gold font-semibold">Inserat erstellen</p>
              <h1 className="font-display text-2xl font-bold text-text-primary">{label}</h1>
            </div>
          </div>

          <div className="space-y-5">

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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Kraftstoff</label>
                    <select value={form.fuel_type} onChange={(e) => f("fuel_type", e.target.value)}
                      className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary focus:outline-none focus:border-gold transition-colors text-sm">
                      <option value="">Bitte wählen…</option>
                      {["Benzin", "Diesel", "Elektro", "Hybrid", "LPG", "Sonstiges"].map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Führerscheinklasse</label>
                    <select value={form.license_class} onChange={(e) => f("license_class", e.target.value)}
                      className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary focus:outline-none focus:border-gold transition-colors text-sm">
                      <option value="">Bitte wählen…</option>
                      {["B", "BE", "C", "CE", "D", "A", "Keine (stationär / Requisite)"].map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div onClick={() => f("delivery", !form.delivery)}
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${form.delivery ? "bg-gold" : "bg-border"}`}>
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.delivery ? "left-5" : "left-1"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">Lieferung zum Set möglich</p>
                    <p className="text-xs text-text-muted">Das Fahrzeug kann zum Drehort geliefert werden</p>
                  </div>
                </label>
              </div>
            )}

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
                        setLocFloorPlanPreview(URL.createObjectURL(file));
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

                {/* Weitere Fotos */}
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Weitere Fotos</label>
                  <div className="flex flex-wrap gap-2">
                    {locExtraImages.map((url, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setLocExtraImages(prev => prev.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 w-5 h-5 bg-bg-primary/80 rounded-full flex items-center justify-center text-[10px] text-text-muted hover:text-crimson-light">✕</button>
                      </div>
                    ))}
                    <label className={`w-20 h-20 flex flex-col items-center justify-center rounded-lg border border-dashed border-border cursor-pointer hover:border-gold transition-colors text-text-muted text-xs ${locExtraUploading ? "opacity-60 pointer-events-none" : ""}`}>
                      {locExtraUploading ? <span className="animate-spin text-gold text-lg">⟳</span> : <><span className="text-2xl leading-none mb-1">+</span><span>Foto</span></>}
                      <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                        const files = Array.from(e.target.files ?? []); if (!files.length) return;
                        setLocExtraUploading(true);
                        for (const file of files) {
                          const fd = new FormData(); fd.append("file", file);
                          const res = await fetch("/api/upload", { method: "POST", body: fd });
                          const json = await res.json();
                          if (json.url) setLocExtraImages(prev => [...prev, json.url]);
                        }
                        setLocExtraUploading(false);
                        if (e.target) e.target.value = "";
                      }} />
                    </label>
                  </div>
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
                    <select value={form.projectType} onChange={(e) => f("projectType", e.target.value)}
                      className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary focus:outline-none focus:border-gold transition-colors text-sm">
                      <option value="">Bitte wählen…</option>
                      {projectTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
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
                    <p className="text-xs text-text-muted">Wird mit "Urgent"-Badge hervorgehoben</p>
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

            {/* ── CATEGORY-SPECIFIC FIELDS (props only) ── */}
            {type === "prop" && (() => {
              const configKey = selected.id.replace("mk_", "");
              const config = PROP_CATEGORY_FIELDS[configKey];
              if (!config) return null;
              return (
                <div className="space-y-4 pb-2 border-b border-border/60">
                  {config.fields.map((field) => {
                    if (field.type === "select" && field.options) {
                      return (
                        <div key={field.key}>
                          <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">{field.label}</label>
                          <div className="flex gap-2 flex-wrap">
                            {field.options.map((opt) => (
                              <button key={opt} type="button"
                                onClick={() => setCatField(field.key, catMeta[field.key] === opt ? "" : opt)}
                                className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${catMeta[field.key] === opt ? "bg-gold text-bg-primary border-gold" : "border-border text-text-secondary hover:border-gold/40"}`}>
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    if (field.type === "text") {
                      return (
                        <div key={field.key}>
                          <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">{field.label}</label>
                          <input
                            value={catMeta[field.key] ?? ""}
                            onChange={(e) => setCatField(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors text-sm"
                          />
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              );
            })()}

            {/* ── CONDITION + EXTRAS (props only) ── */}
            {type === "prop" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Zustand</label>
                  <div className="flex gap-2 flex-wrap">
                    {conditionOptions.map((c) => (
                      <button key={c} onClick={() => f("condition", c)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${form.condition === c ? "bg-gold text-bg-primary border-gold" : "border-border text-text-secondary hover:border-gold/40"}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Angebotsart</label>
                  <div className="flex gap-2">
                    {(["miete", "kauf"] as const).map((t) => (
                      <button key={t} onClick={() => f("rental_type", t)}
                        className={`px-4 py-2 rounded-lg text-sm border transition-all ${form.rental_type === t ? "bg-gold text-bg-primary border-gold" : "border-border text-text-secondary hover:border-gold/40"}`}>
                        {t === "miete" ? "Verleih / Miete" : "Verkauf"}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div onClick={() => f("delivery", !form.delivery)}
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${form.delivery ? "bg-gold" : "bg-border"}`}>
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.delivery ? "left-5" : "left-1"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">Lieferung möglich</p>
                    <p className="text-xs text-text-muted">Ich kann den Artikel zum Set liefern</p>
                  </div>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Maße / Abmessungen</label>
                    <input value={form.dimensions} onChange={(e) => f("dimensions", e.target.value)} placeholder="z.B. 80 × 60 × 40 cm"
                      className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Sicherheitshinweis</label>
                    <input value={form.safety_note} onChange={(e) => f("safety_note", e.target.value)} placeholder="z.B. Scharfe Kanten, nur mit PSA"
                      className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors text-sm" />
                  </div>
                </div>
              </div>
            )}

            {/* ── TITLE ── */}
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">
                {isVehicle ? "Titel (optional)" : isJob ? "Anzeigentitel *" : isCreator ? "Dein Name *" : "Titel *"}
              </label>
              <input
                value={form.title}
                onChange={(e) => f("title", e.target.value)}
                placeholder={
                  isVehicle ? "z.B. 1969 Ford Mustang Fastback" :
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

            {/* ── PRICE + CITY ── */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">
                  {isJob ? "Gage / Tag (€) — 0 = Auf Anfrage" : isCreator ? "Tagesrate (€)" : "Preis / Tag (€) *"}
                </label>
                <input
                  type="number" min="0"
                  value={form.price}
                  onChange={(e) => f("price", e.target.value)}
                  placeholder={isJob || isCreator ? "z.B. 500" : "z.B. 800"}
                  className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors"
                />
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
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">
                Titelbild
              </label>
              {imagePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-border aspect-video w-full">
                  <img src={imagePreview} alt="Vorschau" className="w-full h-full object-cover" />
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
              ) : (
                <label className="flex flex-col items-center justify-center gap-3 w-full border-2 border-dashed border-border rounded-xl py-10 cursor-pointer hover:border-gold/50 transition-colors group">
                  <div className="w-12 h-12 rounded-full bg-bg-elevated border border-border flex items-center justify-center group-hover:border-gold transition-colors">
                    <ImageIcon size={20} className="text-text-muted group-hover:text-gold transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-text-primary">Bild auswählen</p>
                    <p className="text-xs text-text-muted mt-0.5">JPG, PNG oder WEBP · max. 10 MB</p>
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>
              )}
            </div>

            {/* ── HINT ── */}
            <div className="p-4 bg-bg-secondary border border-border rounded-xl text-sm text-text-muted">
              <p className="font-semibold text-text-secondary mb-1">Kostenlos inserieren</p>
              <p>CineGenius ist vollständig kostenlos — keine Provision, keine Gebühren.</p>
            </div>

            {error && (
              <div className="flex items-start gap-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* ── SUBMIT ── */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit() || loading || uploading}
              className="w-full py-4 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> Wird veröffentlicht…</>
              ) : (
                <>Jetzt veröffentlichen <ArrowRight size={18} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </ProfileGuard>);
  }

  // ── STEP 3 — SUCCESS ─────────────────────────────────────────────────────────
  return (<ProfileGuard>
    <div className="pt-16 min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 text-center">
        <div className="w-20 h-20 bg-success/10 border border-success/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={40} className="text-success" />
        </div>
        <h2 className="font-display text-3xl font-bold text-text-primary mb-3">Veröffentlicht!</h2>
        <p className="text-text-muted mb-8">
          Dein Inserat ist jetzt live und für Produktionen sichtbar.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => {
              setStep(1);
              setSelected(null);
              setError("");
              setDropdownId("");
              setImageUrl(null);
              setImagePreview(null);
              setForm({ title: "", description: "", price: "", city: "", make: "", model: "", year: "", fuel_type: "", license_class: "", condition: "", sqm: "", ceiling_height: "", max_crew: "", indoor_outdoor: "innen", power_available: false, power_details: "", parking_spots: "", company: "", projectType: "", shoot_start: "", shoot_end: "", pay_type: "", role_label: "", urgent: false, content_nudity: false, content_violence: false, content_stunts: false, delivery: false, rental_type: "miete", dimensions: "", safety_note: "", skills: "", experience: "" });
              setLocAmenities([]); setLocBlockedDates([]); setLocExtraImages([]); setLocFloorPlanUrl(null); setLocFloorPlanPreview(null);
            }}
            className="px-6 py-3 border border-border text-text-secondary rounded-xl hover:border-gold hover:text-gold transition-all text-sm font-medium"
          >
            Weiteres Inserat
          </button>
          <a href={successHref(createdId)} className="px-6 py-3 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm">
            Inserat ansehen
          </a>
        </div>
      </div>
    </div>
  </ProfileGuard>);
}
