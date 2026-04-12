/**
 * CineGenius – Berufe-Struktur
 * Single source of truth für alle Departments und Rollen.
 * Umfasst Film, Social Media und Fotografie.
 */

export type Platform = "film" | "social" | "photo";

export type FilmRole = {
  id: string;
  label: string;               // Anzeigename (DE)
  labelEn?: string;            // Englische Entsprechung
  seniority?: "junior" | "senior" | "lead"; // Optional
};

export type FilmDepartment = {
  id: string;
  label: string;               // Gewerkname
  color: string;               // Tailwind text-color
  bg: string;                  // Tailwind bg/border (für Badges)
  platform: Platform;          // Film | Social Media | Fotografie
  roles: FilmRole[];
};

export const FILM_DEPARTMENTS: FilmDepartment[] = [
  {
    id: "vor-der-kamera",
    label: "Vor der Kamera",
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
    platform: "film",
    roles: [
      { id: "hauptdarsteller",    label: "Hauptdarsteller/in",          labelEn: "Lead Actor/Actress" },
      { id: "nebendarsteller",    label: "Nebendarsteller/in",          labelEn: "Supporting Actor/Actress" },
      { id: "statist",            label: "Statist / Komparse",          labelEn: "Background / Extra" },
      { id: "model",              label: "Model",                       labelEn: "Model" },
      { id: "stunt-darsteller",   label: "Stunt-Darsteller/in",        labelEn: "Stunt Performer" },
      { id: "sprecher",           label: "Sprecher / Voice-Over",       labelEn: "Voice Actor / Voice-Over" },
    ],
  },
  {
    id: "regie",
    label: "Regie",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    platform: "film",
    roles: [
      { id: "regisseur",          label: "Regisseur/in",                labelEn: "Director" },
      { id: "1-regieassistenz",   label: "1. Regieassistenz",           labelEn: "1st Assistant Director (1st AD)" },
      { id: "2-regieassistenz",   label: "2. Regieassistenz",           labelEn: "2nd Assistant Director (2nd AD)" },
      { id: "script-supervisor",  label: "Script Supervisor",           labelEn: "Script Supervisor / Continuity" },
      { id: "regieassistenz",     label: "Regieassistenz (Set-Runner)", labelEn: "Set PA / Runner" },
    ],
  },
  {
    id: "kamera",
    label: "Kamera",
    color: "text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/20",
    platform: "film",
    roles: [
      { id: "dop",                label: "Director of Photography (DoP)", labelEn: "Cinematographer / DoP" },
      { id: "kamera-operator",    label: "Kamera-Operator",               labelEn: "Camera Operator" },
      { id: "focus-puller",       label: "1. AC / Focus Puller",          labelEn: "1st AC / Focus Puller" },
      { id: "2nd-ac",             label: "2. AC / Klappe",                labelEn: "2nd AC / Clapper Loader" },
      { id: "dit",                label: "DIT (Digital Imaging Technician)", labelEn: "DIT" },
      { id: "steadicam",          label: "Steadicam-Operator",            labelEn: "Steadicam Operator" },
      { id: "drohne",             label: "Drohnen-Pilot / Aerial",        labelEn: "Drone Operator / Aerial DP" },
    ],
  },
  {
    id: "licht",
    label: "Licht",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    platform: "film",
    roles: [
      { id: "oberbeleuchter",     label: "Oberbeleuchter / Gaffer",     labelEn: "Gaffer" },
      { id: "best-boy-licht",     label: "Best Boy Licht",              labelEn: "Best Boy Electric" },
      { id: "beleuchter",         label: "Beleuchter",                  labelEn: "Electrician / Lighting Tech" },
    ],
  },
  {
    id: "grip",
    label: "Grip",
    color: "text-slate-400",
    bg: "bg-slate-500/10 border-slate-500/20",
    platform: "film",
    roles: [
      { id: "key-grip",           label: "Key Grip",                    labelEn: "Key Grip" },
      { id: "best-boy-grip",      label: "Best Boy Grip",               labelEn: "Best Boy Grip" },
      { id: "dolly-grip",         label: "Dolly Grip",                  labelEn: "Dolly Grip" },
      { id: "kran-operator",      label: "Kran-Operator",               labelEn: "Crane / Jib Operator" },
    ],
  },
  {
    id: "ton",
    label: "Ton",
    color: "text-teal-400",
    bg: "bg-teal-500/10 border-teal-500/20",
    platform: "film",
    roles: [
      { id: "tonmeister",         label: "Tonmeister / Sound Mixer",    labelEn: "Production Sound Mixer" },
      { id: "boom-operator",      label: "Boom Operator",               labelEn: "Boom Operator" },
      { id: "tonassistenz",       label: "Tonassistenz",                labelEn: "Sound Assistant" },
    ],
  },
  {
    id: "maske",
    label: "Maske & Hair",
    color: "text-pink-400",
    bg: "bg-pink-500/10 border-pink-500/20",
    platform: "film",
    roles: [
      { id: "maskenbildner",      label: "Maskenbildner/in",            labelEn: "Make-up Artist" },
      { id: "sfx-makeup",         label: "SFX Make-up Artist",          labelEn: "Special FX Make-up" },
      { id: "hair-stylist",       label: "Hair Stylist",                labelEn: "Hair Stylist" },
      { id: "hmu-head",           label: "Head of Make-up & Hair",      labelEn: "Head of Make-up & Hair" },
    ],
  },
  {
    id: "kostuem",
    label: "Kostüm",
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
    platform: "film",
    roles: [
      { id: "kostuembildner",     label: "Kostümbildner/in",            labelEn: "Costume Designer" },
      { id: "garderobier",        label: "Garderobier/in",              labelEn: "Wardrobe Supervisor" },
      { id: "kostuemassistenz",   label: "Kostümassistenz",             labelEn: "Costume Assistant" },
    ],
  },
  {
    id: "szenenbild",
    label: "Szenenbild / Art",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10 border-indigo-500/20",
    platform: "film",
    roles: [
      { id: "production-designer", label: "Production Designer",        labelEn: "Production Designer" },
      { id: "art-director",        label: "Art Director",               labelEn: "Art Director" },
      { id: "set-decorator",       label: "Set Decorator",              labelEn: "Set Decorator" },
      { id: "requisiteur",         label: "Requisiteur/in",             labelEn: "Props Master" },
      { id: "buehnenbildner",      label: "Bühnenbauer/in",             labelEn: "Set Builder / Construction" },
      { id: "graphic-artist",      label: "Graphic Artist (Art Dept.)", labelEn: "Graphic Artist" },
    ],
  },
  {
    id: "produktion",
    label: "Produktion",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    platform: "film",
    roles: [
      { id: "produzent",           label: "Produzent/in",               labelEn: "Producer" },
      { id: "line-producer",       label: "Line Producer",              labelEn: "Line Producer" },
      { id: "produktionsleiter",   label: "Produktionsleiter/in",       labelEn: "Production Manager" },
      { id: "aufnahmeleiter",      label: "Aufnahmeleiter/in",          labelEn: "Unit Production Manager" },
      { id: "produktionsassistenz",label: "Produktionsassistenz",       labelEn: "Production Assistant (PA)" },
      { id: "location-manager",    label: "Location Manager",           labelEn: "Location Manager" },
      { id: "casting-director",    label: "Casting Director",           labelEn: "Casting Director" },
    ],
  },
  {
    id: "post",
    label: "Postproduktion",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    platform: "film",
    roles: [
      { id: "cutter",              label: "Cutter/in (Editor)",         labelEn: "Film Editor" },
      { id: "colorist",            label: "Colorist",                   labelEn: "Colorist / DI" },
      { id: "vfx-artist",          label: "VFX Artist / Compositor",    labelEn: "VFX Artist / Compositor" },
      { id: "sound-designer",      label: "Sound Designer",             labelEn: "Sound Designer" },
      { id: "sound-editor",        label: "Sound Editor / Cutter",      labelEn: "Sound Editor" },
      { id: "motion-designer",     label: "Motion Designer",            labelEn: "Motion Designer" },
      { id: "online-editor",       label: "Online-Editor",              labelEn: "Online Editor" },
    ],
  },

  // ── SOCIAL MEDIA ─────────────────────────────────────────────────────────

  {
    id: "content-creation",
    label: "Content Creation",
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
    platform: "social",
    roles: [
      { id: "content-creator",     label: "Content Creator",             labelEn: "Content Creator" },
      { id: "influencer",          label: "Influencer / Creator",        labelEn: "Influencer / Creator" },
      { id: "social-media-manager",label: "Social Media Manager",        labelEn: "Social Media Manager" },
      { id: "community-manager",   label: "Community Manager",           labelEn: "Community Manager" },
      { id: "brand-storyteller",   label: "Brand Storyteller",           labelEn: "Brand Storyteller" },
    ],
  },
  {
    id: "social-video",
    label: "Social Video",
    color: "text-fuchsia-400",
    bg: "bg-fuchsia-500/10 border-fuchsia-500/20",
    platform: "social",
    roles: [
      { id: "videograf-social",    label: "Videograf (Social Content)",  labelEn: "Social Videographer" },
      { id: "reels-editor",        label: "Editor (Reels / TikTok)",     labelEn: "Shortform Editor" },
      { id: "motion-social",       label: "Motion Designer (Social)",    labelEn: "Motion Designer (Social)" },
      { id: "ugc-creator",         label: "UGC Creator",                 labelEn: "UGC Creator" },
    ],
  },

  // ── FOTOGRAFIE ───────────────────────────────────────────────────────────

  {
    id: "fotografie",
    label: "Fotografie",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
    platform: "photo",
    roles: [
      { id: "fotograf",            label: "Fotograf/in",                 labelEn: "Photographer" },
      { id: "modefotograf",        label: "Modefotograf/in",             labelEn: "Fashion Photographer" },
      { id: "produktfotograf",     label: "Produktfotograf/in",          labelEn: "Product Photographer" },
      { id: "eventfotograf",       label: "Eventfotograf/in",            labelEn: "Event Photographer" },
      { id: "portraitfotograf",    label: "Portraitfotograf/in",         labelEn: "Portrait Photographer" },
      { id: "werbefotograf",       label: "Werbefotograf/in",            labelEn: "Commercial Photographer" },
      { id: "food-fotograf",       label: "Food Fotograf/in",            labelEn: "Food Photographer" },
    ],
  },
  {
    id: "foto-post",
    label: "Foto-Postproduktion",
    color: "text-lime-400",
    bg: "bg-lime-500/10 border-lime-500/20",
    platform: "photo",
    roles: [
      { id: "retoucher",           label: "Retoucher/in",                labelEn: "Retoucher" },
      { id: "bildbearbeiter",      label: "Bildbearbeiter/in",           labelEn: "Photo Editor" },
      { id: "fotoassistenz",       label: "Fotoassistenz",               labelEn: "Photo Assistant" },
      { id: "studio-manager",      label: "Studio Manager/in",           labelEn: "Studio Manager" },
    ],
  },
];

/** Flat list of all roles (für Suche, Validierung etc.) */
export const ALL_ROLES: (FilmRole & { departmentId: string; departmentLabel: string })[] =
  FILM_DEPARTMENTS.flatMap((d) =>
    d.roles.map((r) => ({ ...r, departmentId: d.id, departmentLabel: d.label }))
  );

/** Department-ID → Department */
export const DEPT_BY_ID = Object.fromEntries(FILM_DEPARTMENTS.map((d) => [d.id, d]));

/** Role-ID → Role + Department */
export const ROLE_BY_ID = Object.fromEntries(ALL_ROLES.map((r) => [r.id, r]));

/**
 * Für die Suche: Welche Suchbegriffe treffen auf ein Department?
 * Wird in CreatorsContent und JobsContent für Keyword-Matching verwendet.
 */
export const DEPT_KEYWORDS: Record<string, string[]> = {
  "vor-der-kamera": [
    "schauspieler", "schauspielerin", "actor", "actress", "darsteller",
    "hauptdarsteller", "nebendarsteller", "statist", "komparse", "extra",
    "background", "model", "stunt", "sprecher", "voice",
  ],
  regie: [
    "regisseur", "regisseurin", "director", "1st ad", "2nd ad",
    "regieassistenz", "script supervisor", "continuity", "runner", "set pa",
  ],
  kamera: [
    "kamera", "camera", "dop", "cinematograph", "dp",
    "kamera-operator", "operator", "focus puller", "1st ac", "1. ac",
    "2nd ac", "2. ac", "dit", "steadicam", "drohne", "aerial", "drone",
  ],
  licht: [
    "licht", "lighting", "gaffer", "oberbeleuchter", "beleuchter",
    "best boy", "electrician",
  ],
  grip: [
    "grip", "key grip", "dolly", "kran", "crane", "jib", "rigging",
  ],
  ton: [
    "ton", "sound", "audio", "tonmeister", "mixer", "boom operator",
    "tonassistenz",
  ],
  maske: [
    "maske", "make-up", "makeup", "maskenbildner", "hair", "stylist",
    "sfx makeup", "hmu",
  ],
  kostuem: [
    "kostüm", "kostum", "costume", "wardrobe", "garderobier",
    "kostümbildner", "kostumbildner",
  ],
  szenenbild: [
    "szenenbild", "production designer", "art director", "set decorator",
    "requisiteur", "props", "art department", "bühnenbau", "buhnenbau",
  ],
  produktion: [
    "produzent", "producer", "line producer", "produktionsleiter",
    "aufnahmeleiter", "produktionsassistenz", "pa", "location manager",
    "casting",
  ],
  post: [
    "cutter", "editor", "schnitt", "colorist", "color grading",
    "vfx", "compositor", "sound designer", "sound editor",
    "motion design", "online editor", "postproduktion",
  ],

  // Social Media
  "content-creation": [
    "content creator", "content", "influencer", "social media manager",
    "social media", "community manager", "brand storyteller", "creator",
  ],
  "social-video": [
    "videograf", "videographer", "reels", "tiktok", "shortform", "short form",
    "ugc", "motion designer", "social video", "instagram", "youtube shorts",
  ],

  // Fotografie
  fotografie: [
    "fotograf", "fotografin", "photographer", "photo", "foto",
    "modefotograf", "fashion photographer", "produktfotograf", "product photographer",
    "eventfotograf", "event photographer", "portraitfotograf", "portrait",
    "werbefotograf", "commercial photographer", "food fotograf", "food photographer",
  ],
  "foto-post": [
    "retoucher", "retusche", "bildbearbeiter", "photo editor", "fotoassistenz",
    "photo assistant", "studio manager", "bildbearbeitung",
  ],
};

/** Departments grouped by platform — für UI-Tabs */
export const DEPARTMENTS_BY_PLATFORM: Record<Platform, FilmDepartment[]> = {
  film: FILM_DEPARTMENTS.filter((d) => d.platform === "film"),
  social: FILM_DEPARTMENTS.filter((d) => d.platform === "social"),
  photo: FILM_DEPARTMENTS.filter((d) => d.platform === "photo"),
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  film: "Film",
  social: "Social Media",
  photo: "Fotografie",
};
