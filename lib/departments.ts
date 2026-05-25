export type Department = {
  id: string;
  label: string;
  labels: Record<string, string>;
  emoji: string;
  color: string; // tailwind accent (text-*/border-*/bg-*)
  roles: string[];
};

export function getDeptLabel(dept: Department, locale: string): string {
  return dept.labels[locale] ?? dept.label;
}

export const departments: Department[] = [
  {
    id: "produktion",
    label: "Produktion",
    labels: { "de":"Produktion", "en":"Production", "es":"Producción", "it":"Produzione", "cs":"Produkce", "hu":"Produkció" },
    emoji: "🎬",
    color: "emerald",
    roles: [
      "Producer", "Executive Producer", "Co-Producer", "Associate Producer",
      "Junior Producer", "Line Producer", "Herstellungsleiter (HL)",
      "Produktionsleiter (PL)", "Produktionsdisponent", "Produktionskoordinator",
      "Produktionsassistenz (Set)", "Produktionsassistenz (Office)", "Unit Manager",
      "Aufnahmeleiter (1st AD)", "2nd AD", "3rd AD / Crowd AD", "Set-Aufnahmeleiter",
      "Base-AL", "Travel Coordinator", "Produktionsfahrer",
      "Kalkulator", "Filmgeschäftsführung", "Controller (Film)",
      "Green Consultant / Sustainability Manager",
    ],
  },
  {
    id: "regie",
    label: "Regie",
    labels: { "de":"Regie", "en":"Direction", "es":"Dirección", "it":"Regia", "cs":"Režie", "hu":"Rendezés" },
    emoji: "🎭",
    color: "violet",
    roles: [
      "Regisseur", "Co-Regisseur", "Second Unit Director",
      "1st AD", "2nd AD", "3rd AD", "Crowd AD",
      "Script Supervisor (Continuity)", "Dialog Coach", "Acting Coach",
      "Regieassistenz Praktikum",
    ],
  },
  {
    id: "kamera",
    label: "Kamera",
    labels: { "de":"Kamera", "en":"Camera", "es":"Cámara", "it":"Camera", "cs":"Kamera", "hu":"Kamera" },
    emoji: "🎥",
    color: "sky",
    roles: [
      "Director of Photography (DoP)", "A-Kamera Operator", "B-Kamera Operator",
      "C-Kamera Operator", "1st AC (Focus Puller)", "2nd AC (Clapper / Loader)",
      "2nd AC Digital", "Video Assist Operator", "Video Assist Utility",
      "DIT", "DIT Assistant", "Data Wrangler", "Media Manager",
      "Playback Operator", "Steadicam Operator", "Steadicam Assistant",
      "Gimbal Operator", "Drohnenpilot / Drone Operator", "Remote Head Operator",
      "Motion Control Operator", "Kamera-Techniker",
      "Unterwasser-Kameraoperator", "Kamera Praktikant",
    ],
  },
  {
    id: "licht",
    label: "Licht",
    labels: { "de":"Licht", "en":"Lighting", "es":"Iluminación", "it":"Illuminazione", "cs":"Osvětlení", "hu":"Világítás" },
    emoji: "💡",
    color: "amber",
    roles: [
      "Gaffer (Oberbeleuchter)", "Best Boy Electric", "Beleuchter (Electrician)",
      "Rigging Gaffer", "Rigging Best Boy", "Rigging Electrician",
      "Lighting Programmer (DMX)", "Lichttechniker", "Lichtfahrer",
      "Generator Operator", "Cable Wrangler", "Lichtassistent",
      "Beleuchter Praktikant",
    ],
  },
  {
    id: "ton",
    label: "Ton",
    labels: { "de":"Ton", "en":"Sound", "es":"Sonido", "it":"Suono", "cs":"Zvuk", "hu":"Hang" },
    emoji: "🎧",
    color: "teal",
    roles: [
      // Set-Ton
      "Production Sound Mixer", "Boom Operator", "1st Sound Assistant",
      "2nd Sound Assistant", "Utility Sound Technician", "Playback Operator Ton",
      // Post-Ton
      "Sound Designer", "Supervising Sound Editor", "Dialogue Editor",
      "ADR Editor", "ADR Supervisor", "Foley Artist", "Foley Editor",
      "Re-Recording Mixer",
    ],
  },
  {
    id: "art",
    label: "Art Department",
    labels: { "de":"Art Department", "en":"Art Department", "es":"Arte", "it":"Arte", "cs":"Art oddělení", "hu":"Díszlet" },
    emoji: "🎨",
    color: "indigo",
    roles: [
      "Production Designer", "Supervising Art Director", "Art Director",
      "Assistant Art Director", "Set Designer", "CAD Designer",
      "Concept Artist", "Illustrator",
      "Set Decorator", "Assistant Set Decorator", "Buyer (Set Dec)",
      "Props Master (Chef-Requisiteur)", "On-Set Requisiteur",
      "Standby Props", "Prop Assistant", "Set Dresser", "Leadman",
      "Greensmaster / Greensman",
      "Construction Manager", "Construction Coordinator",
      "Bühnenbauer / Carpenter", "Schlosser (Metal)",
      "Painter / Scenic Artist", "Sculptor / Plastiker",
      "Graphic Designer (Set-Grafik)",
      "Art Department Coordinator", "Art Department Runner",
      "Art Department Praktikant",
    ],
  },
  {
    id: "kostuem",
    label: "Kostüm",
    labels: { "de":"Kostüm", "en":"Costume", "es":"Vestuario", "it":"Costume", "cs":"Kostýmy", "hu":"Jelmez" },
    emoji: "👗",
    color: "rose",
    roles: [
      "Costume Designer", "Costume Supervisor", "Assistant Costume Supervisor",
      "Costume Coordinator", "Assistant Costume Coordinator",
      "Assistant Costume Designer", "2nd Assistant Costume Designer",
      "3rd Assistant Costume Designer", "Key Costumer",
      "Set Costumer / Garderobier", "Additional Set Costumer",
      "Setkostüm Assistent", "Crowd Costume Supervisor", "Crowd Fitter",
      "Truck Costumer", "Costume Buyer", "Costume Accountant",
      "Gewandmeister / Wardrobe Master", "Kostümassistent", "Kostümpraktikant",
      "Schneider / Tailor", "Näher / Seamstress", "Textile Artist",
      "Costume Maker", "Costume Prop Maker", "Direktrice",
      "Damen Maßschneider", "Herren Maßschneider",
      "Hutmacher / Milliner", "Korsettmacher / Corset Maker",
      "Kostümillustrator", "Kostümmaler / Dyer (Färber)",
      "Kostüm Patinierer (Aging)", "Kostümsticker / Embroiderer",
      "Kostümrecherche", "Kostümfahrer",
      "Breakdown Artist (Aging / Distressing)", "SFX Kostüm",
      "Stylist / Stylingassistent",
    ],
  },
  {
    id: "maske",
    label: "Maske & Hair",
    labels: { "de":"Maske & Hair", "en":"Make-up & Hair", "es":"Maquillaje & Cabello", "it":"Trucco & Capelli", "cs":"Masky & Vlasy", "hu":"Smink & Haj" },
    emoji: "💄",
    color: "fuchsia",
    roles: [
      "Head of Make-up & Hair", "Hair Designer", "Hair/Makeup Designer",
      "Makeup Designer", "Hair/Makeup Supervisor",
      "Key Make-up Artist", "Key Hair Stylist",
      "Make-up Artist", "Additional Makeup Artist",
      "Hair Stylist", "Additional Hair Stylist",
      "Chefmaskenbildner / Dept. Head Make-up",
      "Körper Makeup / Body Make-up",
      "Zusatzmaskenbildner / Additional Make-up",
      "Make-up Assistant", "Wig Maker / Perückenmacher",
      "Prosthetics Artist", "SFX Make-up Artist",
      "Crowd Hair & Makeup Supervisor",
      "Maskenbildpraktikant",
    ],
  },
  {
    id: "post",
    label: "Postproduktion",
    labels: { "de":"Postproduktion", "en":"Post-Production", "es":"Postproducción", "it":"Post-Produzione", "cs":"Postprodukce", "hu":"Utómunka" },
    emoji: "✂️",
    color: "blue",
    roles: [
      // Schnitt
      "Editor", "First Assistant Editor", "Second Assistant Editor",
      "Dailies Cutter", "Sync Assistant",
      // Bild
      "Colorist", "Online Editor", "Finishing Artist",
      // VFX
      "VFX Supervisor", "VFX Producer", "VFX Coordinator",
      "Compositor", "2D Artist", "3D Artist", "Lighting Artist (CG)",
      "Texture Artist", "Matchmove Artist", "Roto Artist", "FX Artist",
      // Animation
      "Animator", "Motion Designer", "Character Animator",
    ],
  },
  {
    id: "musik",
    label: "Musik & Audio",
    labels: { "de":"Musik & Audio", "en":"Music & Audio", "es":"Música & Audio", "it":"Musica & Audio", "cs":"Hudba & Audio", "hu":"Zene & Audió" },
    emoji: "🎼",
    color: "purple",
    roles: [
      "Composer", "Music Supervisor", "Orchestrator", "Arranger",
      "Conductor", "Music Editor", "Sound Editor",
    ],
  },
  {
    id: "set-logistik",
    label: "Set / Logistik",
    labels: { "de":"Set / Logistik", "en":"Set / Logistics", "es":"Set / Logística", "it":"Set / Logistica", "cs":"Set / Logistika", "hu":"Helyszín / Logisztika" },
    emoji: "🚚",
    color: "slate",
    roles: [
      "Set Runner", "Base Runner", "Fahrer (PKW / LKW)", "Motivfahrer",
      "Location Manager", "Assistant Location Manager", "Location Scout",
      "Motivaufnahmeleiter", "Set Security", "Crowd Control",
      "Medic / Set-Arzt", "Fire Safety Officer", "Catering", "Craft Service",
    ],
  },
  {
    id: "cast",
    label: "Cast & Performance",
    labels: { "de":"Cast & Performance", "en":"Cast & Performance", "es":"Reparto & Actuación", "it":"Cast & Performance", "cs":"Herci & Výkony", "hu":"Szereplők" },
    emoji: "🎭",
    color: "orange",
    roles: [
      "Schauspieler", "Nebendarsteller", "Komparse", "Kleindarsteller",
      "Stunt Performer", "Stunt Double", "Stunt Rigger",
      "Stunt Coordinator", "Fight Choreographer", "Intimacy Coordinator",
    ],
  },
  {
    id: "sfx",
    label: "SFX",
    labels: { "de":"SFX", "en":"SFX", "es":"SFX", "it":"SFX", "cs":"SFX", "hu":"SFX" },
    emoji: "💥",
    color: "red",
    roles: [
      "Special Effects Supervisor", "SFX Technician", "Pyrotechnician",
      "Pyro Assistant", "Waffenmeister", "Rigger (Wire)",
      "Mechanical Effects Technician", "Snow / Rain Effects Tech",
    ],
  },
  {
    id: "broadcast",
    label: "TV / Broadcast",
    labels: { "de":"TV / Broadcast", "en":"TV / Broadcast", "es":"TV / Broadcast", "it":"TV / Broadcast", "cs":"TV / Broadcast", "hu":"TV / Broadcast" },
    emoji: "📺",
    color: "cyan",
    roles: [
      "Bildmischer", "Vision Mixer", "Shader", "Kamera CCU Operator",
      "MAZ Operator", "EVS Operator", "Streaming Technician",
      "Broadcast Engineer",
    ],
  },
  {
    id: "virtual",
    label: "Virtual Production",
    labels: { "de":"Virtual Production", "en":"Virtual Production", "es":"Producción Virtual", "it":"Produzione Virtuale", "cs":"Virtuální produkce", "hu":"Virtuális produkció" },
    emoji: "🧠",
    color: "pink",
    roles: [
      "Virtual Production Supervisor", "LED Wall Operator",
      "Unreal Engine Operator", "Tracking Technician", "Real-Time Artist",
    ],
  },
  {
    id: "redaktion",
    label: "Redaktion & Content",
    labels: { "de":"Redaktion & Content", "en":"Editorial & Content", "es":"Redacción & Contenido", "it":"Redazione & Contenuto", "cs":"Redakce & Obsah", "hu":"Szerkesztőség & Tartalom" },
    emoji: "✍️",
    color: "lime",
    roles: [
      "Redakteur", "Chef vom Dienst", "Creative Producer",
      "Creative Director", "Copywriter", "Konzepter", "Social Media Producer",
    ],
  },
  {
    id: "social",
    label: "Social Media",
    labels: { "de":"Social Media", "en":"Social Media", "es":"Redes Sociales", "it":"Social Media", "cs":"Sociální sítě", "hu":"Közösségi média" },
    emoji: "📱",
    color: "purple",
    roles: [
      "Content Creator", "Influencer", "Social Media Manager",
      "UGC Creator", "Reels Videograf", "TikTok Creator",
      "Community Manager", "Social Media Strategist",
    ],
  },
  {
    id: "foto",
    label: "Fotografie",
    labels: { "de":"Fotografie", "en":"Photography", "es":"Fotografía", "it":"Fotografia", "cs":"Fotografie", "hu":"Fotográfia" },
    emoji: "📷",
    color: "cyan",
    roles: [
      "Fotograf/in", "Fashion Fotograf", "Product Fotograf",
      "Event Fotograf", "Portrait Fotograf", "Drone Fotograf",
      "Foto-Retouche", "Bildbearbeitung",
    ],
  },
  {
    id: "ki",
    label: "KI & AI",
    labels: { "de":"KI & AI", "en":"AI & Technology", "es":"IA & Tecnología", "it":"IA & Tecnologia", "cs":"AI & Technologie", "hu":"AI & Technológia" },
    emoji: "🤖",
    color: "violet",
    roles: [
      "KI-Filmemacher/in",
      "KI-Beauftragter / AI Supervisor",
      "AI Director",
      "KI-Animator/in",
      "Prompt Engineer (Film & Media)",
      "KI-Drehbuchautor/in",
      "KI-Storyboard Artist",
      "KI-Bildgenerator/in",
      "AI Video Creator",
      "KI-Sound Designer",
      "KI-Colorist",
      "AI Workflow Consultant (Film)",
    ],
  },
];

/** Flatten all roles across all departments for global search */
export const allRoles: { role: string; dept: Department }[] =
  departments.flatMap((d) => d.roles.map((r) => ({ role: r, dept: d })));

/** Color map — returns tailwind-safe classes for a department color */
export function deptColors(color: string) {
  const map: Record<string, { bg: string; border: string; text: string; bgHover: string }> = {
    emerald: { bg: "bg-emerald-500/12", border: "border-emerald-500/30", text: "text-emerald-400", bgHover: "hover:bg-emerald-500/8" },
    violet:  { bg: "bg-violet-500/12",  border: "border-violet-500/30",  text: "text-violet-400",  bgHover: "hover:bg-violet-500/8"  },
    sky:     { bg: "bg-sky-500/12",     border: "border-sky-500/30",     text: "text-sky-400",     bgHover: "hover:bg-sky-500/8"     },
    amber:   { bg: "bg-amber-500/12",   border: "border-amber-500/30",   text: "text-amber-400",   bgHover: "hover:bg-amber-500/8"   },
    teal:    { bg: "bg-teal-500/12",    border: "border-teal-500/30",    text: "text-teal-400",    bgHover: "hover:bg-teal-500/8"    },
    indigo:  { bg: "bg-indigo-500/12",  border: "border-indigo-500/30",  text: "text-indigo-400",  bgHover: "hover:bg-indigo-500/8"  },
    rose:    { bg: "bg-rose-500/12",    border: "border-rose-500/30",    text: "text-rose-400",    bgHover: "hover:bg-rose-500/8"    },
    fuchsia: { bg: "bg-fuchsia-500/12", border: "border-fuchsia-500/30", text: "text-fuchsia-400", bgHover: "hover:bg-fuchsia-500/8" },
    blue:    { bg: "bg-blue-500/12",    border: "border-blue-500/30",    text: "text-blue-400",    bgHover: "hover:bg-blue-500/8"    },
    purple:  { bg: "bg-purple-500/12",  border: "border-purple-500/30",  text: "text-purple-400",  bgHover: "hover:bg-purple-500/8"  },
    slate:   { bg: "bg-slate-500/12",   border: "border-slate-500/30",   text: "text-slate-400",   bgHover: "hover:bg-slate-500/8"   },
    orange:  { bg: "bg-orange-500/12",  border: "border-orange-500/30",  text: "text-orange-400",  bgHover: "hover:bg-orange-500/8"  },
    red:     { bg: "bg-red-500/12",     border: "border-red-500/30",     text: "text-red-400",     bgHover: "hover:bg-red-500/8"     },
    cyan:    { bg: "bg-cyan-500/12",    border: "border-cyan-500/30",    text: "text-cyan-400",    bgHover: "hover:bg-cyan-500/8"    },
    pink:    { bg: "bg-pink-500/12",    border: "border-pink-500/30",    text: "text-pink-400",    bgHover: "hover:bg-pink-500/8"    },
    lime:    { bg: "bg-lime-500/12",    border: "border-lime-500/30",    text: "text-lime-400",    bgHover: "hover:bg-lime-500/8"    },
  };
  return map[color] ?? map.slate;
}
