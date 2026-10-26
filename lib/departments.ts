import { GRIP_DEPARTMENT_LABEL, GRIP_OCCUPATIONS } from "@/lib/gripTaxonomy";
import { FILM_DEPARTMENTS } from "@/lib/filmRoles";
import { CATERING_DEPARTMENT_ID, CATERING_DEPARTMENT_LABEL } from "@/lib/catering-taxonomy";
import type { ProfileType } from "@/lib/profile-types";

export type Department = {
  id: string;
  label: string;
  labels: Record<string, string>;
  emoji: string;
  color: string; // tailwind accent (text-*/border-*/bg-*)
  roles: string[];
  /** Alternate names from the job/project catalogue; kept searchable, not shown as duplicate choices. */
  roleAliases?: Record<string, string[]>;
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
      "Produzent/in", "Executive Producer", "Co-Producer", "Associate Producer",
      "Junior Producer", "Line Producer",
      "Herstellungsleiter (HL)", "Assistent*in der Herstellungsleitung",
      "Produktionsleiter (PL)", "Produktionsleiter*in (Sender)",
      "Assistent*in des*der Produktionsleiter*in",
      "Disponent*in / Produktionsplaner*in", "Kalkulationserstellung",
      "Production Supervisor", "Assistent*in des Production Supervisors",
      "Studioleiter*in",
      "Produktionskoordinator", "Assistent*in der Produktionskoordinator*in",
      "Produktionsassistenz (Set)", "Produktionsassistenz (Office)", "2. Produktionsassistenz",
      "Teamassistent*in", "Personal Assistant (persönliche Assistenz)",
      "Persönliche Assistenz der Produktion", "Persönliche Assistenz für Schauspieler*innen (Talent Assistant)",
      "Assistent*in der/des Produzent*in", "Executive Assistant / Geschäftsführungsassistenz",
      "Office Assistant / Büroassistenz",
      "Accommodation Coordinator", "Travel Coordinator", "Assistent*in der Reisekoordinator*in",
      "Health and Safety Coordinator", "ADR Coordinator",
      "Location Manager", "Location Scout", "Location Scout (Zusatz)",
      "Assistant Location Scout", "Location Coordinator",
      "Schauspieler Koordinator*in", "Unit Manager",
      "Covid-Koordinator*in", "Assistant Covid Coordinator",
      "Motivaufnahmeleiter*in", "Assistent*in der Motiv-AL",
      "Personaldisponent*in",
      "Transportation Coordinator", "Assistant Transportation Coordinator", "Transportation Captain",
      "Aufnahmeleiter (1st AD)", "Set-Aufnahmeleiter",
      "3rd AD / Crowd AD", "Base-AL",
      "Drivers Captain", "Studio-Aufnahmeleiter*in",
      "Lock Off Manager*in", "2. Aufnahmeleiter*in (Show/Broadcast)",
      "Unit Move Coordinator", "Assistent*in der Aufnahmeleitung",
      "Assistent*in in der 1. AL", "Assistent*in der Set-AL",
      "Parking Production Assistant", "Absperrhilfe / Blocker*in",
      "Set Runner", "Produktionsfahrer*in", "Personal Driver", "Equipmentfahrer*in",
      "Office Production Assistent*in",
      "Kalkulator", "Filmgeschäftsführung", "Controller (Film)",
      "Green Consultant / Sustainability Manager",
      "Produktionspraktikant*in", "Set-AL Praktikant*in",
    ],
  },
  {
    id: "regie",
    label: "Regie",
    labels: { "de":"Regie", "en":"Direction", "es":"Dirección", "it":"Regia", "cs":"Režie", "hu":"Rendezés" },
    emoji: "🎭",
    color: "violet",
    roles: [
      "Regisseur/in", "Co-Regisseur*in", "Second Unit Director",
      "Studioregisseur*in", "Synchronregisseur*in", "Bildregisseur*in",
      "Senderegisseur*in", "Dialog Regisseur*in",
      "1st AD", "2nd AD", "Key 2nd AD", "Floor 2nd AD", "Crowd 2nd AD",
      "3rd AD", "3rd AD Crowd", "Base 3rd AD", "Floor 3rd AD",
      "AD PA", "Key AD PA", "AD Trainee",
      "Crowd Marshall", "Assistant Crowd Marshall",
      "Script Supervisor (Continuity)", "Assistant Script Supervisor", "Skripts (On-Set)",
      "Storyboard Artist",
      "Schauspiel Coach", "Schauspiel Coach (Kinder)", "Dialog Coach",
      "Komparsenbetreuuer*in", "Assistent*in Komparsenbetreuuer*in",
      "Persönlicher Assistent*in (Regie)", "Persönliche Assistenz der Regie",
      "Regiepraktikant*in", "Script Trainee", "Regieassistenz (Set-Runner)",
    ],
  },
  {
    id: "kamera",
    roleAliases: {
      "1st AC (Focus Puller)": ["Kameraassistenz", "1st AC", "1. Kameraassistenz"],
      "2nd AC (Clapper / Loader)": ["2nd AC", "2. Kameraassistenz"],
    },
    label: "Kamera",
    labels: { "de":"Kamera", "en":"Camera", "es":"Cámara", "it":"Camera", "cs":"Kamera", "hu":"Kamera" },
    emoji: "🎥",
    color: "sky",
    roles: [
      "Director of Photography (DoP)", "Director of Imagery (DoI)",
      "A-Kamera Operator", "B-Kamera Operator", "C-Kamera Operator",
      "E-Kameramann*frau (Studio/AU)", "EB Kameramann*frau",
      "2nd Unit Kameramann*frau", "3rd Unit Kameramann*frau",
      "1st AC (Focus Puller)",
      "2nd AC (Clapper / Loader)", "Clapper-Loader",
      "3. Kameraassistent*in", "2nd AC Digital",
      "DIT", "DIT Assistent*in",
      "Steadicam Operator", "Steadicam Assistent*in",
      "Gimbal System Operator",
      "Drohnenpilot / Drone Operator", "Kamera-Drohnen Operator", "Kamera-Drohnen Pilot*in",
      "Camera Car Driver", "Flugzeugpilot*in (Luftaufnahmen)", "Helikopterpilot*in (Luftaufnahmen)", "Spidercam-Pilot*in",
      "Kamera-Drohnen Assistent*in",
      "Remote Kamera Operator", "Remote Head Operator",
      "Aerial Camera Operator", "Air to Air Operator",
      "Highspeed Operator", "ARRI Trinity Operator",
      "Cablecam Operator", "Polecam Operator", "Rod-Cam Operator",
      "Motion Control Operator", "Motion Control Assistent*in",
      "Live-Kamera Operator",
      "VR Director of Photography", "VR Camera Operator",
      "3D Stereo Kameramann*frau", "3D Stereo Convergence Operator", "Stereoscopic Technician",
      "Stereographer", "2nd Unit Stereographer*in", "Stereographerassistent*in",
      "Unterwasser-Kameraoperator", "Unterwasser Kameraassistent*in",
      "Freifall Kameramann*frau", "Drytech",
      "Data Wrangler", "Data Wrangler / Digital Loader", "Media Manager",
      "Video Assist Operator", "Video Assist Utility",
      "Crash-Box Operators",
      "Videooperator", "Qtake Operator*in", "Videooperatorassistent*in",
      "Playback Operator",
      "EB Assistent*in (Bild-Ton)", "EB Techniker*in (Bild-Ton)",
      "Kameraassistent*in (Non-Fiction)",
      "DCE Data Capture Engineer", "Rear Projection Plates Operator",
      "Kamera-Techniker",
      "Kamerapraktikant*in",
    ],
  },
  {
    id: "licht",
    roleAliases: {
      "Gaffer (Oberbeleuchter)": ["Gaffer", "Oberbeleuchter", "Gaffer / Oberbeleuchter", "Oberbeleuchter / Gaffer", "Licht / Gaffer"],
      "Beleuchter (Electrician)": ["Beleuchter", "Electrician", "Electrician / Lighting Tech"],
    },
    label: "Licht",
    labels: { "de":"Licht", "en":"Lighting", "es":"Iluminación", "it":"Illuminazione", "cs":"Osvětlení", "hu":"Világítás" },
    emoji: "💡",
    color: "amber",
    roles: [
      "Gaffer (Oberbeleuchter)",
      "Best Boy Electric",
      "Rigging Gaffer", "Rigging Best Boy", "Rigging Electrician",
      "Beleuchter (Electrician)", "Beleuchtungsmeister*in",
      "Lichtpult Operator", "Lichtpult Assistent*in",
      "Lighting Programmer (DMX)", "Lichttechniker", "Lichtfahrer",
      "Zusatzbeleuchter*in",
      "Generator Operator",
      "Cable Wrangler",
      "Unterwasser Licht", "Ballonlicht Operator", "Spot-/Truss-Spot Operator",
      "Lichtassistent*in",
      "Licht Praktikant*in",
    ],
  },
  {
    id: "grip",
    label: GRIP_DEPARTMENT_LABEL,
    labels: { "de": GRIP_DEPARTMENT_LABEL, "en": "Camera Grip", "es": "Grip de cámara", "it": "Grip camera", "cs": "Kamerová technika", "hu": "Kameragrip" },
    emoji: "🛠️",
    color: "slate",
    roles: GRIP_OCCUPATIONS.map((occupation) => occupation.label),
  },
  {
    id: "ton",
    label: "Ton",
    labels: { "de":"Ton", "en":"Sound", "es":"Sonido", "it":"Suono", "cs":"Zvuk", "hu":"Hang" },
    emoji: "🎧",
    color: "teal",
    roles: [
      // Set-Ton
      "Tonmeister / Sound Mixer", "Production Sound Mixer",
      "Filmtonmeister*in",
      "Boom Operator",
      "Tonassistenz", "1st Sound Assistant", "1. Filmtonassistent*in",
      "2nd Sound Assistant", "2. Filmtonassistent*in",
      "ADR / Synchron-Angler*in",
      "Surround Sound Recordist",
      "Utility Sound Technician", "Tongeräteassistent*in",
      "Playback Operator Ton",
      "Tonmann*frau (Non-Fiction)",
      "Tonpraktikant*in",
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
      "Production Designer", "Szenenbildner*in",
      "Supervising Art Director", "Art Director", "Standby Art Director",
      "Assistant Art Director",
      "Szenenbildassistent*in", "Ausstattungsassistent*in",
      "Set Designer", "CAD Designer",
      "Concept Artist", "Concept Artist (Art Dept.)",
      "Illustrator", "Graphic Designer (Set-Grafik)", "Lead Graphic Designer",
      "Graphic Artist (Art Dept.)", "Mood Scout / Layouter",
      "Set Decorator", "Set Decoration Coordinator", "Assistant Set Decorator",
      "Set Decoration Buyer", "Set Decoration Store Manager*in",
      "Assistant Set Dec Coordinator",
      "Set Dresser", "Leadman", "Leadman*woman Set Dresser",
      "Props Master (Chef-Requisiteur)", "Requisiteur/in",
      "Außenrequisiteur*in", "On-Set Requisiteur", "Setrequisiteur*in",
      "Standby Props", "Prop Assistant", "Requisitenassistent*in",
      "Außenrequisitenassistent*in", "Setrequisitenassistent*in",
      "Prop Buyer", "Buyer (Set Dec)", "Prop Store Manager*in",
      "Digital Props Designer", "Digital Props Master",
      "Prop Maker", "Propdesigner*in", "Weapon Advisor",
      "Requisitenhilfe", "Requisitenmaler*in", "Requisitenfahrer*in",
      "Picture Car/Vehicle Coordinator", "Picture Car Wrangler",
      "Practical Electrician",
      "Greensmaster / Greensman", "Greens Person (Gartengestaltung)",
      "Floral Artist", "Food Stylist*in",
      "Airbrush Artist", "Kunstmaler*in",
      "Bühnenmaler*in", "Chefbühnenmaler*in", "Schriftenmaler*in",
      "Painter / Scenic Artist", "Sculptor / Plastiker", "Bühnenplastiker*in",
      "Modellbauer*in", "Miniature Supervisor", "Miniature Effects Supervisor",
      "Construction Manager", "Construction Coordinator", "Studio-Kulissenbauleiter*in",
      "Bühnenbauer / Carpenter", "Baubühne", "Bühnenmeister*in", "Bühnentechniker*in",
      "Konstruktionszeichner*in", "Maurer*in",
      "Schlosser (Metal)", "Schlosser*in", "Chefschlosser*in",
      "Stukkatuer*in", "Tapezierer*in",
      "Tischler*in / Schreiner*in", "Drechsler*in",
      "Art Department Coordinator", "Assistant Art Dept. Coordinator",
      "Art Department Runner", "Art Department Praktikant",
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
      // Management
      "Postproduction Producer*in", "Postproduction Supervisor", "Postproduction Manager",
      "Post-Koordinator*in", "Postproduktionsdisponent*in",
      "Assistent*in Postprod. Supervisor",
      "Delivery Manager / Delivery Supervisor",
      // Schnitt
      "Editor", "Cutter/in (Editor)", "Additional Editor*in", "Junior Editor*in",
      "First Assistant Editor", "Schnittassistent*in",
      "Second Assistant Editor", "2. Schnittassistent*in", "3. Schnittassistent*in",
      "Schnittdramaturg*in", "VFX Editor*in", "Trailer Editor*in",
      "Dailies Cutter", "Sync Assistant",
      "Avid Operator", "Final Cut Operator*in",
      // Bild
      "Colorist", "Online Editor", "Finishing Artist",
      "Screen Designer*in", "Title Designer*in",
      "DCP Technician", "Filmscan Operator", "Filmscanning Supervisor",
      // VFX
      "VFX Supervisor", "VFX Producer*in", "VFX Coordinator",
      "VFX Herstellungsleiter*in", "VFX Outsource Producer", "Assistant VFX Producer*in",
      "VFX Animation Supervisor",
      "VR Producer*in",
      "Compositor", "Compositing Supervisor", "Digital Compositor",
      "Digital Effects Supervisor", "Digital Effects Designer*in",
      "Digital Matte Painter",
      "2D Artist", "3D Artist", "Lighting Artist (CG)",
      "Texture Artist", "Matchmove Artist", "Roto Artist", "FX Artist",
      // Animation
      "Animator", "Motion Designer", "Character Animator",
      // Assistenz
      "Post-Produktionsassistent*in", "Post-Produktionstechniker*in",
      "Schnittpraktikant*in",
    ],
  },
  {
    id: "musik",
    label: "Musik & Audio",
    labels: { "de":"Musik & Audio", "en":"Music & Audio", "es":"Música & Audio", "it":"Musica & Audio", "cs":"Hudba & Audio", "hu":"Zene & Audió" },
    emoji: "🎼",
    color: "purple",
    roles: [
      "Komponist*in", "Additional Music", "Trailer-Komponist*in",
      "Musikalische*r Leiter*in", "Music Director",
      "Music Supervisor",
      "Orchestrator", "Arranger", "Arrangeur*in",
      "Conductor", "Dirigent*in",
      "Music Editor", "Music Copyist",
      "Musikproduzent*in", "Music Consultant",
      "Musik Koordinator*in",
      "Logic Operator", "Pro Tools Operator",
      "Assistent*in des/der Komponist*in",
      "Musiker*in",
      "Sound Editor",
      "Komponistenpraktikant*in",
    ],
  },
  {
    id: "set-logistik",
    label: "Set / Logistik",
    labels: { "de":"Set / Logistik", "en":"Set / Logistics", "es":"Set / Logística", "it":"Set / Logistica", "cs":"Set / Logistika", "hu":"Helyszín / Logisztika" },
    emoji: "🚚",
    color: "slate",
    roles: [
      "Base Runner", "Fahrer (PKW / LKW)", "Motivfahrer",
      "Motivaufnahmeleiter", "Assistant Location Manager",
      "Set Security", "Crowd Control",
      "Medic / Set-Arzt", "Fire Safety Officer",
    ],
  },
  {
    id: "cast",
    label: "Cast & Performance",
    labels: { "de":"Cast & Performance", "en":"Cast & Performance", "es":"Reparto & Actuación", "it":"Cast & Performance", "cs":"Herci & Výkony", "hu":"Szereplők" },
    emoji: "🎭",
    color: "orange",
    roles: [
      "Hauptdarsteller/in", "Schauspieler", "Nebendarsteller", "Komparse", "Kleindarsteller",
      "Model", "Sprecher / Voice-Over", "Stand-In",
      "Stunt Performer", "Stunt Double", "Stunt Rigger",
      "Stunt Coordinator", "Assistant Stunt Coordinator",
      "Stunt Department Koordinator*in",
      "Fight Choreographer", "Action Regisseur*in",
      "Aerial Coordinator",
      "Stunt Rider", "Stunt Technician", "Stunt Rescue Diver",
      "Parkour Artist", "Präzisionsfahrer*in",
      "Horse Master", "Horse Wrangler",
      "Intimacy Coordinator",
      "Casting Associate", "Castingassistent*in",
    ],
  },
  {
    id: "sfx",
    label: "SFX",
    labels: { "de":"SFX", "en":"SFX", "es":"SFX", "it":"SFX", "cs":"SFX", "hu":"SFX" },
    emoji: "💥",
    color: "red",
    roles: [
      "Special Effects Supervisor", "SFX Technician", "Special Effects Coordinator",
      "Special Effects Project Manager",
      "Pyrotechnician", "Pyro Assistant",
      "Miniature Effects Producer",
      "Creature Designer*in", "Animatronics Engineer", "Puppenbauer*in",
      "Waffenmeister", "Waffentechniker*in",
      "Rigger (Wire)", "SFX Rigging / Spezialkonstruktionen",
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
      "Produktionsingenieur*in", "Broadcast Engineer",
      "Technische*r Leiter*in", "Bildingenieur*in",
      "Bildmischer", "Vision Mixer", "Shader", "Kamera CCU Operator",
      "DVE Operator", "Profile Operator",
      "Sendetechniker*in",
      "Sound Supervisor (Broadcast)", "Toningenieur*in",
      "Studio-/Veranstaltungsmeister*in", "Veranstaltungsmanager*in", "Veranstaltungstechniker*in",
      "MAZ Operator", "MAZ Techniker*in",
      "EVS Operator", "LSM Operator (Slomo)",
      "Streaming Technician",
      "Rigger (Broadcast/Event)", "Rigging Assistent*in",
      "Bildtechniker*in", "Lichttechniker*in", "Tontechniker*in",
      "Beschallungsingenieur*in", "Beschallungstechniker*in",
      "SNG Operator", "Tonassistent*in (Broadcast)",
      "Vidiwall Operator", "Teleprompter Operator",
      "Technischer Assistent*in (Broadcast)", "Bildassistent*in",
      "Kabelhilfe",
    ],
  },
  {
    id: "virtual",
    label: "Virtual Production",
    labels: { "de":"Virtual Production", "en":"Virtual Production", "es":"Producción Virtual", "it":"Produzione Virtuale", "cs":"Virtuální produkce", "hu":"Virtuális produkció" },
    emoji: "🧠",
    color: "pink",
    roles: [
      "Virtual Production Supervisor", "Virtual Production Producer",
      "Virtual Production Coordinator", "Virtual Production Studio Manager",
      "VAD Artist (Virtual Art Department)",
      "Virtual Production Engineer", "VP Systems & Tools Technical Director",
      "LED Wall Operator", "Unreal Engine Operator", "Realtime Engine Operator",
      "Media Server Operator", "VP System Admin",
      "VP Tracking Technician", "VP LED Technician",
      "Tracking Technician", "Real-Time Artist",
    ],
  },
  {
    id: "redaktion",
    label: "Redaktion & Content",
    labels: { "de":"Redaktion & Content", "en":"Editorial & Content", "es":"Redacción & Contenido", "it":"Redazione & Contenuto", "cs":"Redakce & Obsah", "hu":"Szerkesztőség & Tartalom" },
    emoji: "✍️",
    color: "lime",
    roles: [
      "Redaktionsleiter*in", "Chefredakteur*in", "Chef vom Dienst",
      "Head of Production (Sender)", "Herstellungsleiter*in (Sender)",
      "Ablaufkoordinator*in",
      "Redakteur", "TV Autor*in", "Castingredakteur*in",
      "Bildredakteur*in", "Schnittredakteur*in", "Onlineredakteur*in",
      "Videoredakteur*in", "TV Journalist*in", "Reporter*in",
      "Realisator*in", "Videoproducer*in", "Videojournalist*in",
      "Video Content Creator (Social Media)",
      "Moderator*in", "Nachrichtensprecher*in",
      "Creative Producer", "Creative Director",
      "Copywriter", "Konzepter", "Social Media Producer",
      "Redaktionsassistent*in", "Redaktionspraktikant*in",
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
      "Fotograf/in", "Modefotograf/in",
      "Produktfotograf/in",
      "Eventfotograf/in",
      "Portraitfotograf/in",
      "Werbefotograf/in", "Food Fotograf/in",
      "Drone Fotograf", "Standfotograf*in",
      "Fotoassistenz", "Studio Manager*in",
      "Retoucher/in", "Bildbearbeiter/in",
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

/**
 * Profile editing and crew search historically used `departments`, while jobs and
 * projects used `FILM_DEPARTMENTS`. Keep both existing catalogues in sync by
 * folding every job/project title into the profile catalogue at module load.
 * Exact labels and declared aliases resolve to one visible choice.
 */
const FILM_TO_PROFILE_DEPARTMENT: Record<string, string> = {
  "vor-der-kamera": "cast",
  regie: "regie",
  kamera: "kamera",
  licht: "licht",
  grip: "grip",
  ton: "ton",
  maske: "maske",
  kostuem: "kostuem",
  szenenbild: "art",
  produktion: "produktion",
  post: "post",
  vfx: "post",
  "animation-3d": "post",
  besetzung: "cast",
  drehbuch: "drehbuch",
  filmgeschaeftsfuehrung: "produktion",
  musik: "musik",
  producer: "produktion",
  "sende-veranstaltung": "broadcast",
  spezialeffekte: "sfx",
  stunts: "cast",
  "ton-post": "ton",
  "tv-web-content": "redaktion",
  "virtual-production": "virtual",
  "public-relation": "public-relations",
  "weitere-crew": "set-logistik",
  [CATERING_DEPARTMENT_ID]: CATERING_DEPARTMENT_ID,
  "content-creation": "social",
  "social-video": "social",
  fotografie: "foto",
  "foto-post": "foto",
};

const ADDITIONAL_DEPARTMENTS: Department[] = [
  {
    id: "drehbuch", label: "Drehbuch & Schreiben",
    labels: { de: "Drehbuch & Schreiben", en: "Writing", es: "Guion", it: "Sceneggiatura", cs: "Scénář", hu: "Forgatókönyv" },
    emoji: "✍️", color: "lime", roles: [],
  },
  {
    id: "public-relations", label: "Public Relations",
    labels: { de: "Public Relations", en: "Public Relations", es: "Relaciones públicas", it: "Relazioni pubbliche", cs: "Public relations", hu: "Public relations" },
    emoji: "📣", color: "pink", roles: [],
  },
  {
    id: CATERING_DEPARTMENT_ID,
    label: CATERING_DEPARTMENT_LABEL,
    labels: { de: CATERING_DEPARTMENT_LABEL, en: "Catering / Set Catering", es: "Catering de rodaje", it: "Catering sul set", cs: "Catering na place", hu: "Forgatási catering" },
    emoji: "🍽️", color: "orange", roles: [],
  },
];

departments.push(...ADDITIONAL_DEPARTMENTS);

function roleKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("de").replace(/[^a-z0-9]+/g, " ").trim();
}

for (const filmDepartment of FILM_DEPARTMENTS) {
  const targetId = FILM_TO_PROFILE_DEPARTMENT[filmDepartment.id];
  if (!targetId) continue;
  const target = departments.find((department) => department.id === targetId);
  if (!target) continue;
  target.roleAliases ??= {};

  for (const filmRole of filmDepartment.roles) {
    const synonyms = [filmRole.labelEn, ...(filmRole.aliases ?? [])].filter((value): value is string => Boolean(value?.trim()));
    const targetsExisting = target.roles.find((label) => {
      const currentSynonyms = target.roleAliases?.[label] ?? [];
      const currentKeys = new Set([label, ...currentSynonyms].map(roleKey));
      return [filmRole.label, ...synonyms].some((value) => currentKeys.has(roleKey(value)));
    });

    if (targetsExisting) {
      const current = target.roleAliases[targetsExisting] ?? [];
      const alternateLabels = [filmRole.label, ...synonyms].filter((value) => roleKey(value) !== roleKey(targetsExisting));
      target.roleAliases[targetsExisting] = [...new Set([...current, ...alternateLabels])];
      continue;
    }

    target.roles.push(filmRole.label);
    if (synonyms.length) target.roleAliases[filmRole.label] = [...new Set(synonyms)];
  }
}

/** Department -> valid profile type keys, shared by setup and profile editing. */
export const DEPARTMENT_TO_PROFILE_TYPES: Record<string, ProfileType[]> = {
  kamera: ["camera"], grip: ["camera"], licht: ["lighting"], ton: ["sound"],
  produktion: ["production"], regie: ["director"], art: ["art_department"],
  [CATERING_DEPARTMENT_ID]: ["production"],
  kostuem: ["costume"], maske: ["makeup"], post: ["postproduction"],
  sfx: ["sfx"], broadcast: ["broadcast"], virtual: ["vfx"],
  "set-logistik": ["production"], redaktion: ["filmmaker"], social: ["creator"],
  foto: ["photographer"], ki: ["filmmaker"], drehbuch: ["writer"],
  "public-relations": ["creator"], musik: ["filmmaker"],
};

/** Legacy single-value map retained for callers that assign one type at a time. */
export const DEPARTMENT_TO_PROFILE_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(DEPARTMENT_TO_PROFILE_TYPES).map(([departmentId, types]) => [departmentId, types[0] ?? ""]),
);

/** Profile type keys inferred from a selected department and its selected roles. */
export function getProfileTypesForDepartment(departmentId: string, selectedRoles: readonly string[] = []): ProfileType[] {
  if (departmentId === "cast") {
    const inferred = new Set<ProfileType>();
    for (const role of selectedRoles) {
      const key = roleKey(role);
      if (key.includes("model")) inferred.add("model");
      else if (key.includes("komparse") || key.includes("kleindarsteller") || key.includes("statist") || key.includes("background")) inferred.add("extra");
      else if (key.includes("stunt")) inferred.add("stunt");
      else if (key.includes("sprecher") || key.includes("voice over") || key.includes("voice actor")) inferred.add("voiceover");
      else if (key.includes("moderator") || key.includes("host")) inferred.add("host");
      else inferred.add("actor");
    }
    return inferred.size ? [...inferred] : ["actor"];
  }
  return DEPARTMENT_TO_PROFILE_TYPES[departmentId] ?? ["filmmaker"];
}

export function getDepartmentRoleSearchTerms(department: Department, role: string): string[] {
  return [...new Set([role, ...(department.roleAliases?.[role] ?? [])])];
}

const occupationSearchIndex = new Map<string, string[]>();
for (const department of departments) {
  for (const role of department.roles) {
    const terms = getDepartmentRoleSearchTerms(department, role);
    for (const term of terms) {
      const key = roleKey(term);
      occupationSearchIndex.set(key, [...new Set([...(occupationSearchIndex.get(key) ?? []), ...terms])]);
    }
  }
}

/** Canonical title plus searchable aliases for a stored role or typed search term. */
export function getOccupationSearchTerms(value: string): string[] {
  return occupationSearchIndex.get(roleKey(value)) ?? [value];
}

/** Match stored profile positions and filters across canonical names and catalogued aliases. */
export function matchesDepartmentOccupation(value: string, searchTerm: string): boolean {
  const valueTerms = getOccupationSearchTerms(value).map(roleKey);
  const searchTerms = getOccupationSearchTerms(searchTerm).map(roleKey);
  return searchTerms.some((needle) => valueTerms.some((candidate) =>
    needle === candidate
    || (needle.length >= 4 && candidate.includes(needle))
    || (candidate.length >= 4 && needle.includes(candidate)),
  ));
}

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
