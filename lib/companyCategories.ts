/**
 * CineGenius — Firmen-Kategorien
 * Single source of truth für alle Dienstleistungsbereiche von Firmen.
 */

export type CompanyCategory = {
  id: string;
  label: string;
  color: string;
  bg: string;
  examples: string; // Kurzbeschreibung für UI
};

export const COMPANY_CATEGORIES: CompanyCategory[] = [
  { id: "lichtverleih",       label: "Lichtverleih",         color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20",   examples: "HMI, LED, Daylight" },
  { id: "kameraverleih",      label: "Kameraverleih",        color: "text-sky-400",     bg: "bg-sky-500/10 border-sky-500/20",       examples: "ARRI, RED, Blackmagic" },
  { id: "tonverleih",         label: "Ton & Audio",          color: "text-teal-400",    bg: "bg-teal-500/10 border-teal-500/20",     examples: "Wireless, Boom, Mixer" },
  { id: "grip-verleih",       label: "Grip & Rigging",       color: "text-slate-400",   bg: "bg-slate-500/10 border-slate-500/20",   examples: "Dolly, Kran, Track" },
  { id: "tonstudio",          label: "Tonstudio",            color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20", examples: "Aufnahme, Mix, Mastering" },
  { id: "kostumfundus",       label: "Kostümfundus",         color: "text-rose-400",    bg: "bg-rose-500/10 border-rose-500/20",     examples: "Historisch, Modern, Spezial" },
  { id: "requisite",          label: "Requisite & Ausstattung", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20", examples: "Möbel, Props, Set-Dressing" },
  { id: "filmproduktion",     label: "Filmproduktion",       color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", examples: "Full-Service, Line Producer" },
  { id: "postproduktion",     label: "Postproduktion",       color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20",     examples: "Schnitt, Color, VFX" },
  { id: "casting-agentur",    label: "Casting-Agentur",      color: "text-pink-400",    bg: "bg-pink-500/10 border-pink-500/20",     examples: "Talent, Komparsen, Stunt" },
  { id: "location-agentur",   label: "Location-Agentur",     color: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/20",     examples: "Objekte, Außengelände, Studios" },
  { id: "vfx-studio",         label: "VFX-Studio",           color: "text-indigo-400",  bg: "bg-indigo-500/10 border-indigo-500/20", examples: "CGI, Compositing, Motion" },
  { id: "fotostudio",         label: "Fotostudio",           color: "text-lime-400",    bg: "bg-lime-500/10 border-lime-500/20",     examples: "Daylight, Zyklore, Sets" },
  { id: "hochzeit",           label: "Hochzeit & Event",     color: "text-rose-300",    bg: "bg-rose-400/10 border-rose-400/20",     examples: "Hochzeitsfilm, Foto, Styling" },
  { id: "werbeagentur",       label: "Werbe-/Contentagentur",color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20", examples: "TVC, Social, Brand Content" },
  { id: "fahrzeugverleih",    label: "Fahrzeugverleih",      color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/20", examples: "Bild-Fahrzeuge, Stunt, Oldtimer" },
];

export const COMPANY_CATEGORY_BY_ID = Object.fromEntries(
  COMPANY_CATEGORIES.map((c) => [c.id, c])
);

/** Für Navbar-Dropdown & Suche */
export const COMPANY_CATEGORY_LABELS = COMPANY_CATEGORIES.map((c) => c.label);
