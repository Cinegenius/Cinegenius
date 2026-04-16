// ─────────────────────────────────────────────────────────────
// CineGenius — Marketplace Taxonomy
// Hollywood Rental-House / Prop-Department hierarchy
// ─────────────────────────────────────────────────────────────

export type MarketplaceItem = {
  label: string;
  value: string; // stored in listings.category
};

export type MarketplaceGroup = {
  id: string;
  label: string;
  items: MarketplaceItem[];
};

export type MarketplaceDept = {
  id: string;
  label: string;
  iconName: string;   // lucide icon component name — mapped in PropsContent
  color: string;      // tailwind color key (sky, amber, teal …)
  legacyValues: string[]; // old flat values that map here
  groups: MarketplaceGroup[];
};

export const DEPARTMENTS: MarketplaceDept[] = [
  // ─── KAMERA ───────────────────────────────────────────────
  {
    id: "kamera",
    label: "Kamera",
    iconName: "Camera",
    color: "sky",
    legacyValues: ["Kameraequipment", "kamera", "filmtechnik"],
    groups: [
      {
        id: "kamera-kameras",
        label: "Kameras",
        items: [
          { label: "ARRI (Alexa Mini, LF, 35…)", value: "arri" },
          { label: "RED (Komodo, V-Raptor…)", value: "red" },
          { label: "Sony Cinema Line", value: "sony-cinema" },
          { label: "Blackmagic", value: "blackmagic" },
          { label: "DSLR / Mirrorless", value: "dslr" },
        ],
      },
      {
        id: "kamera-optiken",
        label: "Optiken",
        items: [
          { label: "Prime Lenses", value: "prime-lenses" },
          { label: "Zoom Lenses", value: "zoom-lenses" },
          { label: "Anamorphic Lenses", value: "anamorphic" },
          { label: "Vintage Lenses", value: "vintage-lenses" },
          { label: "Cine-Objektive (Zeiss, Cooke…)", value: "cine-lenses" },
        ],
      },
      {
        id: "kamera-zubehoer",
        label: "Kamera-Zubehör",
        items: [
          { label: "Matte Box", value: "matte-box" },
          { label: "Follow Focus", value: "follow-focus" },
          { label: "Filter (ND, Polarizer…)", value: "filter" },
          { label: "Lens Control Systems", value: "lens-control" },
          { label: "Top Plates / Käfig", value: "camera-cage" },
        ],
      },
      {
        id: "kamera-monitoring",
        label: "Monitoring",
        items: [
          { label: "On-Set Monitore", value: "onset-monitor" },
          { label: "Director Monitore", value: "director-monitor" },
          { label: "Wireless Video Systeme", value: "wireless-video" },
          { label: "HDMI / SDI Konverter", value: "video-converter" },
        ],
      },
      {
        id: "kamera-support",
        label: "Camera Support",
        items: [
          { label: "Stative / Tripods", value: "tripod" },
          { label: "Fluid Heads", value: "fluid-head" },
          { label: "Shoulder Rigs", value: "shoulder-rig" },
          { label: "Easyrig / Vest Rig", value: "easyrig" },
          { label: "Handgriffe / Accessories", value: "handle-acc" },
        ],
      },
      {
        id: "kamera-movement",
        label: "Camera Movement",
        items: [
          { label: "Gimbal", value: "gimbal" },
          { label: "Steadicam", value: "steadicam" },
          { label: "Remote Heads", value: "remote-head" },
          { label: "Motion Control", value: "motion-control" },
          { label: "Cable Cam / FPV", value: "cable-cam" },
        ],
      },
      {
        id: "kamera-spezial",
        label: "Spezialkameras",
        items: [
          { label: "Unterwassergehäuse", value: "underwater-housing" },
          { label: "High-Speed Kameras", value: "high-speed-cam" },
          { label: "Crash Cams", value: "crash-cam" },
          { label: "Aerial / Drohne", value: "drone-cam" },
          { label: "360° / VR Systeme", value: "360-cam" },
        ],
      },
    ],
  },

  // ─── LICHT ────────────────────────────────────────────────
  {
    id: "licht",
    label: "Licht",
    iconName: "Lightbulb",
    color: "amber",
    legacyValues: ["Lichttechnik", "licht"],
    groups: [
      {
        id: "licht-quellen",
        label: "Lichtquellen",
        items: [
          { label: "LED Panels (ARRI, Aputure, Nanlite…)", value: "led-panel" },
          { label: "Fresnel", value: "fresnel" },
          { label: "HMI", value: "hmi" },
          { label: "Tungsten / Halogen", value: "tungsten" },
          { label: "Tubes (Astera, Quasar…)", value: "light-tubes" },
          { label: "Bi-Color Panels", value: "bicolor-panel" },
        ],
      },
      {
        id: "licht-modifier",
        label: "Modifier & Diffusion",
        items: [
          { label: "Softboxen", value: "softbox" },
          { label: "Oktaboxen / Ringblitz", value: "octa" },
          { label: "Diffusion / CTD-Folie", value: "diffusion" },
          { label: "Flags / Netz / Butterfly", value: "flags" },
          { label: "Grids (Honeycomb)", value: "grids" },
          { label: "Bounce / Reflektoren", value: "bounce" },
        ],
      },
      {
        id: "licht-strom",
        label: "Strom & Kabel",
        items: [
          { label: "Generatoren", value: "generator" },
          { label: "Stromverteilung / Distro", value: "distro" },
          { label: "Feeder Cable / Cee-Kabel", value: "feeder-cable" },
          { label: "Power Stations (Portable)", value: "powerstation" },
          { label: "Dimmer / Controller", value: "dimmer" },
        ],
      },
      {
        id: "licht-rigging",
        label: "Licht-Rigging",
        items: [
          { label: "Rigging-Systeme (Batten, Speed Rail)", value: "light-rigging" },
          { label: "Deckenaufhängungen", value: "ceiling-mount" },
          { label: "Junior / Baby Stands", value: "light-stand" },
          { label: "Overhead Frames", value: "overhead-frame" },
        ],
      },
      {
        id: "licht-spezial",
        label: "Speziallicht",
        items: [
          { label: "Neon / Leuchtreklame", value: "neon" },
          { label: "Practical Lights", value: "practical" },
          { label: "Stroboskope / Club", value: "strobe" },
          { label: "Effektlicht / RGB", value: "effect-light" },
          { label: "Underwater Lights", value: "underwater-light" },
        ],
      },
    ],
  },

  // ─── GRIP / RIGGING ───────────────────────────────────────
  {
    id: "grip",
    label: "Grip & Rigging",
    iconName: "Wrench",
    color: "slate",
    legacyValues: ["Grip & Rigging", "rigging"],
    groups: [
      {
        id: "grip-basics",
        label: "Grip Basics",
        items: [
          { label: "C-Stands", value: "c-stand" },
          { label: "Sandbags", value: "sandbag" },
          { label: "Stative (Grip)", value: "grip-stand" },
          { label: "Baby Pins / Spud Adapters", value: "grip-pins" },
          { label: "Knuckles / Clamps", value: "clamps" },
        ],
      },
      {
        id: "grip-movement",
        label: "Camera Movement (Grip)",
        items: [
          { label: "Dolly (Fisher, Chapman…)", value: "dolly" },
          { label: "Dolly Track", value: "dolly-track" },
          { label: "Slider", value: "slider" },
          { label: "Giraffe Boom", value: "giraffe" },
        ],
      },
      {
        id: "grip-heavy",
        label: "Heavy Equipment",
        items: [
          { label: "Kranarm / Jib", value: "jib" },
          { label: "Techno Crane", value: "techno-crane" },
          { label: "Hubsteiger / Cherrypicker", value: "cherry-picker" },
          { label: "Kamerawagen", value: "camera-car" },
        ],
      },
      {
        id: "grip-rigging",
        label: "Rigging",
        items: [
          { label: "Truss-Systeme", value: "truss" },
          { label: "Seilzüge / Chain Hoists", value: "chain-hoist" },
          { label: "Safety Hardware", value: "safety-hardware" },
          { label: "Schienen / Tracks", value: "rails" },
        ],
      },
    ],
  },

  // ─── TON ──────────────────────────────────────────────────
  {
    id: "ton",
    label: "Ton & Audio",
    iconName: "Mic",
    color: "teal",
    legacyValues: ["Ton & Audio", "ton"],
    groups: [
      {
        id: "ton-aufnahme",
        label: "Aufnahme",
        items: [
          { label: "Shotgun Mikrofone", value: "shotgun-mic" },
          { label: "Lavalier / Clip-On", value: "lavalier" },
          { label: "Field Recorder (Zaxcom, Sound Devices…)", value: "field-recorder" },
          { label: "Stereo / Surround Mics", value: "stereo-mic" },
        ],
      },
      {
        id: "ton-funk",
        label: "Funk & Wireless",
        items: [
          { label: "Wireless-Sets (Sennheiser, Lectrosonics…)", value: "wireless-set" },
          { label: "IFB / Comtek", value: "ifb" },
          { label: "Intercom Systeme", value: "intercom" },
        ],
      },
      {
        id: "ton-zubehoer",
        label: "Zubehör",
        items: [
          { label: "Boom Poles", value: "boom-pole" },
          { label: "Wind Protection (Blimp, Windjammer)", value: "wind-protection" },
          { label: "Audio-Kabel / XLR", value: "audio-cable" },
          { label: "Mixer / Patchbays", value: "audio-mixer" },
          { label: "Headphones / Abhöre", value: "headphones" },
        ],
      },
    ],
  },

  // ─── KOSTÜM ───────────────────────────────────────────────
  {
    id: "kostuem",
    label: "Kostüm",
    iconName: "Shirt",
    color: "rose",
    legacyValues: ["Kostüme", "kostueme"],
    groups: [
      {
        id: "kostuem-kleidung",
        label: "Kleidung",
        items: [
          { label: "Alltagskleidung (Modern)", value: "alltagskleidung" },
          { label: "Historische Kostüme (1900–1970)", value: "historisch-frueh" },
          { label: "Historische Kostüme (1970–1990)", value: "historisch-spaet" },
          { label: "Viktorianisch / Biedermeier", value: "viktorianisch" },
          { label: "Mittelalter / Renaissance", value: "mittelalter" },
          { label: "Fantasy / Sci-Fi", value: "fantasy-scifi" },
          { label: "Uniformen (Militär, Polizei…)", value: "uniform" },
          { label: "Berufskleidung", value: "berufskleidung" },
        ],
      },
      {
        id: "kostuem-accessoires",
        label: "Accessoires",
        items: [
          { label: "Schmuck", value: "schmuck" },
          { label: "Taschen / Handtaschen", value: "taschen" },
          { label: "Gürtel / Schuhe", value: "guertel-schuhe" },
          { label: "Hüte / Kopfbedeckungen", value: "hut" },
          { label: "Brillen / Props-Brillen", value: "brille" },
        ],
      },
      {
        id: "kostuem-spezial",
        label: "Spezialkostüme",
        items: [
          { label: "Stunt-Kostüme / Polsterung", value: "stunt-kostuem" },
          { label: "Aged / Distressed Kostüme", value: "aged-kostuem" },
          { label: "Creature / Masken-Kostüme", value: "creature-kostuem" },
          { label: "Sportbekleidung / Trikots", value: "sport-kostuem" },
        ],
      },
    ],
  },

  // ─── MASKE / HAIR ─────────────────────────────────────────
  {
    id: "maske",
    label: "Maske & Hair",
    iconName: "Sparkles",
    color: "fuchsia",
    legacyValues: ["Maske"],
    groups: [
      {
        id: "maske-makeup",
        label: "Make-up & Kits",
        items: [
          { label: "Standard Make-up Kits", value: "makeup-kit" },
          { label: "High-End / HD Make-up", value: "hd-makeup" },
          { label: "Airbrush-Equipment", value: "airbrush" },
        ],
      },
      {
        id: "maske-sfx",
        label: "SFX Make-up",
        items: [
          { label: "Latex / Schaumlatex", value: "latex" },
          { label: "Prosthetics / Gesichtsformen", value: "prosthetics" },
          { label: "Blood FX / Wunden", value: "blood-fx" },
          { label: "Bald Caps", value: "bald-cap" },
          { label: "Body Paint", value: "body-paint" },
        ],
      },
      {
        id: "maske-hair",
        label: "Hair",
        items: [
          { label: "Perücken (Damen / Herren)", value: "peruecke" },
          { label: "Extensions", value: "extensions" },
          { label: "Styling Tools (GHD, Lockenwickler…)", value: "styling-tools" },
          { label: "Bärte / Fake Haare", value: "fake-haar" },
        ],
      },
    ],
  },

  // ─── REQUISITEN ───────────────────────────────────────────
  {
    id: "requisiten",
    label: "Requisiten",
    iconName: "Layers",
    color: "violet",
    legacyValues: ["Requisiten", "sfx"],
    groups: [
      {
        id: "req-moebel",
        label: "Möbel",
        items: [
          { label: "Sofas & Sessel", value: "sofa" },
          { label: "Tische (Ess-, Couchtisch…)", value: "tisch" },
          { label: "Betten & Lattenroste", value: "bett" },
          { label: "Büromöbel", value: "bueromoebel" },
          { label: "Regale & Schränke", value: "regal" },
          { label: "Stühle & Hocker", value: "stuhl" },
        ],
      },
      {
        id: "req-deko",
        label: "Dekoration",
        items: [
          { label: "Bilder & Spiegel", value: "bilder-spiegel" },
          { label: "Lampen & Leuchten", value: "lampen" },
          { label: "Vorhänge & Textilien", value: "vorhaenge" },
          { label: "Vasen / Deko-Objekte", value: "deko-objekte" },
          { label: "Teppiche", value: "teppich" },
        ],
      },
      {
        id: "req-alltag",
        label: "Alltagsgegenstände",
        items: [
          { label: "Küchenutensilien", value: "kueche" },
          { label: "Werkzeug", value: "werkzeug" },
          { label: "Büroartikel", value: "buroartikel" },
          { label: "Spielzeug", value: "spielzeug" },
          { label: "Bücher / Zeitungen (Period)", value: "buecher-period" },
        ],
      },
      {
        id: "req-spezial",
        label: "Spezial Props",
        items: [
          { label: "Waffen (Fake / Replika)", value: "waffen-fake" },
          { label: "Geld (Filmnoten)", value: "filmgeld" },
          { label: "Dokumente / Pässe / Ausweise", value: "dokumente" },
          { label: "Medizinische Props", value: "medical-props" },
          { label: "Militär Props", value: "militaer-props" },
        ],
      },
      {
        id: "req-elektronik",
        label: "Elektronik Props",
        items: [
          { label: "Fernseher (modern & vintage)", value: "tv-prop" },
          { label: "Computer / Monitore", value: "computer-prop" },
          { label: "Telefone & Handys (period)", value: "phone-prop" },
          { label: "Vintage Elektronik (Radio, Grammofon…)", value: "vintage-elektronik" },
        ],
      },
      {
        id: "req-food",
        label: "Food Props",
        items: [
          { label: "Fake Food", value: "fake-food" },
          { label: "Catering Props / Geschirr", value: "catering-props" },
          { label: "Flaschen & Gläser", value: "flaschen" },
        ],
      },
    ],
  },

  // ─── SZENENBILD / SET DESIGN ──────────────────────────────
  {
    id: "szenenbild",
    label: "Szenenbild",
    iconName: "Palette",
    color: "emerald",
    legacyValues: ["Möbel / Szenenbild", "szenenbild", "moebel"],
    groups: [
      {
        id: "szene-bau",
        label: "Set-Bau",
        items: [
          { label: "Wandmodule / Flats", value: "wall-flat" },
          { label: "Böden / Floor Systems", value: "floor-system" },
          { label: "Doorsets / Fensterrahmen", value: "doorset" },
          { label: "Säulen / Pilaster", value: "column" },
        ],
      },
      {
        id: "szene-oberflaeche",
        label: "Oberflächen",
        items: [
          { label: "Texturen / Strukturputz", value: "texture" },
          { label: "Paint Kits / Sprühlack", value: "paint" },
          { label: "Wallpaper (period / modern)", value: "wallpaper" },
          { label: "Floor Vinyl / Parkett-Look", value: "floor-vinyl" },
        ],
      },
      {
        id: "szene-greens",
        label: "Greens & Natur",
        items: [
          { label: "Kunstpflanzen / Pflanzen", value: "pflanzen" },
          { label: "Bäume (Baum-Staging)", value: "baeume" },
          { label: "Blumen", value: "blumen" },
          { label: "Moos / Erde (Dekor)", value: "moos-erde" },
        ],
      },
    ],
  },

  // ─── FAHRZEUGE ────────────────────────────────────────────
  {
    id: "fahrzeuge",
    label: "Fahrzeuge",
    iconName: "Car",
    color: "orange",
    legacyValues: ["Bild-Fahrzeug", "fahrzeuge", "vehicle"],
    groups: [
      {
        id: "fahr-pkw",
        label: "PKW",
        items: [
          { label: "Oldtimer (vor 1970)", value: "oldtimer" },
          { label: "Classic Cars (1970–1990)", value: "classic-car" },
          { label: "Moderne PKW", value: "moderne-pkw" },
          { label: "Luxusfahrzeuge", value: "luxus-fahr" },
          { label: "Sportwagen", value: "sportwagen" },
        ],
      },
      {
        id: "fahr-spezial",
        label: "Spezialfahrzeuge",
        items: [
          { label: "Polizei / Feuerwehr (Replika)", value: "polizei-fahr" },
          { label: "Krankenwagen / Rettung", value: "ambulance" },
          { label: "Militärfahrzeuge", value: "militaer-fahr" },
          { label: "Trucks / LKW", value: "truck" },
          { label: "Motorräder", value: "motorrad" },
          { label: "Busse / Transporter", value: "bus" },
        ],
      },
      {
        id: "fahr-stunt",
        label: "Stunt / Rig Cars",
        items: [
          { label: "Stunt Cars", value: "stunt-car" },
          { label: "Camera Rig Cars", value: "rig-car" },
          { label: "Tieflader / Transporter für Fahrzeuge", value: "auto-transporter" },
        ],
      },
    ],
  },

  // ─── SFX ──────────────────────────────────────────────────
  {
    id: "sfx",
    label: "SFX",
    iconName: "Zap",
    color: "red",
    legacyValues: ["SFX"],
    groups: [
      {
        id: "sfx-atmo",
        label: "Atmosphäre",
        items: [
          { label: "Rauch / Nebel Maschinen", value: "smoke-machine" },
          { label: "Haze Maschinen", value: "haze-machine" },
          { label: "Wind Maschinen", value: "wind-machine" },
          { label: "Schnee / Regen Systeme", value: "weather-fx" },
        ],
      },
      {
        id: "sfx-pyro",
        label: "Pyrotechnik",
        items: [
          { label: "Confetti / Streamer Kanonen", value: "confetti" },
          { label: "CO2 Jets", value: "co2-jet" },
          { label: "Pyro Effekte (lizenzpflichtig)", value: "pyro" },
        ],
      },
      {
        id: "sfx-wasser",
        label: "Wasser & Klima",
        items: [
          { label: "Regen-Rigging / Rain Head", value: "rain-head" },
          { label: "Wasserpumpen", value: "water-pump" },
          { label: "Nebel-Düsensysteme", value: "fog-nozzle" },
        ],
      },
    ],
  },

  // ─── VIRTUAL PRODUCTION ───────────────────────────────────
  {
    id: "virtual-production",
    label: "Virtual Production",
    iconName: "Monitor",
    color: "purple",
    legacyValues: ["Virtual Production"],
    groups: [
      {
        id: "vp-led",
        label: "LED Walls & Displays",
        items: [
          { label: "LED Volume / LED Wall", value: "led-wall" },
          { label: "LED Panels (Fine Pitch)", value: "led-finepitch" },
          { label: "Curved LED Displays", value: "curved-led" },
        ],
      },
      {
        id: "vp-tracking",
        label: "Tracking & Tech",
        items: [
          { label: "Camera Tracking Systeme", value: "cam-tracking" },
          { label: "Unreal Engine Rigs", value: "unreal-rig" },
          { label: "Green Screen Systeme", value: "greenscreen-vp" },
          { label: "Motion Capture Suits", value: "mocap" },
        ],
      },
    ],
  },

  // ─── POST PRODUCTION ──────────────────────────────────────
  {
    id: "post",
    label: "Post Production",
    iconName: "Scissors",
    color: "blue",
    legacyValues: ["Post Production", "postproduktion"],
    groups: [
      {
        id: "post-edit",
        label: "Editing Systeme",
        items: [
          { label: "Mac Pro / Workstations", value: "edit-workstation" },
          { label: "Thunderbolt-Arrays / NAS", value: "storage" },
          { label: "Avid / DaVinci Lizenzen", value: "edit-license" },
        ],
      },
      {
        id: "post-color",
        label: "Color Grading",
        items: [
          { label: "Blackmagic DaVinci Panels", value: "davinci-panel" },
          { label: "Referenz-Monitore (EIZO, Sony)", value: "ref-monitor" },
          { label: "HDR / 4K Monitoring", value: "hdr-monitor" },
        ],
      },
    ],
  },

  // ─── STUDIO & INFRASTRUKTUR ───────────────────────────────
  {
    id: "studio",
    label: "Studio & Infra",
    iconName: "Building2",
    color: "cyan",
    legacyValues: ["Studio", "Fotostudio"],
    groups: [
      {
        id: "studio-greenscreen",
        label: "Greenscreen / Backdrop",
        items: [
          { label: "Greenscreen Sets", value: "greenscreen" },
          { label: "Bluescreen", value: "bluescreen" },
          { label: "Papier-Backdrop Rollen", value: "backdrop-papier" },
          { label: "Muslin Backgrounds", value: "backdrop-muslin" },
        ],
      },
      {
        id: "studio-foto",
        label: "Fotografie",
        items: [
          { label: "Fotoequipment (Kamera)", value: "fotoequipment" },
          { label: "Blitz / Studio Flash", value: "studioblitz" },
          { label: "Modifiers (Beauty Dish, Softbox)", value: "foto-modifier" },
          { label: "Backdrops & Hintergründe", value: "backdrops" },
          { label: "Content Sets / Creator", value: "content-sets" },
        ],
      },
    ],
  },

  // ─── PRODUKTION & LOGISTIK ────────────────────────────────
  {
    id: "produktion",
    label: "Produktion & Logistik",
    iconName: "Briefcase",
    color: "amber",
    legacyValues: ["Produktionsausstattung", "produktion"],
    groups: [
      {
        id: "prod-set",
        label: "Set-Infrastruktur",
        items: [
          { label: "Walkie Talkies / Funkgeräte", value: "walkie" },
          { label: "Zelte / Shelter", value: "zelt" },
          { label: "Set-Möbel (Stühle, Tische)", value: "set-moebel" },
          { label: "Monitore / PA-Systeme", value: "pa-system" },
          { label: "Wartebereich / Catering Equip.", value: "catering-equip" },
        ],
      },
      {
        id: "prod-transport",
        label: "Transport & Lagerung",
        items: [
          { label: "Pelican / Hard Cases", value: "hard-case" },
          { label: "Softbags / Transporttaschen", value: "soft-bag" },
          { label: "Equipment Carts / Trolleys", value: "cart" },
          { label: "Transporter / Sprinter (leer)", value: "sprinter" },
        ],
      },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────

/** All category values belonging to a department (incl. legacy) */
export function deptValues(dept: MarketplaceDept): string[] {
  const fromGroups = dept.groups.flatMap((g) => g.items.map((i) => i.value));
  return [...fromGroups, ...dept.legacyValues];
}

/** All category values belonging to a group */
export function groupValues(group: MarketplaceGroup): string[] {
  return group.items.map((i) => i.value);
}

/** Find the department for a raw category value */
export function findDept(value: string): MarketplaceDept | undefined {
  const v = value.toLowerCase();
  return DEPARTMENTS.find((d) =>
    d.legacyValues.some((lv) => lv.toLowerCase() === v) ||
    d.groups.some((g) => g.items.some((i) => i.value === v))
  );
}

/** Flat list of every category value across all departments */
export const ALL_VALUES: string[] = DEPARTMENTS.flatMap(deptValues);

// ── Szenen-Kategorien ─────────────────────────────────────────────
// Production-designer Denkweise: "Ich brauche ein Büro aus den 80ern"
// → statt durch Kategorien zu scrollen direkt Szene wählen

export type Scene = {
  id: string;
  label: string;
  iconName: string;
  description: string;
  /** category values + legacyValues that belong to this scene */
  keywords: string[];
};

export const SCENES: Scene[] = [
  {
    id: "wohnzimmer",
    label: "Wohnzimmer",
    iconName: "Home",
    description: "Sofas, Tische, Leuchten, Teppiche, Deko",
    keywords: ["sofa", "tisch", "bett", "lampen", "teppich", "tv-prop", "bilder-spiegel", "regal", "stuhl", "deko-objekte", "vorhaenge"],
  },
  {
    id: "buero",
    label: "Büro",
    iconName: "Briefcase",
    description: "Schreibtische, Computer, Akten, Büroausstattung",
    keywords: ["bueromoebel", "computer-prop", "phone-prop", "buroartikel", "stuhl", "tisch", "regal"],
  },
  {
    id: "restaurant",
    label: "Restaurant",
    iconName: "Utensils",
    description: "Tische, Stühle, Geschirr, Flaschen, Besteck",
    keywords: ["kueche", "catering-props", "flaschen", "tisch", "stuhl"],
  },
  {
    id: "krankenhaus",
    label: "Krankenhaus",
    iconName: "HeartPulse",
    description: "OP-Instrumente, Betten, Monitore, Krankenwagen",
    keywords: ["medical-props", "bett", "ambulance", "computer-prop"],
  },
  {
    id: "militaer",
    label: "Militär",
    iconName: "Shield",
    description: "Uniformen, Fahrzeuge, Waffen, Ausrüstung",
    keywords: ["militaer-props", "militaer-fahr", "uniform", "waffen-fake", "stunt-car"],
  },
  {
    id: "fahrzeuge",
    label: "Fahrzeuge",
    iconName: "Car",
    description: "Oldtimer, Stuntcars, Militär, Spezialfahrzeuge",
    keywords: ["oldtimer", "classic-car", "moderne-pkw", "luxus-fahr", "sportwagen", "militaer-fahr", "stunt-car", "motorrad", "bus", "truck", "rig-car", "auto-transporter", "bild-fahrzeug"],
  },
  {
    id: "kueche",
    label: "Küche",
    iconName: "ChefHat",
    description: "Küchenutensilien, Geschirr, Flaschen",
    keywords: ["kueche", "catering-props", "flaschen", "werkzeug"],
  },
  {
    id: "bar",
    label: "Bar & Club",
    iconName: "Wine",
    description: "Flaschen, Neonlichter, Barhocker, Atmosphäre",
    keywords: ["flaschen", "neon", "strobe", "stuhl", "effect-light"],
  },
  {
    id: "hotel",
    label: "Hotel",
    iconName: "Hotel",
    description: "Betten, Sofas, Deko, Empfang",
    keywords: ["bett", "sofa", "lampen", "bilder-spiegel", "teppich", "regal"],
  },
  {
    id: "kostuem",
    label: "Kostüm",
    iconName: "Shirt",
    description: "Historische und moderne Kostüme, Uniformen",
    keywords: ["alltagskleidung", "historisch-frueh", "historisch-spaet", "viktorianisch", "mittelalter", "fantasy-scifi", "uniform", "berufskleidung"],
  },
  {
    id: "labor",
    label: "Labor",
    iconName: "FlaskConical",
    description: "Laborgeräte, medizinische Requisiten",
    keywords: ["medical-props", "computer-prop"],
  },
];

// ── Synonyme / Semantische Suche ──────────────────────────────────
// Mappt Nutzer-Suchbegriffe auf Kategorie-Werte der Taxonomie.
// → "Löffel" findet Listings mit category="kueche" auch ohne Volltexttreffer

export const SEARCH_SYNONYMS: Record<string, string[]> = {
  // Küche / Essen
  löffel:        ["kueche"],
  gabel:         ["kueche"],
  messer:        ["kueche"],
  teller:        ["catering-props", "kueche"],
  schüssel:      ["catering-props", "kueche"],
  glas:          ["flaschen"],
  flasche:       ["flaschen"],
  besteck:       ["kueche"],
  geschirr:      ["catering-props", "kueche"],
  topf:          ["kueche"],
  pfanne:        ["kueche"],
  // Möbel
  couch:         ["sofa"],
  sessel:        ["stuhl", "sofa"],
  schrank:       ["regal"],
  regal:         ["regal"],
  couchtisch:    ["tisch"],
  esstisch:      ["tisch"],
  schreibtisch:  ["bueromoebel", "tisch"],
  // Licht / Deko
  lampe:         ["lampen", "practical"],
  leuchte:       ["lampen"],
  licht:         ["lampen"],
  spiegel:       ["bilder-spiegel"],
  bild:          ["bilder-spiegel"],
  teppich:       ["teppich"],
  vorhang:       ["vorhaenge"],
  // Elektronik
  telefon:       ["phone-prop"],
  handy:         ["phone-prop"],
  festnetz:      ["phone-prop"],
  computer:      ["computer-prop"],
  laptop:        ["computer-prop"],
  monitor:       ["computer-prop", "onset-monitor"],
  fernseher:     ["tv-prop"],
  tv:            ["tv-prop"],
  radio:         ["vintage-elektronik"],
  // Fahrzeuge
  auto:          ["oldtimer", "classic-car", "moderne-pkw", "bild-fahrzeug"],
  wagen:         ["oldtimer", "classic-car"],
  fahrzeug:      ["bild-fahrzeug", "oldtimer"],
  oldtimer:      ["oldtimer"],
  sportwagen:    ["sportwagen"],
  motorrad:      ["motorrad"],
  panzer:        ["militaer-fahr"],
  lkw:           ["truck"],
  bus:           ["bus"],
  krankenwagen:  ["ambulance"],
  feuerwehr:     ["polizei-fahr"],
  polizei:       ["polizei-fahr"],
  // Militär
  waffe:         ["waffen-fake"],
  pistole:       ["waffen-fake"],
  gewehr:        ["waffen-fake"],
  schwert:       ["waffen-fake"],
  uniform:       ["uniform"],
  militär:       ["militaer-props", "militaer-fahr"],
  soldat:        ["militaer-props", "uniform"],
  // Medizin
  arzt:          ["medical-props"],
  krankenhaus:   ["medical-props"],
  spritze:       ["medical-props"],
  // Kostüm
  kostüm:        ["alltagskleidung", "historisch-frueh"],
  kleid:         ["alltagskleidung"],
  anzug:         ["alltagskleidung"],
  hut:           ["hut"],
  schmuck:       ["schmuck"],
  // Kamera / Licht-Equipment (Leihgeräte)
  kamera:        ["arri", "red", "sony-cinema", "blackmagic", "dslr"],
  stativ:        ["tripod"],
  scheinwerfer:  ["led-panel", "fresnel", "hmi"],
};
