export type Department = {
  id: string;
  label: string;
  emoji: string;
  color: string; // tailwind accent (text-*/border-*/bg-*)
  roles: string[];
};

export const departments: Department[] = [
  {
    id: "produktion",
    label: "Produktion",
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
    emoji: "👗",
    color: "rose",
    roles: [
      "Costume Designer", "Assistant Costume Designer", "Costume Supervisor",
      "Set Costumer / Garderobier", "Truck Costumer", "Kostümassistent",
      "Kostümpraktikant", "Schneider / Tailor", "Textile Artist",
      "Breakdown Artist (Aging / Distressing)", "Dyer (Färber)",
    ],
  },
  {
    id: "maske",
    label: "Maske & Hair",
    emoji: "💄",
    color: "fuchsia",
    roles: [
      "Head of Make-up Department", "Key Make-up Artist", "Make-up Artist",
      "Hair Stylist", "Hair Supervisor", "Wig Maker", "Wig Stylist",
      "Prosthetic Designer", "Prosthetic Make-up Artist",
      "SFX Make-up Artist", "Body Painter", "Make-up Assistant",
    ],
  },
  {
    id: "post",
    label: "Postproduktion",
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
